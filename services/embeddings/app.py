"""
VisionTest AI - Embeddings Sidecar Service

FastAPI service providing visual similarity metrics for screenshot comparison:
  - SSIM  (Structural Similarity Index)
  - LPIPS (Learned Perceptual Image Patch Similarity)
  - DINOv2 cosine similarity and raw embeddings

Designed to run as a Kubernetes sidecar alongside the VisionTest worker.
"""

from __future__ import annotations

import io
import logging
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import torch
import torchvision.transforms.functional as TF
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from torchmetrics.image import (
    LearnedPerceptualImagePatchSimilarity,
    StructuralSimilarityIndexMeasure,
)
from transformers import AutoImageProcessor, AutoModel  # type: ignore[import-untyped]

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("embeddings")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_IMAGE_DIMENSION = 512
DINO_MODEL_NAME = "facebook/dinov2-small"
DINO_EMBEDDING_DIM = 384  # dinov2-small output dimension

# ---------------------------------------------------------------------------
# Device detection
# ---------------------------------------------------------------------------

_env_device = os.environ.get("TORCH_DEVICE")
if _env_device:
    DEVICE = torch.device(_env_device)
elif torch.cuda.is_available():
    DEVICE = torch.device("cuda")
else:
    DEVICE = torch.device("cpu")

GPU_AVAILABLE = DEVICE.type == "cuda"

logger.info("Using device: %s (GPU available: %s)", DEVICE, GPU_AVAILABLE)

# ---------------------------------------------------------------------------
# Model globals (populated on startup)
# ---------------------------------------------------------------------------

ssim_metric: StructuralSimilarityIndexMeasure | None = None
lpips_metric: LearnedPerceptualImagePatchSimilarity | None = None
dino_model: Any = None
dino_processor: Any = None


def _load_models() -> None:
    """Load all models into module-level globals. Called once at startup."""
    global ssim_metric, lpips_metric, dino_model, dino_processor  # noqa: PLW0603

    t0 = time.monotonic()

    # SSIM -------------------------------------------------------------------
    logger.info("Loading SSIM metric ...")
    ssim_metric = StructuralSimilarityIndexMeasure(data_range=1.0).to(DEVICE)
    logger.info("  SSIM ready (%.1fs)", time.monotonic() - t0)

    # LPIPS ------------------------------------------------------------------
    t1 = time.monotonic()
    logger.info("Loading LPIPS metric (squeeze net) ...")
    lpips_metric = LearnedPerceptualImagePatchSimilarity(net_type="squeeze").to(DEVICE)
    lpips_metric.eval()
    logger.info("  LPIPS ready (%.1fs)", time.monotonic() - t1)

    # DINOv2 -----------------------------------------------------------------
    t2 = time.monotonic()
    logger.info("Loading DINOv2 (%s) ...", DINO_MODEL_NAME)
    dino_processor = AutoImageProcessor.from_pretrained(DINO_MODEL_NAME)
    dino_model = AutoModel.from_pretrained(DINO_MODEL_NAME).to(DEVICE)
    dino_model.eval()
    logger.info("  DINOv2 ready (%.1fs)", time.monotonic() - t2)

    logger.info("All models loaded in %.1fs", time.monotonic() - t0)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(_app: FastAPI):  # type: ignore[no-untyped-def]
    _load_models()
    yield


app = FastAPI(
    title="VisionTest Embeddings Service",
    version="1.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------


def _read_image(data: bytes) -> Image.Image:
    """Open raw bytes as an RGB PIL image."""
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {exc}") from exc
    return img


def _resize_if_needed(img: Image.Image, max_dim: int = MAX_IMAGE_DIMENSION) -> Image.Image:
    """Down-scale so the largest side is at most *max_dim* pixels."""
    w, h = img.size
    if max(w, h) <= max_dim:
        return img
    scale = max_dim / max(w, h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    return img.resize((new_w, new_h), Image.LANCZOS)


def _ensure_same_size(a: Image.Image, b: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Resize *b* to match *a* if their dimensions differ."""
    if a.size == b.size:
        return a, b
    logger.warning(
        "Image size mismatch (%s vs %s) — resizing current to match baseline",
        a.size,
        b.size,
    )
    b = b.resize(a.size, Image.LANCZOS)
    return a, b


def _pil_to_tensor_01(img: Image.Image) -> torch.Tensor:
    """Convert PIL image to (1, C, H, W) float tensor normalised to [0, 1]."""
    t = TF.to_tensor(img).unsqueeze(0)  # (1, C, H, W), [0, 1]
    return t.to(DEVICE)


def _tensor_01_to_neg11(t: torch.Tensor) -> torch.Tensor:
    """Map [0, 1] tensor to [-1, 1]."""
    return t * 2.0 - 1.0


# ---------------------------------------------------------------------------
# Metric computation helpers
# ---------------------------------------------------------------------------


def _compute_ssim(baseline_img: Image.Image, current_img: Image.Image) -> float:
    """Return SSIM score for two PIL images."""
    assert ssim_metric is not None
    t_base = _pil_to_tensor_01(baseline_img)
    t_curr = _pil_to_tensor_01(current_img)
    with torch.no_grad():
        score = ssim_metric(t_curr, t_base)
    return float(score.item())


def _compute_lpips(baseline_img: Image.Image, current_img: Image.Image) -> float:
    """Return LPIPS score for two PIL images."""
    assert lpips_metric is not None
    t_base = _tensor_01_to_neg11(_pil_to_tensor_01(baseline_img))
    t_curr = _tensor_01_to_neg11(_pil_to_tensor_01(current_img))
    with torch.no_grad():
        score = lpips_metric(t_curr, t_base)
    return float(score.item())


def _compute_dino_embedding(img: Image.Image) -> list[float]:
    """Return DINOv2 CLS embedding for a single PIL image."""
    assert dino_model is not None and dino_processor is not None
    inputs = dino_processor(images=img, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        outputs = dino_model(**inputs)
    # CLS token is the first token in last_hidden_state
    cls_embedding: torch.Tensor = outputs.last_hidden_state[:, 0, :]  # (1, D)
    return cls_embedding.squeeze(0).cpu().tolist()


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two flat vectors."""
    va = np.asarray(a, dtype=np.float32)
    vb = np.asarray(b, dtype=np.float32)
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    if denom == 0.0:
        return 0.0
    return float(np.dot(va, vb) / denom)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@app.get("/health")
async def health() -> dict[str, Any]:
    """Lightweight health check — no model inference."""
    models_loaded: list[str] = []
    if ssim_metric is not None:
        models_loaded.append("ssim")
    if lpips_metric is not None:
        models_loaded.append("lpips")
    if dino_model is not None:
        models_loaded.append("dinov2")

    return {
        "status": "ok",
        "models_loaded": models_loaded,
        "gpu_available": GPU_AVAILABLE,
        "device": str(DEVICE),
    }


@app.post("/similarity/all")
async def similarity_all(
    baseline: UploadFile = File(...),
    current: UploadFile = File(...),
) -> dict[str, Any]:
    """Compute SSIM, LPIPS, and DINOv2 cosine similarity in one request."""
    baseline_bytes = await baseline.read()
    current_bytes = await current.read()

    if not baseline_bytes:
        raise HTTPException(status_code=400, detail="Baseline image is empty")
    if not current_bytes:
        raise HTTPException(status_code=400, detail="Current image is empty")

    try:
        baseline_img = _resize_if_needed(_read_image(baseline_bytes))
        current_img = _resize_if_needed(_read_image(current_bytes))
        baseline_img, current_img = _ensure_same_size(baseline_img, current_img)

        ssim_score = _compute_ssim(baseline_img, current_img)
        lpips_score = _compute_lpips(baseline_img, current_img)

        baseline_emb = _compute_dino_embedding(baseline_img)
        current_emb = _compute_dino_embedding(current_img)
        dino_score = _cosine_similarity(baseline_emb, current_emb)

        return {
            "ssim": {"score": round(ssim_score, 6)},
            "lpips": {"score": round(lpips_score, 6)},
            "dino_cosine": {"score": round(dino_score, 6)},
            "baseline_embedding": baseline_emb,
            "current_embedding": current_emb,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing similarity metrics")
        raise HTTPException(status_code=500, detail=f"Similarity computation failed: {exc}") from exc


@app.post("/similarity/ssim")
async def similarity_ssim(
    baseline: UploadFile = File(...),
    current: UploadFile = File(...),
) -> dict[str, Any]:
    """Compute SSIM only."""
    baseline_bytes = await baseline.read()
    current_bytes = await current.read()

    if not baseline_bytes:
        raise HTTPException(status_code=400, detail="Baseline image is empty")
    if not current_bytes:
        raise HTTPException(status_code=400, detail="Current image is empty")

    try:
        baseline_img = _resize_if_needed(_read_image(baseline_bytes))
        current_img = _resize_if_needed(_read_image(current_bytes))
        baseline_img, current_img = _ensure_same_size(baseline_img, current_img)

        ssim_score = _compute_ssim(baseline_img, current_img)

        return {"ssim": {"score": round(ssim_score, 6)}}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing SSIM")
        raise HTTPException(status_code=500, detail=f"SSIM computation failed: {exc}") from exc


@app.post("/similarity/lpips")
async def similarity_lpips(
    baseline: UploadFile = File(...),
    current: UploadFile = File(...),
) -> dict[str, Any]:
    """Compute LPIPS only."""
    baseline_bytes = await baseline.read()
    current_bytes = await current.read()

    if not baseline_bytes:
        raise HTTPException(status_code=400, detail="Baseline image is empty")
    if not current_bytes:
        raise HTTPException(status_code=400, detail="Current image is empty")

    try:
        baseline_img = _resize_if_needed(_read_image(baseline_bytes))
        current_img = _resize_if_needed(_read_image(current_bytes))
        baseline_img, current_img = _ensure_same_size(baseline_img, current_img)

        lpips_score = _compute_lpips(baseline_img, current_img)

        return {"lpips": {"score": round(lpips_score, 6)}}
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing LPIPS")
        raise HTTPException(status_code=500, detail=f"LPIPS computation failed: {exc}") from exc


@app.post("/embeddings/image")
async def embeddings_image(
    image: UploadFile = File(...),
) -> dict[str, Any]:
    """Extract DINOv2 CLS embedding for a single image."""
    image_bytes = await image.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="Image is empty")

    try:
        img = _resize_if_needed(_read_image(image_bytes))
        embedding = _compute_dino_embedding(img)

        return {
            "embedding": embedding,
            "model": DINO_MODEL_NAME,
            "dimensions": len(embedding),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Error computing embedding")
        raise HTTPException(status_code=500, detail=f"Embedding computation failed: {exc}") from exc


# ---------------------------------------------------------------------------
# Global error handler
# ---------------------------------------------------------------------------


@app.exception_handler(Exception)
async def _unhandled_exception(request: Any, exc: Exception) -> JSONResponse:  # noqa: ARG001
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {type(exc).__name__}: {exc}"},
    )

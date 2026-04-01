"""
VisionTest AI - Embeddings Sidecar

FastAPI service that computes SSIM, LPIPS, and DINOv2 embeddings for
visual regression image comparison.
"""

import io
import os
from contextlib import asynccontextmanager
from typing import Any

import lpips as lpips_lib
import numpy as np
import torch
from fastapi import FastAPI, File, UploadFile
from PIL import Image
from skimage.metrics import structural_similarity as ssim
from torchvision import transforms
from transformers import AutoImageProcessor, AutoModel


# ---------------------------------------------------------------------------
# Globals populated at startup
# ---------------------------------------------------------------------------
device: torch.device = torch.device("cpu")
dino_model: Any = None
dino_processor: Any = None
lpips_model: Any = None
loaded_models: list[str] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detect_device() -> torch.device:
    """Pick the best available device (env override or auto-detect)."""
    env = os.getenv("TORCH_DEVICE", "").lower()
    if env:
        return torch.device(env)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _load_image(data: bytes) -> Image.Image:
    """Open raw bytes as an RGB PIL Image."""
    return Image.open(io.BytesIO(data)).convert("RGB")


def _image_to_numpy(img: Image.Image) -> np.ndarray:
    """Convert PIL Image to uint8 numpy array (H, W, C)."""
    return np.asarray(img, dtype=np.uint8)


def _resize_to_match(
    base: np.ndarray, current: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """If dimensions differ, resize *current* to match *base*."""
    if base.shape != current.shape:
        h, w = base.shape[:2]
        current_pil = Image.fromarray(current).resize((w, h), Image.LANCZOS)
        current = np.asarray(current_pil, dtype=np.uint8)
    return base, current


# ---------------------------------------------------------------------------
# Metric helpers
# ---------------------------------------------------------------------------

def compute_ssim(base_img: Image.Image, curr_img: Image.Image) -> float:
    """Compute SSIM between two images."""
    base_np = _image_to_numpy(base_img)
    curr_np = _image_to_numpy(curr_img)
    base_np, curr_np = _resize_to_match(base_np, curr_np)

    score = ssim(base_np, curr_np, channel_axis=2)
    return float(score)


def compute_lpips(base_img: Image.Image, curr_img: Image.Image) -> float:
    """Compute LPIPS distance between two images."""
    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])

    base_tensor = transform(base_img).unsqueeze(0).to(device)
    curr_tensor = transform(curr_img).unsqueeze(0).to(device)

    with torch.no_grad():
        distance = lpips_model(base_tensor, curr_tensor)

    return float(distance.item())


def compute_embedding(img: Image.Image) -> list[float]:
    """Extract DINOv2 CLS token embedding for an image."""
    inputs = dino_processor(images=img, return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = dino_model(**inputs)

    cls_embedding = outputs.last_hidden_state[:, 0, :]
    embedding = cls_embedding.squeeze().cpu().numpy()
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding.tolist()


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Cosine similarity between two vectors via numpy dot product."""
    va = np.array(a, dtype=np.float64)
    vb = np.array(b, dtype=np.float64)
    dot = np.dot(va, vb)
    norm_a = np.linalg.norm(va)
    norm_b = np.linalg.norm(vb)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# Lifespan — load models once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    global device, dino_model, dino_processor, lpips_model, loaded_models

    device = _detect_device()
    print(f"[embeddings] Using device: {device}")

    # DINOv2
    print("[embeddings] Loading DINOv2-base ...")
    dino_processor = AutoImageProcessor.from_pretrained("facebook/dinov2-base")
    dino_model = AutoModel.from_pretrained("facebook/dinov2-base").to(device).eval()
    loaded_models.append("dinov2-base")
    print("[embeddings] DINOv2-base loaded.")

    # LPIPS
    print("[embeddings] Loading LPIPS (AlexNet) ...")
    lpips_model = lpips_lib.LPIPS(net="alex").to(device).eval()
    loaded_models.append("lpips-alex")
    print("[embeddings] LPIPS loaded.")

    print("[embeddings] All models ready.")
    yield

    # Cleanup
    del dino_model, dino_processor, lpips_model
    torch.cuda.empty_cache() if torch.cuda.is_available() else None


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="VisionTest Embeddings Sidecar",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "models": loaded_models,
        "gpu_available": torch.cuda.is_available(),
        "device": str(device),
    }


@app.post("/embeddings/image")
async def embeddings_image(file: UploadFile = File(...)):
    """Compute DINOv2 embedding for a single image."""
    data = await file.read()
    img = _load_image(data)
    embedding = compute_embedding(img)
    return {
        "embedding": embedding,
        "dimensions": len(embedding),
    }


@app.post("/similarity/ssim")
async def similarity_ssim(
    baseline: UploadFile = File(...),
    current: UploadFile = File(...),
):
    """Compute SSIM score between baseline and current images."""
    base_data = await baseline.read()
    curr_data = await current.read()
    base_img = _load_image(base_data)
    curr_img = _load_image(curr_data)

    score = compute_ssim(base_img, curr_img)
    return {"ssim": score}


@app.post("/similarity/lpips")
async def similarity_lpips(
    baseline: UploadFile = File(...),
    current: UploadFile = File(...),
):
    """Compute LPIPS distance between baseline and current images."""
    base_data = await baseline.read()
    curr_data = await current.read()
    base_img = _load_image(base_data)
    curr_img = _load_image(curr_data)

    score = compute_lpips(base_img, curr_img)
    return {"lpips": score}


@app.post("/similarity/all")
async def similarity_all(
    baseline: UploadFile = File(...),
    current: UploadFile = File(...),
):
    """Compute all similarity metrics and embeddings in one request."""
    base_data = await baseline.read()
    curr_data = await current.read()
    base_img = _load_image(base_data)
    curr_img = _load_image(curr_data)

    ssim_score = compute_ssim(base_img, curr_img)
    lpips_score = compute_lpips(base_img, curr_img)
    base_embedding = compute_embedding(base_img)
    curr_embedding = compute_embedding(curr_img)
    dino_similarity = cosine_similarity(base_embedding, curr_embedding)

    return {
        "ssim": ssim_score,
        "lpips": lpips_score,
        "dino_cosine_similarity": dino_similarity,
        "baseline_embedding": base_embedding,
        "current_embedding": curr_embedding,
        "embedding_dimensions": len(base_embedding),
    }

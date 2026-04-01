FROM python:3.11-slim

# System dependencies for OpenCV / scikit-image
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgl1-mesa-glx \
        libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download models at build time so startup is fast
RUN python -c "\
from transformers import AutoImageProcessor, AutoModel; \
AutoImageProcessor.from_pretrained('facebook/dinov2-base'); \
AutoModel.from_pretrained('facebook/dinov2-base'); \
print('DINOv2-base downloaded')"

RUN python -c "\
import lpips; \
lpips.LPIPS(net='alex'); \
print('LPIPS AlexNet downloaded')"

# Copy application code
COPY app/ app/

EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]

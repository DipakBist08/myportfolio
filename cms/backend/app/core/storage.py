"""
Local file-system storage for uploaded media.
Swap this module out for S3/Cloudflare R2 in production.
"""
import os, uuid, shutil
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException, status

from app.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"}
ALLOWED_TYPES = ALLOWED_IMAGE_TYPES | {
    "application/pdf",
    "text/plain",
    "application/zip",
}


def _upload_root() -> Path:
    p = Path(settings.UPLOAD_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _sub_dir(mime_type: str) -> str:
    if mime_type.startswith("image/"):
        return "images"
    return "files"


async def save_upload(file: UploadFile) -> dict:
    """Persist an uploaded file and return metadata dict."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File type '{file.content_type}' not allowed.",
        )

    # Read & check size
    contents = await file.read()
    if len(contents) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 10 MB).",
        )

    ext = Path(file.filename or "file").suffix.lower()
    stored_name = f"{uuid.uuid4().hex}{ext}"
    sub = _sub_dir(file.content_type)
    dest_dir = _upload_root() / sub
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / stored_name

    with open(dest_path, "wb") as f:
        f.write(contents)

    # Image dimensions
    width = height = None
    if file.content_type.startswith("image/") and file.content_type != "image/svg+xml":
        try:
            from PIL import Image
            with Image.open(dest_path) as img:
                width, height = img.size
        except Exception:
            pass

    rel_path = f"{sub}/{stored_name}"
    url = f"{settings.BACKEND_URL}/uploads/{rel_path}"

    return {
        "filename": stored_name,
        "original_filename": file.filename or stored_name,
        "file_path": rel_path,
        "url": url,
        "mime_type": file.content_type,
        "file_size": len(contents),
        "width": width,
        "height": height,
    }


def delete_file(file_path: str) -> bool:
    full = _upload_root() / file_path
    if full.exists():
        full.unlink()
        return True
    return False

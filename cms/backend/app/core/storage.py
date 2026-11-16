"""
Local file-system storage for uploaded media.
Swap this module out for S3/Cloudflare R2 in production.
"""
import io, uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException, status

from app.config import settings

# Accepted types and the extension each is stored under. The extension comes
# from this table, never from the uploaded file name, so /uploads always
# serves a file with the Content-Type of what it really contains. SVG is not
# accepted: an SVG is a document that can run script.
STORED_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/zip": ".zip",
}
ALLOWED_IMAGE_TYPES = {t for t in STORED_EXTENSION if t.startswith("image/")}
ALLOWED_TYPES = set(STORED_EXTENSION)

# Other names browsers give the same types (Windows reports zip files as
# application/x-zip-compressed).
_TYPE_ALIASES = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "application/x-zip-compressed": "application/zip",
}
_PIL_FORMAT = {"image/jpeg": "JPEG", "image/png": "PNG", "image/gif": "GIF", "image/webp": "WEBP"}


def sniff_type(data: bytes) -> Optional[str]:
    """The accepted type `data` really is, from its first bytes; None if none."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"%PDF-"):
        return "application/pdf"
    if data[:4] in (b"PK\x03\x04", b"PK\x05\x06"):
        return "application/zip"
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return None
    return None if "\x00" in text else "text/plain"


def _upload_root() -> Path:
    p = Path(settings.UPLOAD_DIR)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _sub_dir(mime_type: str) -> str:
    if mime_type.startswith("image/"):
        return "images"
    return "files"


def _reject(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=detail)


async def save_upload(file: UploadFile) -> dict:
    """Persist an uploaded file and return metadata dict."""
    claimed = (file.content_type or "").split(";")[0].strip().lower()
    claimed = _TYPE_ALIASES.get(claimed, claimed)
    if claimed == "image/svg+xml":
        raise _reject("SVG files are not accepted because they can contain scripts. Upload a PNG or WebP instead.")
    if claimed not in ALLOWED_TYPES:
        raise _reject(f"File type '{file.content_type}' not allowed.")

    # Read at most one byte past the limit, so an oversized upload is never
    # held in memory in full.
    contents = await file.read(settings.MAX_FILE_SIZE + 1)
    if len(contents) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large (max 10 MB).",
        )
    if not contents:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="The file is empty.")

    # Trust the bytes, not the browser's label or the file name.
    if sniff_type(contents) != claimed:
        raise _reject("The file's content does not match its type.")

    width = height = None
    if claimed in ALLOWED_IMAGE_TYPES:
        try:
            from PIL import Image
            with Image.open(io.BytesIO(contents)) as img:
                if img.format != _PIL_FORMAT[claimed]:
                    raise ValueError(img.format)
                width, height = img.size
                img.verify()
        except Exception:
            raise _reject("The image could not be read. It may be damaged.")

    stored_name = f"{uuid.uuid4().hex}{STORED_EXTENSION[claimed]}"
    sub = _sub_dir(claimed)
    dest_dir = _upload_root() / sub
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / stored_name

    with open(dest_path, "wb") as f:
        f.write(contents)

    rel_path = f"{sub}/{stored_name}"
    url = f"{settings.BACKEND_URL}/uploads/{rel_path}"

    return {
        "filename": stored_name,
        "original_filename": file.filename or stored_name,
        "file_path": rel_path,
        "url": url,
        "mime_type": claimed,
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

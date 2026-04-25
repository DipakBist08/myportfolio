from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.media import Media
from app.schemas.media import MediaOut, MediaUpdate, PaginatedMedia
from app.core.storage import save_upload, delete_file

router = APIRouter(prefix="/media", tags=["Admin – Media"])


@router.post("/upload", response_model=MediaOut, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meta = await save_upload(file)
    media = Media(**meta, uploaded_by_id=current_user.id)
    db.add(media)
    db.commit()
    db.refresh(media)
    return media


@router.get("", response_model=PaginatedMedia)
def list_media(
    page: int = Query(1, ge=1),
    page_size: int = Query(24, ge=1, le=100),
    mime_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Media)
    if mime_type:
        q = q.filter(Media.mime_type.startswith(mime_type))
    if search:
        term = f"%{search}%"
        q = q.filter(Media.original_filename.ilike(term) | Media.alt_text.ilike(term))
    total = q.count()
    items = q.order_by(Media.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return PaginatedMedia(items=items, total=total, page=page, page_size=page_size, pages=-(-total // page_size))


@router.patch("/{media_id}", response_model=MediaOut)
def update_media(
    media_id: int, body: MediaUpdate,
    db: Session = Depends(get_db), _: User = Depends(get_current_user),
):
    m = db.query(Media).filter(Media.id == media_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    db.commit()
    db.refresh(m)
    return m


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(media_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    m = db.query(Media).filter(Media.id == media_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Not found")
    delete_file(m.file_path)
    db.delete(m)
    db.commit()

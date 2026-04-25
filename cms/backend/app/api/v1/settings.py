from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Dict, List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.settings import SiteSetting

router = APIRouter(prefix="/settings", tags=["Admin – Settings"])


@router.get("")
def get_settings(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    rows = db.query(SiteSetting).order_by(SiteSetting.category, SiteSetting.key).all()
    result: Dict[str, Dict] = {}
    for r in rows:
        if r.category not in result:
            result[r.category] = {}
        result[r.category][r.key] = {
            "value": r.value, "label": r.label, "description": r.description
        }
    return result


@router.patch("")
def update_settings(
    updates: Dict[str, str],
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    for key, value in updates.items():
        row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(SiteSetting(key=key, value=value))
    db.commit()
    return {"detail": "Settings saved"}

from slugify import slugify as _slugify
from sqlalchemy.orm import Session


def make_slug(text: str) -> str:
    return _slugify(text, max_length=200, word_boundary=True)


def unique_slug(text: str, model, db: Session, exclude_id: int = None) -> str:
    base = make_slug(text)
    slug = base
    n = 1
    while True:
        q = db.query(model).filter(model.slug == slug)
        if exclude_id:
            q = q.filter(model.id != exclude_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def estimate_reading_time(text: str) -> int:
    """Returns estimated minutes (200 wpm average)."""
    words = len(text.split())
    return max(1, round(words / 200))

"""Import the blog's original MDX articles into the CMS, once.

Until 22/11/2026 the blog's articles lived only as files in blog/content/blog/.
blog/scripts/export-posts-for-cms.mjs copies them, front matter and body
unchanged, into app/seed_content/blog_articles.json, and startup imports each
one as a published Markdown (MDX) post with its original date.

- Each slug is imported once. The slugs done are kept in the site setting
  IMPORTED_KEY, so an article deleted in the admin is not imported again.
- A post that already has the slug is left alone (and counted as done).
- Nothing is emailed: these articles were announced long ago.
- Needs an author: if no admin exists yet, it waits for the next start.
"""
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.post import Post, PostStatus
from app.models.settings import SiteSetting
from app.models.tag import Tag
from app.models.user import User
from app.schemas.post import BlogMeta
from app.utils.slug import estimate_reading_time, make_slug

logger = logging.getLogger(__name__)

SEED_FILE = Path(__file__).resolve().parent.parent / "seed_content" / "blog_articles.json"
IMPORTED_KEY = "blog_articles_imported"


def _imported(db: Session) -> tuple[SiteSetting | None, set[str]]:
    row = db.query(SiteSetting).filter(SiteSetting.key == IMPORTED_KEY).first()
    if not row or not row.value:
        return row, set()
    try:
        return row, set(json.loads(row.value))
    except ValueError:
        return row, set()


def imported_slugs(db: Session) -> set[str]:
    """Slugs of the original articles the CMS has taken over (imported or already present)."""
    return _imported(db)[1]


def _category(db: Session, name: str) -> Category | None:
    if not name:
        return None
    cat = db.query(Category).filter(Category.name == name).first()
    if not cat:
        cat = Category(name=name, slug=make_slug(name))
        db.add(cat)
        db.flush()
    return cat


def _tags(db: Session, names: list[str]) -> list[Tag]:
    tags = []
    for name in names:
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name, slug=make_slug(name))
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def _day(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value).replace(hour=9, tzinfo=timezone.utc)


def import_blog_articles(db: Session, seed_file: Path = SEED_FILE) -> list[str]:
    """Import every article not done yet. Returns the slugs imported now."""
    if not seed_file.exists():
        return []
    articles = json.loads(seed_file.read_text(encoding="utf-8"))
    row, done = _imported(db)
    pending = [a for a in articles if a["slug"] not in done]
    if not pending:
        return []

    author = (db.query(User).filter(User.is_superuser == True)  # noqa: E712
              .order_by(User.id).first())
    if not author:
        logger.warning("Blog article import waits: no admin account yet.")
        return []

    imported = []
    for art in pending:
        slug = art["slug"]
        if db.query(Post).filter(Post.slug == slug).first() is None:
            meta = BlogMeta(**art.get("blogMeta", {}))
            body = art["body"]
            post = Post(
                title=art["title"],
                slug=slug,
                content=body,
                content_text=body,
                content_format="mdx",
                excerpt=art.get("excerpt", ""),
                status=PostStatus.PUBLISHED,
                is_featured=bool(art.get("featured")),
                seo_title=art["title"],
                seo_description=art.get("description", ""),
                published_at=_day(art.get("datePublished")),
                reading_time=estimate_reading_time(body),
                blog_meta=json.dumps(meta.model_dump(), ensure_ascii=False),
                author_id=author.id,
                category=_category(db, art.get("category", "")),
                tags=_tags(db, art.get("tags", [])),
            )
            db.add(post)
            imported.append(slug)
        done.add(slug)

    value = json.dumps(sorted(done))
    if row:
        row.value = value
    else:
        db.add(SiteSetting(key=IMPORTED_KEY, value=value, category="system",
                           label="Blog articles imported from files",
                           description="Slugs already imported; deleting a post does not bring it back."))
    db.commit()
    if imported:
        logger.warning("Imported %d blog article(s) from files: %s", len(imported), ", ".join(imported))
    return imported

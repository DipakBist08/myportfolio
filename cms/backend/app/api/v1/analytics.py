from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.post import Post, PostStatus
from app.models.analytics import AnalyticsEvent
from app.models.subscriber import Subscriber
from app.models.category import Category
from app.models.tag import Tag

router = APIRouter(prefix="/analytics", tags=["Admin – Analytics"])


@router.get("/dashboard")
def dashboard_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    total_posts = db.query(Post).count()
    published = db.query(Post).filter(Post.status == PostStatus.PUBLISHED).count()
    drafts = db.query(Post).filter(Post.status == PostStatus.DRAFT).count()
    total_views = db.query(func.sum(Post.view_count)).scalar() or 0
    total_subscribers = db.query(Subscriber).filter(Subscriber.is_active == True).count()
    total_categories = db.query(Category).count()
    total_tags = db.query(Tag).count()
    new_subscribers_30d = db.query(Subscriber).filter(
        Subscriber.subscribed_at >= thirty_days_ago,
        Subscriber.is_active == True,
    ).count()

    # Recent posts (last 5 published)
    recent_posts = db.query(Post).filter(Post.status == PostStatus.PUBLISHED).order_by(
        Post.published_at.desc()
    ).limit(5).all()

    # Top posts by views
    top_posts = db.query(Post).filter(Post.status == PostStatus.PUBLISHED).order_by(
        Post.view_count.desc()
    ).limit(5).all()

    # Views per day last 7 days
    views_per_day = (
        db.query(
            func.date(AnalyticsEvent.created_at).label("day"),
            func.count().label("count"),
        )
        .filter(
            AnalyticsEvent.event_type == "view",
            AnalyticsEvent.created_at >= seven_days_ago,
        )
        .group_by("day")
        .order_by("day")
        .all()
    )

    return {
        "total_posts": total_posts,
        "published_posts": published,
        "draft_posts": drafts,
        "total_views": int(total_views),
        "total_subscribers": total_subscribers,
        "new_subscribers_30d": new_subscribers_30d,
        "total_categories": total_categories,
        "total_tags": total_tags,
        "recent_posts": [
            {"id": p.id, "title": p.title, "slug": p.slug, "views": p.view_count}
            for p in recent_posts
        ],
        "top_posts": [
            {"id": p.id, "title": p.title, "slug": p.slug, "views": p.view_count}
            for p in top_posts
        ],
        "views_chart": [{"day": str(r.day), "views": r.count} for r in views_per_day],
    }


@router.post("/event")
def track_event(
    post_id: int = None,
    event_type: str = "view",
    referrer: str = "",
    db: Session = Depends(get_db),
):
    """Called by the public frontend to record page views."""
    db.add(AnalyticsEvent(post_id=post_id, event_type=event_type, referrer=referrer[:500]))
    if post_id and event_type == "view":
        db.query(Post).filter(Post.id == post_id).update(
            {Post.view_count: Post.view_count + 1}
        )
    db.commit()
    return {"ok": True}

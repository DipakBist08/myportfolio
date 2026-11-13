from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import case, distinct, func

from app.database import get_db
from app.models.comment import Comment
from app.models.traffic import CommentReaction, PageView, utcnow
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


@router.get("/traffic")
def traffic(
    days: int = Query(30, ge=1, le=365),
    tz_offset: int = Query(0, ge=-720, le=840, description="Minutes east of UTC, so days match the admin's clock"),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Visitors and page views for the portfolio and the blog (page_views),
    plus per-post views, readers, comments and reactions for the blog."""
    shift = f"{tz_offset:+d} minutes"
    local_day = func.date(PageView.created_at, shift)
    today = (utcnow() + timedelta(minutes=tz_offset)).date()
    first_day = today - timedelta(days=days - 1)

    def visits_and_visitors(*conditions) -> tuple[int, int]:
        visits, visitors = (
            db.query(func.count(PageView.id), func.count(distinct(PageView.visitor_hash)))
            .filter(*conditions)
            .one()
        )
        return int(visits), int(visitors)

    in_period = local_day >= first_day.isoformat()
    visits_total, visitors_total = visits_and_visitors()
    visits_today, visitors_today = visits_and_visitors(local_day == today.isoformat())
    visits_period, visitors_period = visits_and_visitors(in_period)

    per_day = {
        day: (int(v), int(u))
        for day, v, u in db.query(local_day, func.count(PageView.id), func.count(distinct(PageView.visitor_hash)))
        .filter(in_period)
        .group_by(local_day)
        .all()
    }
    chart = []
    for i in range(days):
        day = (first_day + timedelta(days=i)).isoformat()
        v, u = per_day.get(day, (0, 0))
        chart.append({"day": day, "visits": v, "visitors": u})

    by_site = [
        {"site": site, "visits": int(v), "visitors": int(u)}
        for site, v, u in db.query(PageView.site, func.count(PageView.id), func.count(distinct(PageView.visitor_hash)))
        .filter(in_period)
        .group_by(PageView.site)
        .order_by(func.count(PageView.id).desc())
        .all()
    ]

    top_pages = [
        {"site": site, "path": path, "title": title or "", "visits": int(v), "visitors": int(u)}
        for site, path, title, v, u in db.query(
            PageView.site, PageView.path, func.max(PageView.title),
            func.count(PageView.id), func.count(distinct(PageView.visitor_hash)),
        )
        .filter(in_period)
        .group_by(PageView.site, PageView.path)
        .order_by(func.count(PageView.id).desc())
        .limit(10)
        .all()
    ]

    # Blog posts, all time: every slug that has been read or commented on.
    posts: dict[str, dict] = {}

    def entry(slug: str) -> dict:
        return posts.setdefault(slug, {"slug": slug, "title": "", "views": 0, "readers": 0,
                                       "comments": 0, "likes": 0, "dislikes": 0})

    for slug, title, v, u in db.query(
        PageView.post_slug, func.max(PageView.title), func.count(PageView.id), func.count(distinct(PageView.visitor_hash)),
    ).filter(PageView.post_slug.isnot(None)).group_by(PageView.post_slug).all():
        row = entry(slug)
        row.update(title=title or "", views=int(v), readers=int(u))
    for slug, n in db.query(Comment.post_slug, func.count(Comment.id)).group_by(Comment.post_slug).all():
        entry(slug)["comments"] = int(n)
    for slug, likes, dislikes in (
        db.query(
            Comment.post_slug,
            func.sum(case((CommentReaction.value > 0, 1), else_=0)),
            func.sum(case((CommentReaction.value < 0, 1), else_=0)),
        )
        .join(CommentReaction, CommentReaction.comment_id == Comment.id)
        .group_by(Comment.post_slug)
        .all()
    ):
        entry(slug).update(likes=int(likes or 0), dislikes=int(dislikes or 0))

    return {
        "days": days,
        "today": today.isoformat(),
        "visits_total": visits_total,
        "visitors_total": visitors_total,
        "visits_today": visits_today,
        "visitors_today": visitors_today,
        "visits_period": visits_period,
        "visitors_period": visitors_period,
        "chart": chart,
        "by_site": by_site,
        "top_pages": top_pages,
        "posts": sorted(posts.values(), key=lambda p: (-p["views"], -p["comments"], p["slug"])),
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

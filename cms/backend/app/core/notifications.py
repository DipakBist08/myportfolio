"""
Announce a newly published post to confirmed subscribers.

Runs from a FastAPI BackgroundTask, so it opens its own database session — the
request-scoped session from `get_db` is already closed by the time this runs.

The guard against double-sending lives in the `post_notifications` table: if a
successful row already exists for a post, the announcement is skipped. That is
what makes re-publishing, editing a published post, or a bulk status change
safe to do without emailing the list again.
"""
import html
import logging

from app.config import settings
from app.database import SessionLocal
from app.core.email import send_newsletter
from app.models.post import Post, PostStatus
from app.models.post_notification import PostNotification
from app.models.subscriber import Subscriber

logger = logging.getLogger(__name__)


def _post_url(post: Post) -> str:
    return f"{settings.BLOG_URL.rstrip('/')}/blog/{post.slug}"


def build_announcement_html(post: Post) -> str:
    """Announcement body. send_newsletter() appends the unsubscribe footer."""
    url = _post_url(post)
    title = html.escape(post.title or "New post")
    excerpt = html.escape((post.excerpt or "").strip())
    reading = f"{post.reading_time} min read" if getattr(post, "reading_time", None) else ""

    cover = ""
    if post.featured_image:
        alt = html.escape(post.featured_image_alt or title)
        cover = (
            f'<img src="{html.escape(post.featured_image)}" alt="{alt}" '
            f'style="width:100%;border-radius:8px;margin:0 0 20px" />'
        )

    meta = f'<p style="color:#94a3b8;font-size:13px;margin:0 0 16px">{reading}</p>' if reading else ""
    body = f'<p style="font-size:15px;line-height:1.6;color:#475569">{excerpt}</p>' if excerpt else ""

    return f"""
    <p style="color:#6366f1;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">
      New post
    </p>
    <h1 style="font-size:22px;line-height:1.3;color:#0f172a;margin:0 0 12px">{title}</h1>
    {meta}
    {cover}
    {body}
    <p style="margin:28px 0">
      <a href="{url}"
         style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
        Read the full post
      </a>
    </p>
    """


def already_announced(db, post_id: int) -> bool:
    return (
        db.query(PostNotification)
        .filter(
            PostNotification.post_id == post_id,
            PostNotification.status.in_(PostNotification.SUCCESSFUL),
        )
        .first()
        is not None
    )


async def announce_post(post_id: int) -> dict:
    """
    Send the announcement for `post_id` and record the outcome.

    Safe to call more than once: the second call short-circuits on the guard.
    Never raises — a failed announcement must not take down whatever triggered
    it. The outcome is always written to post_notifications.
    """
    db = SessionLocal()
    try:
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            logger.warning("announce_post: post %s no longer exists", post_id)
            return {"skipped": "post missing"}

        if post.status != PostStatus.PUBLISHED:
            logger.info("announce_post: post %s is not published, skipping", post_id)
            return {"skipped": "not published"}

        if already_announced(db, post_id):
            logger.info("announce_post: post %s already announced, skipping", post_id)
            return {"skipped": "already announced"}

        subs = (
            db.query(Subscriber)
            .filter(
                Subscriber.is_active == True,  # noqa: E712 — SQLAlchemy needs ==
                Subscriber.is_unsubscribed == False,  # noqa: E712
            )
            .all()
        )

        if not subs:
            db.add(PostNotification(
                post_id=post_id, status="skipped", recipients=0, failed=0,
                error="No active subscribers at publish time.", delivered=0,
            ))
            db.commit()
            logger.info("announce_post: no active subscribers for post %s", post_id)
            return {"skipped": "no subscribers"}

        recipients = [
            {
                "email": s.email,
                "name": s.name or "",
                "unsubscribe_token": s.unsubscribe_token or "",
            }
            for s in subs
        ]

        subject = post.title or "New post on the QA Blog"
        try:
            result = await send_newsletter(
                recipients,
                subject=subject,
                content_html=build_announcement_html(post),
                blog_url=_post_url(post),
            )
        except Exception as exc:  # pragma: no cover — defensive
            logger.exception("announce_post: send failed outright for post %s", post_id)
            db.add(PostNotification(
                post_id=post_id, status="failed",
                recipients=0, failed=len(recipients), error=str(exc)[:2000],
                delivered=0,
            ))
            db.commit()
            return {"error": str(exc)}

        sent = result.get("sent", 0)
        failed = result.get("failed", 0)
        errors = result.get("errors", []) or []

        if failed and sent:
            status = "partial"
        elif failed:
            status = "failed"
        else:
            status = "sent"

        db.add(PostNotification(
            post_id=post_id,
            status=status,
            recipients=sent,
            failed=failed,
            error=("\n".join(errors)[:2000] or None),
            # emails_enabled False means send_newsletter only logged the send
            delivered=1 if settings.emails_enabled else 0,
        ))
        db.commit()

        logger.info(
            "announce_post: post %s -> %s (%d sent, %d failed, delivered=%s)",
            post_id, status, sent, failed, settings.emails_enabled,
        )
        return {"status": status, "sent": sent, "failed": failed}
    finally:
        db.close()


async def announce_post_if_enabled(post_id: int) -> dict:
    """Entry point for the publish hooks — respects the global kill switch."""
    if not settings.NOTIFY_SUBSCRIBERS_ON_PUBLISH:
        logger.info(
            "announce_post: NOTIFY_SUBSCRIBERS_ON_PUBLISH is off, skipping post %s",
            post_id,
        )
        return {"skipped": "disabled"}
    return await announce_post(post_id)

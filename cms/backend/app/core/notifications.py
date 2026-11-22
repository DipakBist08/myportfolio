"""
Announce a newly published post to confirmed subscribers.

Runs from a FastAPI BackgroundTask, so it opens its own database session — the
request-scoped session from `get_db` is already closed by the time this runs.

The guard against double-sending lives in the `post_notifications` table: if a
successful row already exists for a post, the announcement is skipped. That is
what makes re-publishing, editing a published post, or a bulk status change
safe to do without emailing the list again.
"""
import asyncio
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


# ── Announcing posts that live outside the CMS ────────────────────────────────
#
# The hooks above fire from the CMS post endpoints. In practice the blog is a
# Next.js app rendering MDX files, so /api/public/posts is empty and those hooks
# never run for a real article. This path reads the blog's own RSS feed — the
# artefact the actual publishing flow produces — and announces the newest entry.

import re
import xml.etree.ElementTree as ET

import httpx

from app.models.announcement import Announcement


def _rss_url() -> str:
    return f"{settings.BLOG_URL.rstrip('/')}/rss.xml"


def _strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", "", text or "").strip()


async def fetch_feed_posts(timeout: float = 10.0) -> list[dict]:
    """Every <item> in the blog RSS, in feed order (newest first)."""
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(_rss_url())
        resp.raise_for_status()
        root = ET.fromstring(resp.text)

    posts = []
    for item in root.iter("item"):
        def text(tag: str) -> str:
            el = item.find(tag)
            return (el.text or "").strip() if el is not None and el.text else ""

        link = text("link") or text("guid")
        if not link:
            continue
        posts.append({
            "title": text("title") or "New post",
            "link": link,
            "description": _strip_html(text("description"))[:400],
            "published": text("pubDate"),
        })
    return posts


async def fetch_latest_post(timeout: float = 10.0) -> dict | None:
    """Newest <item> from the blog RSS, or None if the feed has none."""
    posts = await fetch_feed_posts(timeout)
    return posts[0] if posts else None


def build_rss_announcement_html(post: dict) -> str:
    title = html.escape(post["title"])
    body = html.escape(post["description"])
    url = post["link"]
    return f"""
    <p style="color:#6366f1;font-size:13px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px">
      New post
    </p>
    <h1 style="font-size:22px;line-height:1.3;color:#0f172a;margin:0 0 12px">{title}</h1>
    <p style="font-size:15px;line-height:1.6;color:#475569">{body}</p>
    <p style="margin:28px 0">
      <a href="{url}"
         style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">
        Read the full post
      </a>
    </p>
    """


async def announce_latest_from_rss(force: bool = False) -> dict:
    """
    Announce the newest post in the blog RSS feed to confirmed subscribers.

    Idempotent: the post's RSS link is recorded in `announcements`, so calling
    this repeatedly (or on a schedule) will not email the same article twice.
    Pass force=True only to deliberately resend.
    """
    try:
        post = await fetch_latest_post()
    except Exception as exc:
        logger.exception("announce_latest_from_rss: could not read %s", _rss_url())
        return {"error": f"could not read the blog feed: {exc}"}

    if not post:
        return {"error": "the blog feed contained no posts"}

    db = SessionLocal()
    try:
        existing = (db.query(Announcement)
                    .filter(Announcement.source_key == post["link"])
                    .first())
        if existing and existing.status in Announcement.SUCCESSFUL and not force:
            return {"skipped": "already announced", "title": post["title"],
                    "announced_at": str(existing.created_at)}

        subs = _active_subscribers(db)
        if not subs:
            return {"skipped": "no confirmed subscribers", "title": post["title"]}

        return await _send_and_record(db, post, existing, subs)
    finally:
        db.close()


def _active_subscribers(db) -> list:
    return (db.query(Subscriber)
            .filter(Subscriber.is_active == True,          # noqa: E712
                    Subscriber.is_unsubscribed == False)   # noqa: E712
            .all())


def _record(db, post: dict, existing, status: str, sent: int = 0, failed: int = 0,
            error: str | None = None) -> None:
    if existing:
        existing.status, existing.recipients, existing.failed = status, sent, failed
        existing.error = error
        existing.delivered = 1 if settings.emails_enabled else 0
        existing.title = post["title"]
    else:
        db.add(Announcement(
            source_key=post["link"], title=post["title"], status=status,
            recipients=sent, failed=failed, error=error,
            delivered=1 if settings.emails_enabled else 0,
        ))
    db.commit()


async def _send_and_record(db, post: dict, existing, subs: list) -> dict:
    """Email one feed article to `subs` and record the outcome."""
    recipients = [{"email": s.email, "name": s.name or "",
                   "unsubscribe_token": s.unsubscribe_token or ""} for s in subs]

    result = await send_newsletter(
        recipients,
        subject=post["title"],
        content_html=build_rss_announcement_html(post),
        blog_url=post["link"],
    )

    sent, failed = result.get("sent", 0), result.get("failed", 0)
    status = "partial" if (failed and sent) else ("failed" if failed else "sent")
    errors = "\n".join(result.get("errors", []) or [])[:2000] or None
    _record(db, post, existing, status, sent, failed, errors)

    logger.info("announce: %r -> %s (%d sent, %d failed)", post["title"], status, sent, failed)
    return {"status": status, "title": post["title"], "link": post["link"],
            "sent": sent, "failed": failed,
            "delivered": bool(settings.emails_enabled)}


# ── Automatic announcements ───────────────────────────────────────────────────
#
# A scheduled job (.github/workflows/announce-new-articles.yml) calls
# POST /api/public/announcements/check, which runs announce_new_from_rss().
# Every article that appears in the blog feed is emailed to subscribers once.

# Recorded the first time the automatic check runs. Articles already in the feed
# at that moment are marked "skipped", so switching this on, or a database that
# starts empty, never emails the list about old articles.
BASELINE_KEY = "auto:baseline"

# More new articles than this in one check is not someone publishing; it is the
# feed itself changing (for example the post URLs or BLOG_URL). Those are
# recorded as skipped rather than emailing the list about every old article.
MAX_NEW_PER_CHECK = 3

_check_lock = asyncio.Lock()


def _feed_slug(link: str) -> str:
    """The post slug in a feed link such as https://blog.dipakbist.com.np/blog/<slug>."""
    from urllib.parse import urlparse
    path = urlparse(link).path.rstrip("/")
    return path.rsplit("/", 1)[-1] if "/blog/" in path + "/" else ""


async def announce_new_from_rss() -> dict:
    """
    Email subscribers about each article in the blog feed not yet announced.

    Safe to call as often as you like: an article is announced once. A failed
    send (for example while RESEND_API_KEY is unset) is retried on the next call.
    The answer lists article titles only, never subscribers or their number,
    because the endpoint that calls this is public.
    """
    if _check_lock.locked():
        return {"skipped": "a check is already running"}
    async with _check_lock:
        try:
            posts = await fetch_feed_posts()
        except Exception:
            logger.exception("announce_new_from_rss: could not read %s", _rss_url())
            return {"error": "could not read the blog feed"}

        db = SessionLocal()
        try:
            rows = {a.source_key: a for a in db.query(Announcement).all()}

            if BASELINE_KEY not in rows:
                marked = 0
                for post in posts:
                    row = rows.get(post["link"])
                    if row is None or row.status not in Announcement.SUCCESSFUL:
                        _record(db, post, row, "skipped",
                                error="Already in the feed when automatic announcements started.")
                        marked += 1
                _record(db, {"link": BASELINE_KEY, "title": "Automatic announcements started"},
                        None, "skipped")
                logger.info("announce_new_from_rss: baseline, %d existing articles not announced", marked)
                return {"started": True, "existing_articles_not_announced": marked}

            # Oldest first, so subscribers get articles in publishing order.
            new = [p for p in reversed(posts)
                   if p["link"] not in rows or rows[p["link"]].status == "failed"]

            # Posts written in the CMS appear in the blog feed too, but the CMS
            # announces those itself when they are published (or deliberately
            # not, with "publish quietly"). Emailing them again here would send
            # every CMS post twice.
            cms_slugs = {slug for (slug,) in db.query(Post.slug).all()}
            for post in [p for p in new if _feed_slug(p["link"]) in cms_slugs]:
                _record(db, post, rows.get(post["link"]), "skipped",
                        error="Written in the CMS, which announces its own posts.")
                new.remove(post)
            if not new:
                return {"announced": []}

            if len(new) > MAX_NEW_PER_CHECK:
                for post in new:
                    _record(db, post, rows.get(post["link"]), "skipped",
                            error=f"{len(new)} new articles at once; not announced automatically.")
                logger.warning("announce_new_from_rss: %d new articles at once, none announced", len(new))
                return {"skipped": f"{len(new)} new articles at once; announce them from the admin if wanted"}

            announced = []
            for post in new:
                subs = _active_subscribers(db)
                if not subs:
                    _record(db, post, rows.get(post["link"]), "skipped", error="No subscribers yet.")
                    announced.append({"title": post["title"], "status": "skipped"})
                    continue
                result = await _send_and_record(db, post, rows.get(post["link"]), subs)
                announced.append({"title": post["title"], "status": result["status"]})
            return {"announced": announced}
        finally:
            db.close()

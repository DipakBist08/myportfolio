import secrets
import time
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.subscriber import Subscriber
from app.schemas.subscriber import SubscribeRequest, SubscriberOut, SubscriberStats, NewsletterSendRequest, NewsletterSendResult
from app.core.email import send_confirmation_email, send_newsletter
from app.core.notifications import announce_latest_from_rss, fetch_latest_post
from app.config import settings

router = APIRouter(prefix="/subscribers", tags=["Admin – Subscribers"])

# Simple in-memory rate limiter: max 3 subscribe attempts per IP per 60 s
_subscribe_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 3
_RATE_WINDOW = 60.0


def _check_rate_limit(ip: str) -> None:
    now = time.monotonic()
    window = now - _RATE_WINDOW
    attempts = [t for t in _subscribe_attempts[ip] if t > window]
    if len(attempts) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please wait before trying again.",
            headers={"Retry-After": "60"},
        )
    attempts.append(now)
    _subscribe_attempts[ip] = attempts


# ── Public subscribe endpoint ─────────────────────────────────────────────────

@router.post("/subscribe", status_code=status.HTTP_202_ACCEPTED)
async def subscribe(body: SubscribeRequest, request: Request, db: Session = Depends(get_db)):
    """
    Double opt-in. Previously this marked a new address active immediately, which
    meant anyone could add anyone else's email to the list — and once publish
    announcements went live those forged addresses would receive real mail.
    Complaints from people who never signed up damage the sending domain's
    reputation, so an address is now inert until its owner clicks the link.

    The response is deliberately identical whether or not the address is already
    known, so this endpoint cannot be used to test who is subscribed.
    """
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    GENERIC = {"detail": "Almost there — check your inbox for a confirmation link."}

    existing = db.query(Subscriber).filter(Subscriber.email == body.email).first()

    if existing and existing.is_active and not existing.is_unsubscribed:
        return GENERIC  # already confirmed; say nothing that reveals it

    token = secrets.token_urlsafe(32)

    if existing:
        # Re-subscribing after unsubscribing, or never confirmed the first time.
        existing.is_unsubscribed = False
        existing.unsubscribed_at = None
        existing.is_active = False
        existing.confirmed_at = None
        existing.confirmation_token = token
        if body.name:
            existing.name = body.name
        if not existing.unsubscribe_token:
            existing.unsubscribe_token = secrets.token_urlsafe(32)
        sub = existing
    else:
        sub = Subscriber(
            email=body.email,
            name=body.name,
            is_active=False,
            confirmed_at=None,
            confirmation_token=token,
            unsubscribe_token=secrets.token_urlsafe(32),
        )
        db.add(sub)

    db.commit()

    try:
        await send_confirmation_email(sub.email, sub.name or "", token)
    except Exception:
        # The row is saved; a mail failure should not 500 the visitor. They can
        # simply submit again to trigger a fresh token.
        logging.getLogger(__name__).exception("confirmation email failed for %s", sub.email)

    return GENERIC


def _page(title: str, message: str, ok: bool = True) -> HTMLResponse:
    """Minimal styled page — these URLs are opened from an email client, where a
    raw JSON body looks broken to a non-technical reader."""
    accent = "#6366f1" if ok else "#ef4444"
    return HTMLResponse(f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>{title}</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#f1f5f9;
             display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="max-width:440px;padding:40px;text-align:center">
    <h1 style="color:{accent};font-size:22px;margin:0 0 12px">{title}</h1>
    <p style="color:#94a3b8;line-height:1.6;margin:0 0 28px">{message}</p>
    <a href="{settings.BLOG_URL}" style="background:{accent};color:#fff;padding:12px 24px;
       border-radius:6px;text-decoration:none;font-weight:600">Visit the blog</a>
  </div>
</body></html>""", status_code=200 if ok else 404)


@router.get("/confirm", response_class=HTMLResponse)
def confirm_subscription(token: str, db: Session = Depends(get_db)):
    sub = db.query(Subscriber).filter(Subscriber.confirmation_token == token).first()
    if not sub:
        return _page("Link expired",
                     "That confirmation link is not valid, or it has already been used.",
                     ok=False)
    sub.is_active = True
    sub.is_unsubscribed = False
    sub.confirmed_at = datetime.now(timezone.utc)
    sub.confirmation_token = None   # single use
    db.commit()
    return _page("You're subscribed",
                 "Thanks for confirming. You'll get an email when a new post goes up.")


@router.get("/unsubscribe", response_class=HTMLResponse)
def unsubscribe(token: str, db: Session = Depends(get_db)):
    sub = db.query(Subscriber).filter(Subscriber.unsubscribe_token == token).first()
    if not sub:
        return _page("Link not recognised",
                     "That unsubscribe link is not valid. It may already have been used.",
                     ok=False)
    sub.is_unsubscribed = True
    sub.is_active = False
    sub.unsubscribed_at = datetime.now(timezone.utc)
    db.commit()
    return _page("Unsubscribed",
                 "You will not receive any further emails. Sorry to see you go.")


# ── Admin ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[SubscriberOut])
def list_subscribers(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Subscriber)
    if active_only:
        q = q.filter(Subscriber.is_active == True)
    if search:
        term = f"%{search}%"
        q = q.filter(Subscriber.email.ilike(term) | Subscriber.name.ilike(term))
    return q.order_by(Subscriber.subscribed_at.desc()).offset((page - 1) * page_size).limit(page_size).all()


@router.get("/stats", response_model=SubscriberStats)
def subscriber_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    total = db.query(Subscriber).count()
    active = db.query(Subscriber).filter(Subscriber.is_active == True).count()
    unsub = db.query(Subscriber).filter(Subscriber.is_unsubscribed == True).count()
    pending = db.query(Subscriber).filter(
        Subscriber.is_active == False,
        Subscriber.is_unsubscribed == False,
    ).count()
    return SubscriberStats(total=total, active=active, unsubscribed=unsub, pending=pending)


@router.delete("/{sub_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subscriber(sub_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    sub = db.query(Subscriber).filter(Subscriber.id == sub_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Subscriber not found")
    db.delete(sub)
    db.commit()


@router.post("/send-newsletter", response_model=NewsletterSendResult)
async def send_newsletter_email(
    body: NewsletterSendRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Subscriber).filter(
        Subscriber.is_active == True,
        Subscriber.is_unsubscribed == False,
    )
    if body.subscriber_ids:
        q = q.filter(Subscriber.id.in_(body.subscriber_ids))

    subs = q.all()
    if not subs:
        raise HTTPException(status_code=400, detail="No active subscribers to send to.")

    recipients = [
        {"email": s.email, "name": s.name or "", "unsubscribe_token": s.unsubscribe_token}
        for s in subs
    ]
    result = await send_newsletter(recipients, body.subject, body.content_html)
    return result


# ── Announce the newest blog post ─────────────────────────────────────────────

@router.get("/latest-post")
async def latest_post(_: User = Depends(get_current_user)):
    """Preview what /announce-latest would send, without sending anything."""
    try:
        post = await fetch_latest_post()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not read the blog feed: {exc}")
    if not post:
        raise HTTPException(status_code=404, detail="The blog feed contained no posts.")

    already = (db_already_announced(post["link"]))
    return {**post, "already_announced": already}


def db_already_announced(link: str) -> bool:
    from app.database import SessionLocal
    from app.models.announcement import Announcement
    db = SessionLocal()
    try:
        row = db.query(Announcement).filter(Announcement.source_key == link).first()
        return bool(row and row.status in Announcement.SUCCESSFUL)
    finally:
        db.close()


@router.post("/announce-latest")
async def announce_latest(
    force: bool = Query(False, description="Resend even if this post was already announced."),
    _: User = Depends(get_current_user),
):
    """
    Email confirmed subscribers about the newest post in the blog RSS feed.

    This exists because the blog is MDX files in a Next.js app rather than rows in
    this CMS, so the automatic hook on the post endpoints never fires for a real
    article. Safe to call repeatedly — the post's RSS link is recorded and a
    second call is a no-op unless force=true.
    """
    return await announce_latest_from_rss(force=force)

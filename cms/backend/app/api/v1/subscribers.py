import secrets
import time
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.subscriber import Subscriber
from app.schemas.subscriber import SubscribeRequest, SubscriberOut, SubscriberStats, NewsletterSendRequest, NewsletterSendResult
from app.core.email import send_confirmation_email, send_newsletter

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
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    existing = db.query(Subscriber).filter(Subscriber.email == body.email).first()
    if existing:
        if existing.is_unsubscribed:
            existing.is_unsubscribed = False
            existing.unsubscribed_at = None
            db.commit()
            return {"detail": "Re-subscribed. Check your email to confirm."}
        return {"detail": "Already subscribed."}

    token = secrets.token_urlsafe(32)
    sub = Subscriber(email=body.email, name=body.name, confirmation_token=token)
    db.add(sub)
    db.commit()

    try:
        await send_confirmation_email(body.email, body.name, token)
    except Exception:
        logging.exception("Failed to send confirmation email to %s", body.email)

    return {"detail": "Check your email to confirm your subscription."}


@router.get("/confirm")
def confirm_subscription(token: str, db: Session = Depends(get_db)):
    sub = db.query(Subscriber).filter(Subscriber.confirmation_token == token).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Token not found or already used")
    sub.is_active = True
    sub.confirmed_at = datetime.now(timezone.utc)
    sub.confirmation_token = None
    db.commit()
    return {"detail": "Subscription confirmed!"}


@router.get("/unsubscribe")
def unsubscribe(token: str, db: Session = Depends(get_db)):
    sub = db.query(Subscriber).filter(Subscriber.unsubscribe_token == token).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Token not found")
    sub.is_unsubscribed = True
    sub.is_active = False
    sub.unsubscribed_at = datetime.now(timezone.utc)
    db.commit()
    return {"detail": "You have been unsubscribed."}


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

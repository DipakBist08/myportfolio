import asyncio
import logging
import resend
from app.config import settings

logger = logging.getLogger(__name__)


def _resend_client() -> None:
    resend.api_key = settings.RESEND_API_KEY


def _from_address() -> str:
    return f"{settings.RESEND_FROM_NAME} <{settings.RESEND_FROM_EMAIL}>"


async def send_confirmation_email(email: str, name: str, token: str) -> bool:
    # Was FRONTEND_URL/confirm — but FRONTEND_URL is the CMS admin SPA and it has
    # no /confirm route, so every confirmation link would have 404'd. Point it at
    # the API endpoint that actually handles the token.
    confirm_url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1/subscribers/confirm?token={token}"
    blog_url = settings.BLOG_URL

    if not settings.emails_enabled:
        logger.info("[EMAIL DISABLED] confirm → %s", confirm_url)
        return True

    _resend_client()
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1">Confirm your subscription</h2>
      <p>Hi {name or 'there'},</p>
      <p>Thanks for subscribing to the QA Engineering Blog. Click below to confirm:</p>
      <p style="margin:24px 0">
        <a href="{confirm_url}"
           style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Confirm subscription
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">
        If you didn't subscribe, just ignore this email.
      </p>
    </div>
    """
    try:
        resend.Emails.send({
            "from": _from_address(),
            "to": [email],
            "subject": "Confirm your subscription — Dipak Bist QA Blog",
            "html": html,
        })
        return True
    except Exception:
        logger.exception("Resend: confirmation email failed for %s", email)
        return False


async def send_newsletter(
    recipients: list[dict],  # [{"email": ..., "name": ..., "unsubscribe_token": ...}]
    subject: str,
    content_html: str,
    blog_url: str = "",
) -> dict:
    """Send a newsletter to a list of recipients. Returns {sent, failed, errors}."""
    if not settings.emails_enabled:
        logger.info("[EMAIL DISABLED] newsletter send to %d recipients", len(recipients))
        return {"sent": len(recipients), "failed": 0, "errors": []}

    _resend_client()
    sent, failed, errors = 0, 0, []

    for i, r in enumerate(recipients):
        # Throttle so a large list does not trip Resend's per-second rate limit.
        if i and settings.RESEND_SEND_DELAY > 0:
            await asyncio.sleep(settings.RESEND_SEND_DELAY)
        unsubscribe_url = f"{settings.BACKEND_URL}/api/v1/subscribers/unsubscribe?token={r['unsubscribe_token']}"
        footer = f"""
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0" />
        <p style="color:#94a3b8;font-size:12px;text-align:center">
          You're receiving this because you subscribed to the QA Blog.<br/>
          <a href="{unsubscribe_url}" style="color:#94a3b8">Unsubscribe</a>
        </p>
        """
        html = f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
          {content_html}
          {footer}
        </div>
        """
        try:
            resend.Emails.send({
                "from": _from_address(),
                "to": [r["email"]],
                "subject": subject,
                "html": html,
            })
            sent += 1
        except Exception as e:
            logger.exception("Resend: newsletter failed for %s", r["email"])
            failed += 1
            errors.append(f"{r['email']}: {e}")

    return {"sent": sent, "failed": failed, "errors": errors}

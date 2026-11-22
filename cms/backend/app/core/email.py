import asyncio
import logging
from html import escape as html_escape
import resend
from app.config import settings

logger = logging.getLogger(__name__)


def _resend_client() -> None:
    resend.api_key = settings.RESEND_API_KEY


def _from_address() -> str:
    return f"{settings.RESEND_FROM_NAME} <{settings.RESEND_FROM_EMAIL}>"


async def send_welcome_email(email: str, name: str, unsubscribe_token: str) -> bool:
    """Tell a new subscriber they are on the list, with a one-click way off it.

    Subscribing takes effect immediately (no confirmation step), so this email
    is also the safety net when someone enters an address that is not theirs:
    its owner can leave the list from here without having to do anything else.
    """
    unsubscribe_url = f"{settings.BACKEND_URL.rstrip('/')}/api/v1/subscribers/unsubscribe?token={unsubscribe_token}"
    blog_url = settings.BLOG_URL.rstrip("/")

    if not settings.emails_enabled:
        if settings.DEBUG:
            logger.info("[EMAIL DISABLED] welcome → %s (unsubscribe: %s)", email, unsubscribe_url)
            return True
        logger.error("Welcome email not sent: RESEND_API_KEY is not set.")
        return False

    _resend_client()
    greeting = html_escape(name) if name else "there"
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1">You're subscribed</h2>
      <p>Hi {greeting},</p>
      <p>Thanks for subscribing to the QA Engineering Blog. You'll get one email each time a new article is published.</p>
      <p style="margin:24px 0">
        <a href="{blog_url}"
           style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Read the blog
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">
        Didn't sign up, or changed your mind? <a href="{unsubscribe_url}" style="color:#64748b">Unsubscribe</a>.
      </p>
    </div>
    """
    try:
        resend.Emails.send({
            "from": _from_address(),
            "to": [email],
            "subject": "You're subscribed — Dipak Bist QA Blog",
            "html": html,
        })
        return True
    except Exception:
        logger.exception("Resend: welcome email failed for %s", email)
        return False


async def send_newsletter(
    recipients: list[dict],  # [{"email": ..., "name": ..., "unsubscribe_token": ...}]
    subject: str,
    content_html: str,
    blog_url: str = "",
) -> dict:
    """Send a newsletter to a list of recipients. Returns {sent, failed, errors}."""
    if not settings.emails_enabled:
        # Report it as the failure it is, so nothing claims the list was emailed.
        logger.error("Newsletter not sent to %d recipients: RESEND_API_KEY is not set.", len(recipients))
        return {"sent": 0, "failed": len(recipients),
                "errors": ["Email sending is off: RESEND_API_KEY is not set."] if recipients else []}

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


def send_password_reset_email(email: str, name: str, reset_url: str) -> bool:
    """Email a "Forgot password?" link. Runs as a background task after the
    API has already answered, so how long sending takes reveals nothing."""
    if not settings.emails_enabled:
        if settings.DEBUG:
            logger.warning("[EMAIL DISABLED] password reset → %s: %s", email, reset_url)
            return True
        logger.error("Password reset email not sent: RESEND_API_KEY is not set.")
        return False

    _resend_client()
    greeting = html_escape(name) if name else "there"
    minutes = settings.PASSWORD_RESET_EXPIRE_MINUTES
    html = f"""
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
      <h2 style="color:#6366f1">Reset your CMS password</h2>
      <p>Hi {greeting},</p>
      <p>Someone asked to reset the password for the {html_escape(settings.APP_NAME)} account
         that uses this email address. Choose a new password with the button below.</p>
      <p style="margin:24px 0">
        <a href="{html_escape(reset_url)}"
           style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
          Choose a new password
        </a>
      </p>
      <p>The link works once and expires in {minutes} minutes. If you have two-factor
         authentication on, you will still need your authenticator code to sign in.</p>
      <p style="color:#64748b;font-size:13px">
        Didn't ask for this? Ignore this email: your password has not changed.
      </p>
    </div>
    """
    text = (
        f"Hi {name or 'there'},\n\n"
        f"Someone asked to reset the password for the {settings.APP_NAME} account that uses this email address.\n"
        f"Choose a new password here (works once, expires in {minutes} minutes):\n\n{reset_url}\n\n"
        "Didn't ask for this? Ignore this email: your password has not changed.\n"
    )
    try:
        resend.Emails.send({
            "from": f"{settings.APP_NAME} <{settings.RESEND_FROM_EMAIL}>",
            "to": [email],
            "subject": "Reset your CMS password",
            "html": html,
            "text": text,
        })
        return True
    except Exception:
        logger.exception("Resend: password reset email failed for %s", email)
        return False

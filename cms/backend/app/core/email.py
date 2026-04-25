"""
Email service. Disable gracefully when SMTP creds are not set.
"""
from typing import Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)


async def send_confirmation_email(email: str, name: str, token: str) -> bool:
    if not settings.EMAILS_ENABLED:
        logger.info(f"[EMAIL DISABLED] confirm link → {settings.FRONTEND_URL}/confirm?token={token}")
        return True
    try:
        from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
        conf = ConnectionConfig(
            MAIL_USERNAME=settings.SMTP_USER,
            MAIL_PASSWORD=settings.SMTP_PASSWORD,
            MAIL_FROM=settings.EMAILS_FROM_EMAIL,
            MAIL_FROM_NAME=settings.EMAILS_FROM_NAME,
            MAIL_PORT=settings.SMTP_PORT,
            MAIL_SERVER=settings.SMTP_HOST,
            MAIL_STARTTLS=True,
            MAIL_SSL_TLS=False,
            USE_CREDENTIALS=True,
        )
        link = f"{settings.FRONTEND_URL}/confirm?token={token}"
        html = f"""
        <h2>Confirm your subscription</h2>
        <p>Hi {name or 'there'},</p>
        <p>Click the link below to confirm your subscription to the QA Portfolio Blog:</p>
        <p><a href="{link}">{link}</a></p>
        <p>If you did not subscribe, ignore this email.</p>
        """
        message = MessageSchema(
            subject="Confirm your subscription",
            recipients=[email],
            body=html,
            subtype="html",
        )
        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        logger.error(f"Email send failed: {e}")
        return False


async def send_unsubscribe_email(email: str, token: str) -> bool:
    link = f"{settings.FRONTEND_URL}/unsubscribe?token={token}"
    logger.info(f"[EMAIL] unsubscribe link → {link}")
    return True

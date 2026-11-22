"""Email subscribers about new blog articles.

Called every hour, and after each push of blog content, by
.github/workflows/announce-new-articles.yml.

It is public, so the scheduled job needs no secret. A caller can only make it
do what the schedule does anyway: the recipients are the subscriber list, the
content comes only from the blog's own RSS feed (settings.BLOG_URL), nothing in
the request reaches an email, and each article is emailed once. The answer
names articles only, never subscribers. One check a minute at most.
"""
import time

from fastapi import APIRouter, HTTPException, status

from app.core.notifications import announce_new_from_rss

router = APIRouter(prefix="/announcements", tags=["Public – Announcements"])

MIN_INTERVAL = 60.0
_last_check = 0.0


@router.post("/check")
async def check_for_new_articles():
    global _last_check
    now = time.monotonic()
    if _last_check and now - _last_check < MIN_INTERVAL:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Checked less than a minute ago.",
            headers={"Retry-After": "60"},
        )
    _last_check = now
    return await announce_new_from_rss()

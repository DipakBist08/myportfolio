from fastapi import APIRouter
from app.api.v1 import auth, posts, categories, tags, subscribers, media, analytics, settings

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(posts.router)
router.include_router(categories.router)
router.include_router(tags.router)
router.include_router(subscribers.router)
router.include_router(media.router)
router.include_router(analytics.router)
router.include_router(settings.router)

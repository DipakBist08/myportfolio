from fastapi import APIRouter
from app.api.public import posts, search, categories, comments, traffic, readers, engagement, announcements, blog

router = APIRouter(prefix="/api/public")
router.include_router(announcements.router)
router.include_router(blog.router)
router.include_router(posts.router)
router.include_router(search.router)
router.include_router(categories.router)
router.include_router(comments.router)
router.include_router(traffic.router)
router.include_router(readers.router)
router.include_router(engagement.router)

from fastapi import APIRouter
from app.api.public import posts, search, categories, comments

router = APIRouter(prefix="/api/public")
router.include_router(posts.router)
router.include_router(search.router)
router.include_router(categories.router)
router.include_router(comments.router)

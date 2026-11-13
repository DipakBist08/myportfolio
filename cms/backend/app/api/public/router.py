from fastapi import APIRouter
from app.api.public import posts, search, categories, comments, traffic

router = APIRouter(prefix="/api/public")
router.include_router(posts.router)
router.include_router(search.router)
router.include_router(categories.router)
router.include_router(comments.router)
router.include_router(traffic.router)

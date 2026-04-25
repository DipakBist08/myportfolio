from fastapi import APIRouter
from app.api.public import posts, search, categories

router = APIRouter(prefix="/api/public")
router.include_router(posts.router)
router.include_router(search.router)
router.include_router(categories.router)

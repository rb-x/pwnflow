from fastapi import APIRouter, Depends, status
from typing import List
from neo4j import AsyncSession

from schemas.category_tag import CategoryTag, CategoryTagCreate
from crud import category_tag as category_tag_crud
from api.dependencies import get_session, get_current_user
from schemas.user import User

router = APIRouter()

@router.get("/", response_model=List[CategoryTag])
async def read_category_tags(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user) # Ensures endpoint is protected
):
    """
    Retrieve all category tags.
    """
    return await category_tag_crud.get_all_category_tags(session)

@router.post("/", response_model=CategoryTag, status_code=status.HTTP_201_CREATED)
async def create_category_tag(
    category_tag_in: CategoryTagCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user) # Ensures endpoint is protected
):
    """
    Create a new category tag.
    """
    return await category_tag_crud.create_category_tag(session, category_tag_in) 
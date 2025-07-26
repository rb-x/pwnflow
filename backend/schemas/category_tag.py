from uuid import UUID
from pydantic import BaseModel

class CategoryTagBase(BaseModel):
    name: str

class CategoryTagCreate(CategoryTagBase):
    pass

class CategoryTag(CategoryTagBase):
    id: UUID

    class Config:
        from_attributes = True 
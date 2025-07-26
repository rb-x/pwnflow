from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from uuid import UUID, uuid4

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class UserBase(BaseModel):
    username: str = Field(..., description="The unique username for the user.")
    email: EmailStr = Field(..., description="The email address of the user.")

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="The user's password.")

class UserUpdate(UserBase):
    username: Optional[str] = Field(None, description="The new username for the user.")
    email: Optional[EmailStr] = Field(None, description="The new email address of the user.")
    password: Optional[str] = Field(None, min_length=8, description="The new password for the user.")

class UserInDBBase(UserBase):
    id: UUID = Field(default_factory=uuid4)
    is_active: bool = True
    
    class Config:
        from_attributes = True

class User(UserInDBBase):
    pass

class UserInDB(UserInDBBase):
    hashed_password: str 
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Any, List

# --- Variable Schemas ---
class VariableBase(BaseModel):
    name: str
    value: Any
    description: str | None = None
    sensitive: bool = False

class VariableCreate(VariableBase):
    pass

class VariableUpdate(BaseModel):
    name: str | None = None
    value: Any | None = None
    description: str | None = None
    sensitive: bool | None = None

class VariableInDB(VariableBase):
    id: UUID
    
    model_config = ConfigDict(from_attributes=True)

# --- Context Schemas ---
class ContextBase(BaseModel):
    name: str
    description: str | None = None

class ContextCreate(ContextBase):
    pass

class ContextUpdate(ContextBase):
    name: str | None = None
    description: str | None = None

class Context(ContextBase):
    id: UUID
    variables: List[VariableInDB] = []
    
    model_config = ConfigDict(from_attributes=True) 
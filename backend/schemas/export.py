from pydantic import BaseModel
from typing import Optional, Literal
from enum import Enum


class EncryptionMethod(str, Enum):
    NONE = "none"
    PASSWORD = "password"
    GENERATED = "generated"


class ExportOptions(BaseModel):
    include_variables: bool = True
    include_scope: bool = True


class ExportEncryption(BaseModel):
    method: EncryptionMethod = EncryptionMethod.PASSWORD
    password: Optional[str] = None


class ProjectExportRequest(BaseModel):
    encryption: ExportEncryption
    options: ExportOptions = ExportOptions()


class TemplateExportRequest(BaseModel):
    encryption: ExportEncryption


class ImportMode(str, Enum):
    NEW = "new"
    MERGE = "merge"


class ProjectImportRequest(BaseModel):
    password: Optional[str] = None
    import_mode: ImportMode = ImportMode.NEW
    target_project_id: Optional[str] = None


class TemplateImportRequest(BaseModel):
    password: Optional[str] = None


class ExportJobResponse(BaseModel):
    job_id: str
    status: str
    download_url: Optional[str] = None
    generated_password: Optional[str] = None


class ImportPreviewResponse(BaseModel):
    type: Literal["project", "template"]
    name: str
    description: Optional[str]
    node_count: int
    context_count: int
    command_count: int
    variable_count: int
    tag_count: int
    scope_asset_count: int
    exported_at: str
    format_version: str
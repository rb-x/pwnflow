from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from uuid import UUID
from datetime import datetime

# Scope Tag Schema
class ScopeTag(BaseModel):
    id: str
    name: str
    color: str
    is_predefined: bool = False

class ScopeTagCreate(BaseModel):
    name: str
    color: str = "bg-gray-500"
    is_predefined: bool = False

# Base Asset Schema
class ScopeAssetBase(BaseModel):
    ip: str = Field(..., description="IP address of the asset")
    port: int = Field(..., ge=1, le=65535, description="Port number")
    protocol: Literal["tcp", "udp"] = Field(default="tcp", description="Protocol type")
    hostnames: List[str] = Field(default_factory=list, description="DNS hostnames")
    vhosts: List[str] = Field(default_factory=list, description="Virtual hosts")
    status: Literal["not_tested", "testing", "clean", "vulnerable", "exploitable"] = Field(
        default="not_tested", description="Testing status"
    )
    discovered_via: Literal["nmap", "ssl-cert", "http-vhosts", "manual"] = Field(
        default="manual", description="How the asset was discovered"
    )
    notes: Optional[str] = Field(None, description="Additional notes")

class ScopeAssetCreate(ScopeAssetBase):
    """Schema for creating a new scope asset"""
    pass

class ScopeAssetUpdate(BaseModel):
    """Schema for updating an existing scope asset"""
    protocol: Optional[Literal["tcp", "udp"]] = None
    hostnames: Optional[List[str]] = None
    vhosts: Optional[List[str]] = None
    status: Optional[Literal["not_tested", "testing", "clean", "vulnerable", "exploitable"]] = None
    discovered_via: Optional[Literal["nmap", "ssl-cert", "http-vhosts", "manual"]] = None
    notes: Optional[str] = None
    tags: Optional[List["ScopeTag"]] = None

class ScopeAsset(ScopeAssetBase):
    """Complete scope asset with all fields"""
    id: UUID
    tags: List[ScopeTag] = Field(default_factory=list, description="Tags associated with this asset")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# Nmap Import Schemas
class NmapImportRequest(BaseModel):
    xml_content: str = Field(..., description="Nmap XML content to parse")
    default_status: Literal["not_tested", "testing", "clean"] = Field(
        default="not_tested", description="Default status for imported assets"
    )
    open_ports_only: bool = Field(
        default=True, description="Only import open ports, skip closed/filtered"
    )

class ImportStats(BaseModel):
    """Statistics from an import operation"""
    hosts_processed: int
    services_created: int
    services_updated: int
    hostnames_linked: int
    vhosts_detected: int
    errors: List[str] = Field(default_factory=list)

# Aggregated Host Group (for UI display)
class HostGroup(BaseModel):
    """Represents a group of services on the same IP"""
    ip: str
    hostnames: List[str] = Field(default_factory=list)
    services: List[ScopeAsset] = Field(default_factory=list)
    status: Literal["not_tested", "testing", "clean", "vulnerable", "exploitable"]

class ScopeStats(BaseModel):
    """Overall scope statistics"""
    total_assets: int
    total_hosts: int
    assets_by_status: dict[str, int]
    completion_percentage: int

# Bulk Operations
class BulkStatusUpdate(BaseModel):
    """Update status for multiple assets"""
    asset_ids: List[UUID]
    new_status: Literal["not_tested", "testing", "clean", "vulnerable", "exploitable"]

class BulkTagOperation(BaseModel):
    """Add/remove tags for multiple assets"""
    asset_ids: List[UUID]
    tag: ScopeTag
    operation: Literal["add", "remove"]
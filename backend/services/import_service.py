import json
import zipfile
import tempfile
import uuid
from typing import Dict, Any, Tuple, Optional, List
from datetime import datetime

from db.database import get_driver
from schemas.user import User
from services.export_service import ExportService


class ImportService:
    def __init__(self):
        self.driver = get_driver()
        self.export_service = ExportService()

    def generate_uuid_map(self, data: Dict[str, Any]) -> Dict[str, str]:
        """Generate new UUIDs for all entities to prevent malicious UUID attacks."""
        uuid_map = {}
        
        # Generate new UUIDs for nodes
        for node in data.get("nodes", []):
            old_id = node["id"]
            uuid_map[old_id] = str(uuid.uuid4())
        
        # Generate new UUIDs for contexts
        for context in data.get("contexts", []):
            old_id = context["id"]
            uuid_map[old_id] = str(uuid.uuid4())
        
        # Generate new UUIDs for commands
        for command in data.get("commands", []):
            old_id = command["id"]
            uuid_map[old_id] = str(uuid.uuid4())
        
        # Generate new UUIDs for variables
        for variable in data.get("variables", []):
            old_id = variable["id"]
            uuid_map[old_id] = str(uuid.uuid4())
        
        # Generate new UUIDs for findings
        for finding in data.get("findings", []):
            old_id = finding["id"]
            uuid_map[old_id] = str(uuid.uuid4())
        
        # Generate new UUIDs for scope assets
        for scope_asset in data.get("scope_assets", []):
            old_id = scope_asset["id"]
            uuid_map[old_id] = str(uuid.uuid4())
        
        return uuid_map

    def rewrite_uuids(self, data: Dict[str, Any], uuid_map: Dict[str, str]) -> Dict[str, Any]:
        """Rewrite all UUIDs in the data with new ones."""
        # Rewrite node IDs and references
        for node in data.get("nodes", []):
            node["id"] = uuid_map[node["id"]]
            
            # Update parent references if they exist
            if node.get("parent_id") and node["parent_id"] in uuid_map:
                node["parent_id"] = uuid_map[node["parent_id"]]
        
        # Rewrite relationship references
        for rel in data.get("relationships", []):
            if rel["source"] in uuid_map:
                rel["source"] = uuid_map[rel["source"]]
            if rel["target"] in uuid_map:
                rel["target"] = uuid_map[rel["target"]]
        
        # Rewrite context IDs
        for context in data.get("contexts", []):
            context["id"] = uuid_map[context["id"]]
        
        # Rewrite command IDs and node references
        for command in data.get("commands", []):
            command["id"] = uuid_map[command["id"]]
            if command.get("node_id") and command["node_id"] in uuid_map:
                command["node_id"] = uuid_map[command["node_id"]]
        
        # Rewrite variable IDs and context references
        for variable in data.get("variables", []):
            variable["id"] = uuid_map[variable["id"]]
            if variable.get("context_id") and variable["context_id"] in uuid_map:
                variable["context_id"] = uuid_map[variable["context_id"]]
        
        # Rewrite finding IDs and node references
        for finding in data.get("findings", []):
            finding["id"] = uuid_map[finding["id"]]
            if finding.get("node_id") and finding["node_id"] in uuid_map:
                finding["node_id"] = uuid_map[finding["node_id"]]
        
        # Rewrite scope asset IDs
        for scope_asset in data.get("scope_assets", []):
            scope_asset["id"] = uuid_map[scope_asset["id"]]
        
        return data

    def preview_import(self, file_path: str, password: Optional[str] = None) -> Dict[str, Any]:
        """Preview the contents of an import file without actually importing."""
        import os
        
        # Check if file exists and is readable
        if not os.path.exists(file_path):
            return {"error": "File not found"}
        
        if not os.access(file_path, os.R_OK):
            return {"error": "File is not readable"}
        
        # Check file size
        file_size = os.path.getsize(file_path)
        if file_size == 0:
            return {"error": "File is empty"}
        
        try:
            with zipfile.ZipFile(file_path, 'r') as zf:
                # Check if metadata.json exists
                if 'metadata.json' not in zf.namelist():
                    return {
                        "error": "Invalid file format: metadata.json not found"
                    }
                
                # Read metadata
                try:
                    metadata_bytes = zf.read('metadata.json')
                    metadata = json.loads(metadata_bytes.decode('utf-8'))
                except json.JSONDecodeError as e:
                    return {
                        "error": f"Failed to read file: {str(e)}"
                    }
                except Exception as e:
                    return {
                        "error": f"Failed to read metadata: {str(e)}"
                    }
                
                # Check if encrypted
                is_encrypted = 'data.enc' in zf.namelist()
                
                if is_encrypted and not password:
                    return {
                        "error": "Password required for encrypted file",
                        "metadata": metadata
                    }
                
                # Read and decrypt data if needed
                if is_encrypted:
                    ciphertext = zf.read('data.enc')
                    salt = zf.read('salt.bin')
                    nonce = zf.read('nonce.bin')
                    
                    try:
                        data_bytes = self.export_service.decrypt_data(ciphertext, password, salt, nonce)
                        # decrypt_data returns bytes, json.loads can handle UTF-8 bytes directly
                        data = json.loads(data_bytes)
                    except Exception:
                        return {
                            "error": "Invalid password",
                            "metadata": metadata
                        }
                else:
                    data = json.loads(zf.read('data.json').decode('utf-8'))
                
                # Count items
                counts = {
                    "node_count": len(data.get("nodes", [])),
                    "context_count": len(data.get("contexts", [])),
                    "command_count": len(data.get("commands", [])),
                    "variable_count": len(data.get("variables", [])),
                    "tag_count": len(data.get("tags", [])),
                    "scope_asset_count": len(data.get("scope_assets", []))
                }
                
                # Get project/template info
                if "project" in data:
                    info = data["project"]
                    item_type = "project"
                else:
                    info = data["template"]
                    item_type = "template"
                
                return {
                    "type": item_type,
                    "name": info["name"],
                    "description": info.get("description", ""),
                    "exported_at": metadata["exported_at"],
                    "format_version": metadata["version"],
                    **counts
                }
        
        except zipfile.BadZipFile:
            return {
                "error": "Invalid file format. The file is not a valid .pwnflow-project file."
            }
        except Exception as e:
            import traceback
            logger.error(f"Import preview error: {traceback.format_exc()}")
            return {
                "error": f"Failed to read file: {str(e)}"
            }

    async def import_project(
        self,
        file_path: str,
        user: User,
        password: Optional[str] = None,
        import_mode: str = "new",
        target_project_id: Optional[str] = None
    ) -> str:
        """Import a project from file."""
        try:
            with zipfile.ZipFile(file_path, 'r') as zf:
                # Read metadata
                metadata = json.loads(zf.read('metadata.json').decode('utf-8'))
                
                # Validate format
                if metadata.get("format") != "pwnflow-project":
                    raise ValueError("Invalid file format. Expected pwnflow-project")
                
                # Read and decrypt data if needed
                is_encrypted = 'data.enc' in zf.namelist()
                
                if is_encrypted:
                    if not password:
                        raise ValueError("Password required for encrypted file")
                    
                    ciphertext = zf.read('data.enc')
                    salt = zf.read('salt.bin')
                    nonce = zf.read('nonce.bin')
                    
                    data_bytes = self.export_service.decrypt_data(ciphertext, password, salt, nonce)
                    data = json.loads(data_bytes)
                else:
                    data = json.loads(zf.read('data.json').decode('utf-8'))
                
                # Generate UUID map
                uuid_map = self.generate_uuid_map(data)
                
                # Rewrite UUIDs
                data = self.rewrite_uuids(data, uuid_map)
                
                # Import based on mode
                if import_mode == "new":
                    project_id = await self._create_new_project(data, user)
                else:
                    if not target_project_id:
                        raise ValueError("Target project ID required for merge mode")
                    project_id = await self._merge_into_project(data, user, target_project_id)
                
                return project_id
        
        except Exception as e:
            raise Exception(f"Import failed: {str(e)}")

    async def _create_new_project(self, data: Dict[str, Any], user: User) -> str:
        """Create a new project from imported data."""
        async with self.driver.session() as session:
            # Create project
            project_data = data["project"]
            project_id = str(uuid.uuid4())
            
            await session.run("""
                MATCH (u:User {id: $user_id})
                CREATE (p:Project {
                    id: $project_id,
                    name: $name,
                    description: $description,
                    layout_direction: $layout_direction,
                    category_tags: $category_tags,
                    created_at: datetime(),
                    updated_at: datetime()
                })
                CREATE (u)-[:OWNS]->(p)
            """, 
                user_id=str(user.id),
                project_id=project_id,
                name=f"{project_data['name']} (Imported)",
                description=project_data.get('description', ''),
                layout_direction=project_data.get('layout_direction', 'TB'),
                category_tags=project_data.get('category_tags', [])
            )
            
            # Create nodes
            for node in data.get("nodes", []):
                await session.run("""
                    MATCH (p:Project {id: $project_id})
                    CREATE (n:Node {
                        id: $node_id,
                        title: $title,
                        description: $description,
                        status: $status,
                        findings: $findings,
                        color: $color,
                        x_pos: $x_pos,
                        y_pos: $y_pos,
                        created_at: datetime(),
                        updated_at: datetime()
                    })
                    CREATE (p)-[:HAS_NODE]->(n)
                """,
                    project_id=project_id,
                    node_id=node["id"],
                    title=node.get("title", "Untitled Node"),
                    description=node.get("description", ""),
                    status=node.get("status", "NOT_STARTED"),
                    findings=node.get("findings", ""),
                    color=node.get("color", "#6366f1"),
                    x_pos=node.get("x_pos", 0),
                    y_pos=node.get("y_pos", 0)
                )
                
                # Add tags
                for tag in node.get("tags", []):
                    await session.run("""
                        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
                        MERGE (t:Tag {name: $tag_name})
                        CREATE (n)-[:HAS_TAG]->(t)
                    """,
                        project_id=project_id,
                        node_id=node["id"],
                        tag_name=tag
                    )
            
            # Create relationships
            for rel in data.get("relationships", []):
                await session.run("""
                    MATCH (p:Project {id: $project_id})
                    MATCH (p)-[:HAS_NODE]->(source:Node {id: $source_id})
                    MATCH (p)-[:HAS_NODE]->(target:Node {id: $target_id})
                    CREATE (source)-[:IS_LINKED_TO]->(target)
                """,
                    project_id=project_id,
                    source_id=rel["source"],
                    target_id=rel["target"]
                )
            
            # Create contexts and link to project
            for context in data.get("contexts", []):
                await session.run("""
                    MATCH (p:Project {id: $project_id})
                    CREATE (c:Context {
                        id: $context_id,
                        name: $name,
                        description: $description,
                        created_at: datetime(),
                        updated_at: datetime()
                    })
                    CREATE (p)-[:HAS_CONTEXT]->(c)
                """,
                    project_id=project_id,
                    context_id=context["id"],
                    name=context.get("name", ""),
                    description=context.get("description", "")
                )
            
            # Create commands and link to nodes
            for command in data.get("commands", []):
                node_id = command.get("node_id")
                if node_id:
                    await session.run("""
                        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
                        CREATE (cmd:Command {
                            id: $command_id,
                            title: $title,
                            command: $command,
                            description: $description,
                            created_at: datetime(),
                            updated_at: datetime()
                        })
                        CREATE (n)-[:HAS_COMMAND]->(cmd)
                    """,
                        project_id=project_id,
                        node_id=node_id,
                        command_id=command["id"],
                        title=command.get("title", "Untitled Command"),
                        command=command.get("command", ""),
                        description=command.get("description", "")
                    )
            
            # Create Finding entities and link to nodes
            findings_to_import = data.get("findings", [])
            
            for finding in findings_to_import:
                node_id = finding.get("node_id")
                created_by_id = finding.get("created_by")
                if node_id:
                    # Convert ISO strings back to datetime objects
                    from datetime import datetime
                    
                    date_val = finding.get("date", "")
                    if isinstance(date_val, str) and date_val:
                        try:
                            date_val = datetime.fromisoformat(date_val.replace('Z', '+00:00'))
                        except:
                            date_val = datetime.now()
                    
                    created_at_val = finding.get("created_at", "")
                    if isinstance(created_at_val, str) and created_at_val:
                        try:
                            created_at_val = datetime.fromisoformat(created_at_val.replace('Z', '+00:00'))
                        except:
                            created_at_val = datetime.now()
                    
                    updated_at_val = finding.get("updated_at", "")
                    if isinstance(updated_at_val, str) and updated_at_val:
                        try:
                            updated_at_val = datetime.fromisoformat(updated_at_val.replace('Z', '+00:00'))
                        except:
                            updated_at_val = datetime.now()
                    
                    # Create the finding
                    result = await session.run("""
                        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node {id: $node_id})
                        CREATE (f:Finding {
                            id: $finding_id,
                            content: $content,
                            date: datetime($date),
                            created_at: datetime($created_at),
                            updated_at: datetime($updated_at)
                        })
                        CREATE (n)-[:HAS_FINDING]->(f)
                        RETURN f.id as created_finding_id
                    """,
                        project_id=project_id,
                        node_id=node_id,
                        finding_id=finding["id"],
                        content=finding.get("content", ""),
                        date=date_val.isoformat() if date_val else datetime.now().isoformat(),
                        created_at=created_at_val.isoformat() if created_at_val else datetime.now().isoformat(),
                        updated_at=updated_at_val.isoformat() if updated_at_val else datetime.now().isoformat()
                    )
                    
                    finding_record = await result.single()
            
            # Create variables and link to contexts
            for variable in data.get("variables", []):
                context_id = variable.get("context_id")
                if context_id:
                    await session.run("""
                        MATCH (c:Context {id: $context_id})
                        CREATE (v:Variable {
                            id: $variable_id,
                            name: $name,
                            value: $value,
                            description: $description,
                            sensitive: $sensitive,
                            created_at: datetime(),
                            updated_at: datetime()
                        })
                        CREATE (c)-[:HAS_VARIABLE]->(v)
                    """,
                        context_id=context_id,
                        variable_id=variable["id"],
                        name=variable.get("name", ""),
                        value=variable.get("value", ""),
                        description=variable.get("description", ""),
                        sensitive=variable.get("sensitive", False)
                    )
            
            # Create scope assets (if present in import data - for legacy compatibility)
            for scope_asset in data.get("scope_assets", []):
                await session.run("""
                    MATCH (p:Project {id: $project_id})
                    CREATE (a:ScopeAsset {
                        id: $asset_id,
                        ip: $ip,
                        port: $port,
                        protocol: $protocol,
                        hostnames: $hostnames,
                        vhosts: $vhosts,
                        notes: $notes,
                        status: $status,
                        discovered_via: $discovered_via,
                        created_at: datetime(),
                        updated_at: datetime()
                    })
                    CREATE (p)-[:HAS_SCOPE_ASSET]->(a)
                """,
                    project_id=project_id,
                    asset_id=scope_asset["id"],
                    ip=scope_asset.get("ip", ""),
                    port=scope_asset.get("port"),
                    protocol=scope_asset.get("protocol", "tcp"),
                    hostnames=scope_asset.get("hostnames", []),
                    vhosts=scope_asset.get("vhosts", []),
                    notes=scope_asset.get("notes", ""),
                    status=scope_asset.get("status", "not_tested"),
                    discovered_via=scope_asset.get("discovered_via", "manual")
                )
                
                # Add tags to scope asset
                for tag in scope_asset.get("tags", []):
                    tag_id = str(uuid.uuid4())
                    await session.run("""
                        MATCH (p:Project {id: $project_id})-[:HAS_SCOPE_ASSET]->(a:ScopeAsset {id: $asset_id})
                        MERGE (t:ScopeTag {id: $tag_id, name: $tag_name, color: $tag_color, is_predefined: $is_predefined})
                        CREATE (a)-[:TAGGED_WITH]->(t)
                    """,
                        project_id=project_id,
                        asset_id=scope_asset["id"],
                        tag_id=tag_id,
                        tag_name=tag,
                        tag_color='bg-gray-500',
                        is_predefined=False
                    )
            
            return project_id

    async def _merge_into_project(self, data: Dict[str, Any], user: User, target_project_id: str) -> str:
        """Merge imported data into an existing project."""
        # TODO: Implement merge logic
        # This would involve:
        # 1. Verifying user owns target project
        # 2. Adding nodes with position offset to avoid overlaps
        # 3. Merging contexts and commands
        # 4. Handling tag conflicts
        raise NotImplementedError("Merge mode not yet implemented")

    async def import_template(
        self,
        file_path: str,
        user: User,
        password: Optional[str] = None
    ) -> str:
        """Import a template from file."""
        try:
            with zipfile.ZipFile(file_path, 'r') as zf:
                # Read metadata
                metadata = json.loads(zf.read('metadata.json').decode('utf-8'))
                
                # Validate format
                if metadata.get("format") != "pwnflow-template":
                    raise ValueError("Invalid file format. Expected pwnflow-template")
                
                # Read and decrypt data if needed
                is_encrypted = 'data.enc' in zf.namelist()
                
                if is_encrypted:
                    if not password:
                        raise ValueError("Password required for encrypted file")
                    
                    ciphertext = zf.read('data.enc')
                    salt = zf.read('salt.bin')
                    nonce = zf.read('nonce.bin')
                    
                    data_bytes = self.export_service.decrypt_data(ciphertext, password, salt, nonce)
                    data = json.loads(data_bytes)
                else:
                    data = json.loads(zf.read('data.json').decode('utf-8'))
                
                # Generate UUID map
                uuid_map = self.generate_uuid_map(data)
                
                # Rewrite UUIDs
                data = self.rewrite_uuids(data, uuid_map)
                
                # Create template
                template_id = await self._create_template(data, user)
                
                return template_id
        
        except Exception as e:
            raise Exception(f"Import failed: {str(e)}")

    async def _create_template(self, data: Dict[str, Any], user: User) -> str:
        """Create a new template from imported data."""
        async with self.driver.session() as session:
            # Create template
            template_data = data["template"]
            template_id = str(uuid.uuid4())
            
            await session.run("""
                MATCH (u:User {id: $user_id})
                CREATE (t:Template {
                    id: $template_id,
                    name: $name,
                    description: $description,
                    is_public: false,
                    category_tags: $category_tags,
                    created_at: datetime(),
                    updated_at: datetime()
                })
                CREATE (u)-[:OWNS]->(t)
            """, 
                user_id=str(user.id),
                template_id=template_id,
                name=f"{template_data['name']} (Imported)",
                description=template_data.get('description', ''),
                category_tags=template_data.get('category_tags', [])
            )
            
            # Create nodes (similar to project import but for template)
            for node in data.get("nodes", []):
                await session.run("""
                    MATCH (t:Template {id: $template_id})
                    CREATE (n:Node {
                        id: $node_id,
                        title: $title,
                        description: $description,
                        status: $status,
                        findings: $findings,
                        color: $color,
                        x_pos: $x_pos,
                        y_pos: $y_pos,
                        created_at: datetime(),
                        updated_at: datetime()
                    })
                    CREATE (t)-[:HAS_NODE]->(n)
                """,
                    template_id=template_id,
                    node_id=node["id"],
                    title=node.get("title", "Untitled Node"),
                    description=node.get("description", ""),
                    status=node.get("status", "NOT_STARTED"),
                    findings=node.get("findings", ""),
                    color=node.get("color", "#6366f1"),
                    x_pos=node.get("x_pos", 0),
                    y_pos=node.get("y_pos", 0)
                )
                
                # Add tags
                for tag in node.get("tags", []):
                    await session.run("""
                        MATCH (t:Template {id: $template_id})-[:HAS_NODE]->(n:Node {id: $node_id})
                        MERGE (tag:Tag {name: $tag_name})
                        CREATE (n)-[:HAS_TAG]->(tag)
                    """,
                        template_id=template_id,
                        node_id=node["id"],
                        tag_name=tag
                    )
            
            # Create relationships
            for rel in data.get("relationships", []):
                await session.run("""
                    MATCH (t:Template {id: $template_id})
                    MATCH (t)-[:HAS_NODE]->(source:Node {id: $source_id})
                    MATCH (t)-[:HAS_NODE]->(target:Node {id: $target_id})
                    CREATE (source)-[:IS_LINKED_TO]->(target)
                """,
                    template_id=template_id,
                    source_id=rel["source"],
                    target_id=rel["target"]
                )
            
            # Create contexts (without variables for security) and link to template
            for context in data.get("contexts", []):
                await session.run("""
                    MATCH (t:Template {id: $template_id})
                    CREATE (c:Context {
                        id: $context_id,
                        name: $name,
                        description: $description,
                        created_at: datetime(),
                        updated_at: datetime()
                    })
                    CREATE (t)-[:HAS_CONTEXT]->(c)
                """,
                    template_id=template_id,
                    context_id=context["id"],
                    name=context.get("name", ""),
                    description=context.get("description", "")
                )
            
            # Create commands (without outputs)
            for command in data.get("commands", []):
                node_id = command.get("node_id")
                if node_id:
                    await session.run("""
                        MATCH (t:Template {id: $template_id})-[:HAS_NODE]->(n:Node {id: $node_id})
                        CREATE (cmd:Command {
                            id: $command_id,
                            title: $title,
                            command: $command,
                            description: $description,
                            created_at: datetime(),
                            updated_at: datetime()
                        })
                        CREATE (n)-[:HAS_COMMAND]->(cmd)
                    """,
                        template_id=template_id,
                        node_id=node_id,
                        command_id=command["id"],
                        title=command.get("title", "Untitled Command"),
                        command=command.get("command", ""),
                        description=command.get("description", "")
                    )
            
            return template_id
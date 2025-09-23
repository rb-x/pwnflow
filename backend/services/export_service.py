import json
import secrets
import zipfile
import tempfile
import os
from datetime import datetime
from typing import Dict, Any, Tuple, Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
import hashlib
import uuid

from db.database import get_driver
from schemas.user import User
from schemas.export import EncryptionMethod
from neo4j.time import DateTime as Neo4jDateTime

def convert_neo4j_datetime(dt):
    """Convert Neo4j DateTime to Python datetime"""
    if isinstance(dt, Neo4jDateTime):
        return dt.to_native()
    return dt



class ExportService:
    def __init__(self):
        self.driver = get_driver()

    def generate_secure_password(self, length: int = 24) -> str:
        """Generate a secure random password."""
        alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        return ''.join(secrets.choice(alphabet) for _ in range(length))

    def calculate_checksum(self, data: str) -> str:
        """Calculate SHA256 checksum of data."""
        return hashlib.sha256(data.encode()).hexdigest()

    def encrypt_data(self, data: bytes, password: str) -> Tuple[bytes, bytes, bytes]:
        """Encrypt data using AES-256-GCM with PBKDF2 key derivation."""
        # Generate salt and nonce
        salt = secrets.token_bytes(32)
        nonce = secrets.token_bytes(12)
        
        # Derive key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100_000,
        )
        key = kdf.derive(password.encode())
        
        # Encrypt using AES-GCM
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, data, None)
        
        return salt, nonce, ciphertext

    def decrypt_data(self, ciphertext: bytes, password: str, salt: bytes, nonce: bytes) -> bytes:
        """Decrypt data using AES-256-GCM."""
        # Derive key using PBKDF2
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100_000,
        )
        key = kdf.derive(password.encode())
        
        # Decrypt using AES-GCM
        aesgcm = AESGCM(key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        
        return plaintext

    async def export_project(
        self, 
        project_id: str, 
        user: User,
        encryption_method: EncryptionMethod,
        password: Optional[str] = None,
        include_variables: bool = True,
        include_scope: bool = True
    ) -> Tuple[str, Optional[str]]:
        """Export a project to an encrypted file."""
        
        # Generate password if needed
        generated_password = None
        if encryption_method == EncryptionMethod.GENERATED:
            generated_password = self.generate_secure_password()
            password = generated_password
        elif encryption_method == EncryptionMethod.PASSWORD and not password:
            raise ValueError("Password required for password encryption method")

        async with self.driver.session() as session:
            # Fetch project data
            project_data = await self._fetch_project_data(
                session, project_id, str(user.id), include_variables, include_scope
            )
            
            if not project_data:
                raise ValueError("Project not found or access denied")

            # Prepare export data
            export_data = {
                "format": "pwnflow-project",
                "version": "1.0",
                "metadata": {
                    "format": "pwnflow-project",
                    "version": "1.0",
                    "exported_at": datetime.utcnow().isoformat(),
                    "pwnflow_version": "1.1.0",
                    "project_name": project_data["project"]["name"],
                    "node_count": len(project_data["nodes"]),
                    "checksum": ""
                },
                "project": project_data["project"],
                "nodes": project_data["nodes"],
                "relationships": project_data["relationships"],
                "contexts": project_data["contexts"],
                "variables": project_data["variables"] if include_variables else [],
                "commands": project_data["commands"],
                "findings": project_data["findings"],
                "tags": project_data["tags"],
                "scope_assets": project_data["scope_assets"] if include_scope else []
            }

            # Calculate checksum
            data_json = json.dumps(export_data["project"], sort_keys=True)
            export_data["metadata"]["checksum"] = self.calculate_checksum(data_json)

            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.pwnflow-project', delete=False) as tmp_file:
                filename = tmp_file.name
                
                with zipfile.ZipFile(filename, 'w') as zf:
                    # Write metadata (unencrypted)
                    zf.writestr('metadata.json', json.dumps(export_data["metadata"], indent=2))
                    
                    # Prepare data for encryption
                    data_bytes = json.dumps({
                        "project": export_data["project"],
                        "nodes": export_data["nodes"],
                        "relationships": export_data["relationships"],
                        "contexts": export_data["contexts"],
                        "variables": export_data["variables"],
                        "commands": export_data["commands"],
                        "findings": export_data["findings"],
                        "tags": export_data["tags"],
                        "scope_assets": export_data["scope_assets"]
                    }).encode()
                    
                    if encryption_method == EncryptionMethod.NONE:
                        # No encryption
                        zf.writestr('data.json', data_bytes)
                    else:
                        # Encrypt data
                        salt, nonce, ciphertext = self.encrypt_data(data_bytes, password)
                        zf.writestr('data.enc', ciphertext)
                        zf.writestr('salt.bin', salt)
                        zf.writestr('nonce.bin', nonce)

            return filename, generated_password

    async def _fetch_project_data(self, session, project_id: str, user_id: str, 
                                  include_variables: bool, include_scope: bool = True) -> Dict[str, Any]:
        """Fetch all project data from Neo4j."""
        # Verify ownership
        result = await session.run("""
            MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
            RETURN p
        """, user_id=user_id, project_id=project_id)
        
        project_record = await result.single()
        if not project_record:
            return None
        
        project = dict(project_record["p"])
        # Convert DateTime objects to ISO strings
        if "created_at" in project and project["created_at"] and hasattr(project["created_at"], 'isoformat'):
            project["created_at"] = project["created_at"].isoformat()
        if "updated_at" in project and project["updated_at"] and hasattr(project["updated_at"], 'isoformat'):
            project["updated_at"] = project["updated_at"].isoformat()
        
        # Fetch nodes
        nodes_result = await session.run("""
            MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
            MATCH (p)-[:HAS_NODE]->(n:Node)
            OPTIONAL MATCH (n)-[:HAS_TAG]->(t:Tag)
            RETURN n, collect(DISTINCT t.name) as tags
        """, user_id=user_id, project_id=project_id)
        
        nodes = []
        async for record in nodes_result:
            node = dict(record["n"])
            # Convert DateTime objects to ISO strings
            if "created_at" in node and node["created_at"] and hasattr(node["created_at"], 'isoformat'):
                node["created_at"] = node["created_at"].isoformat()
            if "updated_at" in node and node["updated_at"] and hasattr(node["updated_at"], 'isoformat'):
                node["updated_at"] = node["updated_at"].isoformat()
            node["tags"] = record["tags"]
            nodes.append(node)
        
        # Fetch findings
        findings_result = await session.run("""
            MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
            MATCH (p)-[:HAS_NODE]->(n:Node)-[:HAS_FINDING]->(f:Finding)
            RETURN f, n.id as node_id, u.id as created_by
        """, user_id=user_id, project_id=project_id)
        
        findings = []
        try:
            async for record in findings_result:
                finding = dict(record["f"])
                
                # Convert DateTime objects to ISO strings (same as CRUD layer)
                try:
                    if "date" in finding and finding["date"]:
                        finding["date"] = convert_neo4j_datetime(finding["date"]).isoformat()
                    if "created_at" in finding and finding["created_at"]:
                        finding["created_at"] = convert_neo4j_datetime(finding["created_at"]).isoformat()
                    if "updated_at" in finding and finding["updated_at"]:
                        finding["updated_at"] = convert_neo4j_datetime(finding["updated_at"]).isoformat()
                    
                    finding["node_id"] = record["node_id"]
                    finding["created_by"] = record["created_by"]
                    findings.append(finding)
                    
                except Exception as e:
                    continue
        except Exception as e:
            findings = []
        
        # Fetch relationships
        relationships_result = await session.run("""
            MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
            MATCH (p)-[:HAS_NODE]->(source:Node)
            MATCH (source)-[:IS_LINKED_TO]->(target:Node)
            WHERE (p)-[:HAS_NODE]->(target)
            RETURN source.id as source, target.id as target
        """, user_id=user_id, project_id=project_id)
        
        relationships = [{"source": r["source"], "target": r["target"]} async for r in relationships_result]
        
        # Fetch contexts
        contexts_result = await session.run("""
            MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
            MATCH (p)-[:HAS_CONTEXT]->(c:Context)
            RETURN c
        """, user_id=user_id, project_id=project_id)
        
        contexts = []
        async for record in contexts_result:
            context = dict(record["c"])
            # Convert DateTime objects to ISO strings
            if "created_at" in context and context["created_at"] and hasattr(context["created_at"], 'isoformat'):
                context["created_at"] = context["created_at"].isoformat()
            if "updated_at" in context and context["updated_at"] and hasattr(context["updated_at"], 'isoformat'):
                context["updated_at"] = context["updated_at"].isoformat()
            contexts.append(context)
        
        # Fetch variables (if requested)
        variables = []
        if include_variables:
            variables_result = await session.run("""
                MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
                MATCH (p)-[:HAS_CONTEXT]->(c:Context)-[:HAS_VARIABLE]->(v:Variable)
                RETURN v, c.id as context_id
            """, user_id=user_id, project_id=project_id)
            
            async for record in variables_result:
                var = dict(record["v"])
                # Convert DateTime objects to ISO strings
                if "created_at" in var and var["created_at"] and hasattr(var["created_at"], 'isoformat'):
                    var["created_at"] = var["created_at"].isoformat()
                if "updated_at" in var and var["updated_at"] and hasattr(var["updated_at"], 'isoformat'):
                    var["updated_at"] = var["updated_at"].isoformat()
                var["context_id"] = record["context_id"]
                variables.append(var)
        
        # Fetch commands
        commands_result = await session.run("""
            MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
            MATCH (p)-[:HAS_NODE]->(n:Node)-[:HAS_COMMAND]->(cmd:Command)
            RETURN DISTINCT cmd, n.id as node_id
        """, user_id=user_id, project_id=project_id)
        
        commands = []
        async for record in commands_result:
            cmd = dict(record["cmd"])
            # Convert DateTime objects to ISO strings
            if "created_at" in cmd and cmd["created_at"] and hasattr(cmd["created_at"], 'isoformat'):
                cmd["created_at"] = cmd["created_at"].isoformat()
            if "updated_at" in cmd and cmd["updated_at"] and hasattr(cmd["updated_at"], 'isoformat'):
                cmd["updated_at"] = cmd["updated_at"].isoformat()
            cmd["node_id"] = record["node_id"]
            # Always include command data - commands are not considered sensitive
            commands.append(cmd)
        
        # Fetch all unique tags
        tags_result = await session.run("""
            MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
            MATCH (p)-[:HAS_NODE]->(n:Node)-[:HAS_TAG]->(t:Tag)
            RETURN DISTINCT t.name as name
        """, user_id=user_id, project_id=project_id)
        
        tags = [record["name"] async for record in tags_result]
        
        # Fetch scope assets (if requested)
        scope_assets = []
        if include_scope:
            scope_result = await session.run("""
                MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
                MATCH (p)-[:HAS_SCOPE_ASSET]->(a:ScopeAsset)
                OPTIONAL MATCH (a)-[:TAGGED_WITH]->(st:ScopeTag)
                RETURN a, collect(DISTINCT st.name) as tags
            """, user_id=user_id, project_id=project_id)
            
            async for record in scope_result:
                asset = dict(record["a"])
                # Convert DateTime objects to ISO strings
                if "created_at" in asset and asset["created_at"] and hasattr(asset["created_at"], 'isoformat'):
                    asset["created_at"] = asset["created_at"].isoformat()
                if "updated_at" in asset and asset["updated_at"] and hasattr(asset["updated_at"], 'isoformat'):
                    asset["updated_at"] = asset["updated_at"].isoformat()
                asset["tags"] = record["tags"] or []
                scope_assets.append(asset)
        
        return {
            "project": {
                "name": project["name"],
                "description": project.get("description", ""),
                "layout_direction": project.get("layout_direction", "TB"),
                "category_tags": project.get("category_tags", [])
            },
            "nodes": nodes,
            "relationships": relationships,
            "contexts": contexts,
            "variables": variables,
            "commands": commands,
            "findings": findings,
            "tags": tags,
            "scope_assets": scope_assets
        }

    async def export_template(
        self,
        template_id: str,
        user: User,
        encryption_method: EncryptionMethod,
        password: Optional[str] = None
    ) -> Tuple[str, Optional[str]]:
        """Export a template to an encrypted file."""
        
        # Generate password if needed
        generated_password = None
        if encryption_method == EncryptionMethod.GENERATED:
            generated_password = self.generate_secure_password()
            password = generated_password
        elif encryption_method == EncryptionMethod.PASSWORD and not password:
            raise ValueError("Password required for password encryption method")

        async with self.driver.session() as session:
            # Fetch template data
            template_data = await self._fetch_template_data(session, template_id, str(user.id))
            
            if not template_data:
                raise ValueError("Template not found or access denied")

            # Sanitize sensitive data
            # Blank out variable values
            for context in template_data["contexts"]:
                context["variables"] = []  # Remove all variables for security
            
            # Remove command outputs
            for command in template_data["commands"]:
                command.pop("output", None)

            # Prepare export data
            export_data = {
                "format": "pwnflow-template",
                "version": "1.0",
                "metadata": {
                    "format": "pwnflow-template",
                    "version": "1.0",
                    "exported_at": datetime.utcnow().isoformat(),
                    "pwnflow_version": "1.1.0",
                    "template_name": template_data["template"]["name"],
                    "author": "anonymous",  # Privacy
                    "node_count": len(template_data["nodes"]),
                    "is_public": template_data["template"].get("is_public", False),
                    "checksum": ""
                },
                "template": template_data["template"],
                "nodes": template_data["nodes"],
                "relationships": template_data["relationships"],
                "contexts": template_data["contexts"],
                "commands": template_data["commands"],
                "tags": template_data["tags"]
            }

            # Calculate checksum
            data_json = json.dumps(export_data["template"], sort_keys=True)
            export_data["metadata"]["checksum"] = self.calculate_checksum(data_json)

            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.pwnflow-template', delete=False) as tmp_file:
                filename = tmp_file.name
                
                with zipfile.ZipFile(filename, 'w') as zf:
                    # Write metadata (unencrypted)
                    zf.writestr('metadata.json', json.dumps(export_data["metadata"], indent=2))
                    
                    # Prepare data for encryption
                    data_bytes = json.dumps({
                        "template": export_data["template"],
                        "nodes": export_data["nodes"],
                        "relationships": export_data["relationships"],
                        "contexts": export_data["contexts"],
                        "commands": export_data["commands"],
                        "tags": export_data["tags"]
                    }).encode()
                    
                    if encryption_method == EncryptionMethod.NONE:
                        # No encryption
                        zf.writestr('data.json', data_bytes)
                    else:
                        # Encrypt data
                        salt, nonce, ciphertext = self.encrypt_data(data_bytes, password)
                        zf.writestr('data.enc', ciphertext)
                        zf.writestr('salt.bin', salt)
                        zf.writestr('nonce.bin', nonce)

            return filename, generated_password

    async def _fetch_template_data(self, session, template_id: str, user_id: str) -> Dict[str, Any]:
        """Fetch all template data from Neo4j."""
        # Check if user owns the template or if it's public
        result = await session.run("""
            MATCH (t:Template {id: $template_id})
            WHERE (t)<-[:OWNS]-(:User {id: $user_id}) OR t.is_public = true
            RETURN t
        """, template_id=template_id, user_id=user_id)
        
        template_record = await result.single()
        if not template_record:
            return None
        
        template = dict(template_record["t"])
        # Convert DateTime objects to ISO strings
        if "created_at" in template and template["created_at"] and hasattr(template["created_at"], 'isoformat'):
            template["created_at"] = template["created_at"].isoformat()
        if "updated_at" in template and template["updated_at"] and hasattr(template["updated_at"], 'isoformat'):
            template["updated_at"] = template["updated_at"].isoformat()
        
        # Fetch nodes
        nodes_result = await session.run("""
            MATCH (t:Template {id: $template_id})-[:HAS_NODE]->(n:Node)
            OPTIONAL MATCH (n)-[:HAS_TAG]->(tag:Tag)
            RETURN n, collect(DISTINCT tag.name) as tags
        """, template_id=template_id)
        
        nodes = []
        async for record in nodes_result:
            node = dict(record["n"])
            # Convert DateTime objects to ISO strings
            if "created_at" in node and node["created_at"] and hasattr(node["created_at"], 'isoformat'):
                node["created_at"] = node["created_at"].isoformat()
            if "updated_at" in node and node["updated_at"] and hasattr(node["updated_at"], 'isoformat'):
                node["updated_at"] = node["updated_at"].isoformat()
            node["tags"] = record["tags"]
            nodes.append(node)
        
        # Fetch relationships
        relationships_result = await session.run("""
            MATCH (t:Template {id: $template_id})-[:HAS_NODE]->(source:Node)
            MATCH (source)-[:IS_LINKED_TO]->(target:Node)
            WHERE (t)-[:HAS_NODE]->(target)
            RETURN source.id as source, target.id as target
        """, template_id=template_id)
        
        relationships = [{"source": r["source"], "target": r["target"]} async for r in relationships_result]
        
        # Fetch contexts (sanitized)
        contexts_result = await session.run("""
            MATCH (t:Template {id: $template_id})-[:HAS_CONTEXT]->(c:Context)
            RETURN c
        """, template_id=template_id)
        
        contexts = []
        async for record in contexts_result:
            context = dict(record["c"])
            # Convert DateTime objects to ISO strings
            if "created_at" in context and context["created_at"] and hasattr(context["created_at"], 'isoformat'):
                context["created_at"] = context["created_at"].isoformat()
            if "updated_at" in context and context["updated_at"] and hasattr(context["updated_at"], 'isoformat'):
                context["updated_at"] = context["updated_at"].isoformat()
            contexts.append(context)
        
        # Fetch commands (without outputs)
        commands_result = await session.run("""
            MATCH (t:Template {id: $template_id})-[:HAS_NODE]->(n:Node)-[:HAS_COMMAND]->(cmd:Command)
            RETURN DISTINCT cmd, n.id as node_id
        """, template_id=template_id)
        
        commands = []
        async for record in commands_result:
            cmd = dict(record["cmd"])
            # Convert DateTime objects to ISO strings
            if "created_at" in cmd and cmd["created_at"] and hasattr(cmd["created_at"], 'isoformat'):
                cmd["created_at"] = cmd["created_at"].isoformat()
            if "updated_at" in cmd and cmd["updated_at"] and hasattr(cmd["updated_at"], 'isoformat'):
                cmd["updated_at"] = cmd["updated_at"].isoformat()
            cmd["node_id"] = record["node_id"]
            commands.append(cmd)
        
        # Fetch all unique tags
        tags_result = await session.run("""
            MATCH (t:Template {id: $template_id})-[:HAS_NODE]->(n:Node)-[:HAS_TAG]->(tag:Tag)
            RETURN DISTINCT tag.name as name
        """, template_id=template_id)
        
        tags = [record["name"] async for record in tags_result]
        
        return {
            "template": {
                "name": template["name"],
                "description": template.get("description", ""),
                "is_public": template.get("is_public", False),
                "category_tags": template.get("category_tags", [])
            },
            "nodes": nodes,
            "relationships": relationships,
            "contexts": contexts,
            "commands": commands,
            "tags": tags
        }
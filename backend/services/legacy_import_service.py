import json
import uuid
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
import asyncio
import logging

from neo4j import AsyncSession
from schemas.legacy_import import (
    LegacyProject, LegacyNode, LegacyEdge, LegacyTemplate,
    ImportProgress, ImportResult, LegacyFlowData
)
from schemas.project import ProjectCreate
from schemas.node import NodeCreate
from crud import project as project_crud
from crud import node as node_crud

logger = logging.getLogger(__name__)


class LegacyImportService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.progress = ImportProgress(
            total_nodes=0,
            processed_nodes=0,
            total_edges=0,
            processed_edges=0,
            current_step="Initializing",
            percentage=0.0
        )
        self.node_mappings: Dict[str, str] = {}  # old_id -> new_id
        self.edge_mappings: Dict[str, str] = {}  # old_id -> new_id
        self.errors: List[str] = []
        self.warnings: List[str] = []

    async def import_legacy_project(
        self,
        legacy_data: dict,
        user_id: str,
        progress_callback=None
    ) -> ImportResult:
        """Import a legacy project with all its nodes and relationships"""
        try:
            # Parse legacy data
            legacy_project = LegacyProject(**legacy_data)
            
            # Update progress
            await self._update_progress("Parsing legacy data", 10, progress_callback)
            
            # Extract nodes and edges from the appropriate location
            nodes, edges = self._extract_nodes_and_edges(legacy_project)
            
            self.progress.total_nodes = len(nodes)
            self.progress.total_edges = len(edges)
            
            # Create new project
            await self._update_progress("Creating project", 20, progress_callback)
            try:
                new_project = await self._create_project(legacy_project, user_id)
            except Exception as e:
                logger.error(f"Error creating project: {e}", exc_info=True)
                raise
            
            # Import nodes with UUID mapping
            await self._update_progress("Importing nodes", 30, progress_callback)
            await self._import_nodes(nodes, str(new_project.id), user_id, progress_callback)
            
            # Import edges with mapped UUIDs
            await self._update_progress("Importing relationships", 70, progress_callback)
            await self._import_edges(edges, str(new_project.id), progress_callback)
            
            # Import template if exists
            if legacy_project.template:
                await self._update_progress("Importing template", 90, progress_callback)
                await self._import_template(legacy_project.template, str(new_project.id), user_id)
            
            await self._update_progress("Import completed", 100, progress_callback)
            
            return ImportResult(
                project_id=str(new_project.id),
                original_id=legacy_project.id,
                node_mappings=self.node_mappings,
                edge_mappings=self.edge_mappings,
                imported_nodes=self.progress.processed_nodes,
                imported_edges=self.progress.processed_edges,
                errors=self.errors,
                warnings=self.warnings
            )
            
        except Exception as e:
            logger.error(f"Legacy import failed: {e}", exc_info=True)
            self.errors.append(f"Import failed: {str(e)}")
            raise

    def _extract_nodes_and_edges(self, legacy_project: LegacyProject) -> Tuple[List[LegacyNode], List[LegacyEdge]]:
        """Extract nodes and edges from various possible locations in legacy data"""
        nodes = []
        edges = []
        
        # Try different locations for nodes/edges
        if legacy_project.nodes and legacy_project.edges:
            nodes = legacy_project.nodes
            edges = legacy_project.edges
        elif legacy_project.flowData:
            nodes = legacy_project.flowData.nodes
            edges = legacy_project.flowData.edges
        elif legacy_project.template and legacy_project.template.flowData:
            nodes = legacy_project.template.flowData.nodes
            edges = legacy_project.template.flowData.edges
            
        return nodes, edges

    async def _create_project(self, legacy_project: LegacyProject, user_id: str):
        """Create new project from legacy data"""
        from uuid import UUID
        
        project_data = ProjectCreate(
            name=legacy_project.name or f"Imported Project {datetime.now().strftime('%Y-%m-%d')}",
            description=legacy_project.description or "",
            category_tags=legacy_project.tags if legacy_project.tags else []
        )
        
        # Create the project
        new_project = await project_crud.create_project(
            session=self.session,
            project_in=project_data,
            owner_id=UUID(user_id)
        )
        
        # Store legacy metadata on the project node
        if new_project:
            metadata_query = """
            MATCH (p:Project {id: $project_id})
            SET p.legacy_id = $legacy_id,
                p.imported_from = 'legacy',
                p.imported_at = datetime()
            RETURN p
            """
            await self.session.run(
                metadata_query,
                {
                    "project_id": str(new_project.id),
                    "legacy_id": legacy_project.id
                }
            )
        
        return new_project

    async def _import_nodes(
        self,
        nodes: List[LegacyNode],
        project_id: str,
        user_id: str,
        progress_callback=None
    ):
        """Import nodes with UUID mapping"""
        base_progress = 30
        progress_per_node = 40 / max(len(nodes), 1)
        
        for i, legacy_node in enumerate(nodes):
            try:
                # Generate new UUID
                new_node_id = str(uuid.uuid4())
                self.node_mappings[legacy_node.id] = new_node_id
                
                # Transform legacy node data
                node_data = self._transform_node_data(legacy_node)
                
                # Create node
                query = """
                CREATE (n:Node {
                    id: $node_id,
                    title: $title,
                    description: $description,
                    node_type: $node_type,
                    status: $status,
                    x_pos: $x_pos,
                    y_pos: $y_pos,
                    findings: $findings,
                    created_at: datetime(),
                    updated_at: datetime()
                })
                WITH n
                MATCH (p:Project {id: $project_id})
                CREATE (p)-[:HAS_NODE]->(n)
                RETURN n.id as node_id
                """
                
                # Extract position coordinates
                x_pos = legacy_node.position.get('x', 0) if isinstance(legacy_node.position, dict) else 0
                y_pos = legacy_node.position.get('y', 0) if isinstance(legacy_node.position, dict) else 0
                
                await self.session.run(
                    query,
                    {
                        "node_id": new_node_id,
                        "title": node_data["title"],
                        "description": node_data["description"],
                        "node_type": node_data.get("node_type", "custom"),
                        "status": node_data.get("status", "NOT_STARTED"),
                        "x_pos": float(x_pos),
                        "y_pos": float(y_pos),
                        "findings": "",
                        "project_id": project_id
                    }
                )
                
                # Import commands if present
                if legacy_node.data.commands:
                    await self._import_node_commands(
                        new_node_id,
                        legacy_node.data.commands,
                        project_id
                    )
                
                # Import tags if present
                if legacy_node.data.tags:
                    await self._import_node_tags(
                        new_node_id,
                        legacy_node.data.tags,
                        project_id
                    )
                
                self.progress.processed_nodes += 1
                current_progress = base_progress + (i + 1) * progress_per_node
                await self._update_progress(
                    f"Importing node {i+1}/{len(nodes)}",
                    current_progress,
                    progress_callback
                )
                
            except Exception as e:
                logger.error(f"Failed to import node {legacy_node.id}: {e}")
                self.errors.append(f"Node {legacy_node.data.name}: {str(e)}")

    def _transform_node_data(self, legacy_node: LegacyNode) -> dict:
        """Transform legacy node data to new format"""
        return {
            "title": legacy_node.data.name,
            "description": legacy_node.data.description,
            "node_type": legacy_node.type,
            "status": legacy_node.data.status,
            "metadata": {
                "expanded": legacy_node.data.expanded,
                "expandable": legacy_node.data.expandable,
                "properties": legacy_node.data.properties,
                "legacy_id": legacy_node.id
            }
        }

    async def _import_node_commands(self, node_id: str, commands: List[Any], project_id: str):
        """Import commands for a node"""
        for cmd in commands:
            if isinstance(cmd, dict):
                command_id = str(uuid.uuid4())
                query = """
                CREATE (c:Command {
                    id: $cmd_id,
                    title: $title,
                    command: $command,
                    description: $description,
                    created_at: datetime()
                })
                WITH c
                MATCH (n:Node {id: $node_id})
                CREATE (n)-[:HAS_COMMAND]->(c)
                """
                
                await self.session.run(
                    query,
                    {
                        "cmd_id": command_id,
                        "node_id": node_id,
                        "title": cmd.get("title", "Imported Command"),
                        "command": cmd.get("command", ""),
                        "description": cmd.get("description", "")
                    }
                )

    async def _import_node_tags(self, node_id: str, tags: List[str], project_id: str):
        """Import tags for a node"""
        for tag_name in tags:
            # First, ensure tag exists
            tag_query = """
            MERGE (t:Tag {name: $tag_name})
            RETURN t.id as tag_id
            """
            result = await self.session.run(tag_query, {"tag_name": tag_name})
            record = await result.single()
            
            if record:
                # Link tag to node
                link_query = """
                MATCH (n:Node {id: $node_id})
                MATCH (t:Tag {name: $tag_name})
                MERGE (n)-[:HAS_TAG]->(t)
                """
                await self.session.run(
                    link_query,
                    {"node_id": node_id, "tag_name": tag_name}
                )

    async def _import_edges(
        self,
        edges: List[LegacyEdge],
        project_id: str,
        progress_callback=None
    ):
        """Import edges with mapped UUIDs"""
        base_progress = 70
        progress_per_edge = 20 / max(len(edges), 1)
        
        for i, legacy_edge in enumerate(edges):
            try:
                # Map old IDs to new IDs
                source_id = self.node_mappings.get(legacy_edge.source)
                target_id = self.node_mappings.get(legacy_edge.target)
                
                if not source_id or not target_id:
                    self.warnings.append(
                        f"Edge {legacy_edge.id}: Missing node mapping for "
                        f"source={legacy_edge.source} or target={legacy_edge.target}"
                    )
                    continue
                
                # Create relationship
                rel_type = self._determine_relationship_type(legacy_edge)
                query = f"""
                MATCH (s:Node {{id: $source_id}})
                MATCH (t:Node {{id: $target_id}})
                CREATE (s)-[r:{rel_type} {{
                    id: $rel_id,
                    created_at: datetime(),
                    legacy_id: $legacy_id
                }}]->(t)
                RETURN r.id as rel_id
                """
                
                new_edge_id = str(uuid.uuid4())
                await self.session.run(
                    query,
                    {
                        "source_id": source_id,
                        "target_id": target_id,
                        "rel_id": new_edge_id,
                        "legacy_id": legacy_edge.id
                    }
                )
                
                self.edge_mappings[legacy_edge.id] = new_edge_id
                self.progress.processed_edges += 1
                
                current_progress = base_progress + (i + 1) * progress_per_edge
                await self._update_progress(
                    f"Importing relationship {i+1}/{len(edges)}",
                    current_progress,
                    progress_callback
                )
                
            except Exception as e:
                logger.error(f"Failed to import edge {legacy_edge.id}: {e}")
                self.errors.append(f"Edge {legacy_edge.id}: {str(e)}")

    def _determine_relationship_type(self, edge: LegacyEdge) -> str:
        """Determine relationship type from legacy edge data"""
        # Use IS_LINKED_TO as per the backend Node model
        return "IS_LINKED_TO"

    async def _import_template(
        self,
        template: LegacyTemplate,
        project_id: str,
        user_id: str
    ):
        """Import template data if present"""
        try:
            # Create template linked to project
            template_id = str(uuid.uuid4())
            query = """
            CREATE (t:Template {
                id: $template_id,
                name: $name,
                description: $description,
                created_at: datetime(),
                updated_at: datetime(),
                metadata: $metadata
            })
            WITH t
            MATCH (p:Project {id: $project_id})
            CREATE (p)-[:BASED_ON]->(t)
            RETURN t.id as template_id
            """
            
            await self.session.run(
                query,
                {
                    "template_id": template_id,
                    "name": template.name,
                    "description": template.description,
                    "project_id": project_id,
                    "metadata": json.dumps({
                        "legacy_id": template.id,
                        "imported_at": datetime.now().isoformat()
                    })
                }
            )
            
        except Exception as e:
            logger.error(f"Failed to import template: {e}")
            self.warnings.append(f"Template import: {str(e)}")

    async def _update_progress(
        self,
        step: str,
        percentage: float,
        callback=None
    ):
        """Update and report progress"""
        self.progress.current_step = step
        self.progress.percentage = percentage
        
        if callback:
            await callback(self.progress)
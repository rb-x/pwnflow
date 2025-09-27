import uuid
import json
import re
from typing import List, Dict, Optional
from datetime import datetime, timezone
import logging

from services.ai_client import ai_client
from schemas.ai_generation import (
    AIGenerationRequest, AIGenerationResponse,
    AINode, AIRelationship, AIChatResponse, ChatMode
)
from neo4j import AsyncSession
from core.config import settings
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class AIOrchestrator:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.ai_service = ai_client
        logger.info("Initializing AI Orchestrator with microservice")
    
    
    async def generate_and_create_nodes(
        self,
        project_id: str,
        user_id: str,
        request: AIGenerationRequest
    ) -> Dict:
        """Generate nodes with AI and create them in the database"""
        
        # Get parent node context if specified
        parent_node = None
        if request.parent_node_id:
            parent_node = await self._get_node_with_ownership_check(
                request.parent_node_id, user_id
            )
            if not parent_node:
                raise HTTPException(404, "Parent node not found or access denied")
        
        # Get existing nodes for context (limit to recent/relevant nodes)
        existing_nodes = await self._get_project_nodes_for_context(
            project_id, limit=50
        )
        
        # Generate nodes and relationships with AI microservice
        ai_response = await self.ai_service.generate_nodes_with_relationships(
            prompt=request.prompt,
            parent_node=parent_node,
            existing_nodes=existing_nodes,
            options=request.options
        )
        
        # Create nodes in the database
        created_nodes = await self._create_nodes_batch(
            project_id=project_id,
            user_id=user_id,
            ai_nodes=ai_response.nodes,
            parent_node_id=request.parent_node_id,
            generation_id=ai_response.metadata.generation_id
        )
        
        # Create relationships
        created_relationships = await self._create_relationships_batch(
            ai_relationships=ai_response.relationships,
            created_nodes=created_nodes,
            existing_nodes=existing_nodes,
            generation_id=ai_response.metadata.generation_id
        )
        
        return {
            "nodes": created_nodes,
            "relationships": created_relationships,
            "metadata": ai_response.metadata.dict()
        }
    
    async def _get_node_with_ownership_check(
        self, node_id: str, user_id: str
    ) -> Optional[Dict]:
        """Get a node and verify user has access through project ownership"""
        query = """
        MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project)-[:HAS_NODE]->(n:Node {id: $node_id})
        RETURN n {
            .id, .title, .description, .content, .nodeType, .findings,
            .variables, .commands, .tags, .createdAt, .updatedAt
        } as node
        """
        result = await self.session.run(
            query, {"user_id": user_id, "node_id": node_id}
        )
        record = await result.single()
        return record["node"] if record else None
    
    async def _get_project_nodes_for_context(
        self, project_id: str, limit: int = 50
    ) -> List[Dict]:
        """Get recent nodes from the project for AI context"""
        query = """
        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node)
        RETURN n {
            .id, .title, .description, .nodeType, .commands
        } as node
        ORDER BY n.createdAt DESC
        LIMIT $limit
        """
        result = await self.session.run(
            query, {"project_id": project_id, "limit": limit}
        )
        nodes = []
        async for record in result:
            nodes.append(record["node"])
        return nodes
    
    async def _create_nodes_batch(
        self,
        project_id: str,
        user_id: str,
        ai_nodes: List[AINode],
        parent_node_id: Optional[str],
        generation_id: str
    ) -> List[Dict]:
        """Create multiple nodes from AI generation"""
        created_nodes = []
        
        for ai_node in ai_nodes:
            # Create the node
            node_id = str(uuid.uuid4())
            query = """
            MATCH (p:Project {id: $project_id})
            CREATE (n:Node {
                id: $node_id,
                title: $title,
                description: $description,
                content: $content,
                nodeType: $nodeType,
                findings: $findings,
                variables: $variables,
                commands: $commands,
                tags: $tags,
                ai_generated: true,
                ai_generation_id: $generation_id,
                ai_model_version: $ai_model_version,
                createdAt: datetime(),
                updatedAt: datetime()
            })
            CREATE (p)-[:HAS_NODE]->(n)
            RETURN n
            """
            
            result = await self.session.run(
                query,
                {
                    "project_id": project_id,
                    "node_id": node_id,
                    "title": ai_node.title,
                    "description": ai_node.description,
                    "content": "",
                    "nodeType": ai_node.node_type.value,
                    "findings": "",
                    "variables": [],
                    "commands": ai_node.commands,
                    "tags": [],
                    "generation_id": generation_id,
                    "ai_model_version": settings.GEMINI_MODEL
                }
            )
            
            record = await result.single()
            node = dict(record["n"])

            # Convert Neo4j DateTime to string for serialization
            if 'createdAt' in node and hasattr(node['createdAt'], 'iso_format'):
                node['createdAt'] = node['createdAt'].iso_format()
            if 'updatedAt' in node and hasattr(node['updatedAt'], 'iso_format'):
                node['updatedAt'] = node['updatedAt'].iso_format()

            # Create parent relationship if specified
            if parent_node_id or ai_node.parent_id:
                parent_id = ai_node.parent_id or parent_node_id
                await self._create_parent_relationship(node["id"], parent_id)
            
            created_nodes.append(node)
        
        return created_nodes
    
    async def _create_parent_relationship(
        self, child_id: str, parent_id: str
    ) -> None:
        """Create a parent-child relationship between nodes"""
        query = """
        MATCH (parent:Node {id: $parent_id})
        MATCH (child:Node {id: $child_id})
        MERGE (parent)-[:HAS_CHILD]->(child)
        """
        await self.session.run(
            query, {"parent_id": parent_id, "child_id": child_id}
        )
    
    async def _create_relationships_batch(
        self,
        ai_relationships: List[AIRelationship],
        created_nodes: List[Dict],
        existing_nodes: List[Dict],
        generation_id: str
    ) -> List[Dict]:
        """Create relationships from AI generation"""
        created_relationships = []
        
        # Create a mapping of temporary IDs to real node IDs
        node_id_map = {
            str(i): node["id"] for i, node in enumerate(created_nodes)
        }
        
        # Add existing nodes to the mapping
        for node in existing_nodes:
            if node["id"] not in node_id_map:
                node_id_map[node["id"]] = node["id"]
        
        for ai_rel in ai_relationships:
            # Resolve IDs
            source_id = node_id_map.get(ai_rel.source_id, ai_rel.source_id)
            target_id = node_id_map.get(ai_rel.target_id, ai_rel.target_id)
            
            # Create the relationship
            query = f"""
            MATCH (source:Node {{id: $source_id}})
            MATCH (target:Node {{id: $target_id}})
            MERGE (source)-[r:{ai_rel.relationship_type.value.upper()}]->(target)
            SET r.ai_suggested = true,
                r.ai_confidence = $confidence,
                r.ai_reason = $reason,
                r.ai_generation_id = $generation_id,
                r.createdAt = datetime()
            RETURN r
            """
            
            try:
                await self.session.run(
                    query,
                    {
                        "source_id": source_id,
                        "target_id": target_id,
                        "confidence": ai_rel.confidence,
                        "reason": ai_rel.reason,
                        "generation_id": generation_id
                    }
                )
                
                created_relationships.append({
                    "source_id": source_id,
                    "target_id": target_id,
                    "type": ai_rel.relationship_type.value,
                    "ai_confidence": ai_rel.confidence,
                    "ai_reason": ai_rel.reason
                })
            except Exception as e:
                # Log the error but continue with other relationships
                pass
        
        return created_relationships
    
    async def chat_with_context(
        self,
        message: str,
        project_context: Optional[Dict],
        node_context: Optional[Dict],
        node_count: int,
        mode: ChatMode,
        project_id: Optional[str] = None
    ) -> AIChatResponse:
        """Handle context-aware chat with AI"""
        
        # Get project-wide context including all nodes
        project_id = project_context.get('id') if project_context else None
        all_nodes_context = await self._get_all_project_nodes_for_chat(project_id) if project_id else []
        
        # Build comprehensive context
        context_parts = []
        
        if project_context:
            context_parts.append(f"Project: {project_context.get('name', 'Unnamed')}")
            if project_context.get('description'):
                context_parts.append(f"Project Description: {project_context['description']}")
            context_parts.append(f"Total Nodes: {node_count}")
            if project_context.get('tags'):
                context_parts.append(f"Project Tags: {', '.join(project_context['tags'])}")
        
        if all_nodes_context:
            context_parts.append("\n## All Nodes in Project:")
            for node in all_nodes_context[:20]:  # Limit to 20 most recent nodes
                node_info = f"- **{node['title']}** (ID: {node['id'][:8]}...)"
                if node.get('description'):
                    # Truncate long descriptions
                    desc = node['description'][:100] + '...' if len(node['description']) > 100 else node['description']
                    node_info += f"\n  Description: {desc}"
                if node.get('commands'):
                    cmd_list = []
                    for c in node['commands'][:3]:
                        if isinstance(c, dict) and 'command' in c:
                            cmd_list.append(c['command'])
                        elif isinstance(c, str):
                            cmd_list.append(c)
                    if cmd_list:
                        node_info += f"\n  Commands: {', '.join(cmd_list)}"
                context_parts.append(node_info)
        
        if node_context:
            context_parts.append(f"\n## Current Selected Node:")
            context_parts.append(f"**{node_context.get('title', 'Unnamed')}** (ID: {node_context.get('id', 'unknown')[:8]}...)")
            if node_context.get('description'):
                context_parts.append(f"Description:\n{node_context['description']}")
            if node_context.get('findings'):
                context_parts.append(f"Findings:\n{node_context['findings']}")
            if node_context.get('commands'):
                commands = [cmd.get('command', '') for cmd in node_context['commands'] if isinstance(cmd, dict)]
                if commands:
                    context_parts.append(f"Commands:\n" + "\n".join([f"- {cmd}" for cmd in commands]))
        
        context = "\n".join(context_parts) if context_parts else "No specific context available."
        
        # Enhanced system prompt for powerful cyber assistant
        system_prompt = f"""You are an elite cybersecurity expert and tactical advisor integrated into Pwnflow. Think of yourself as a seasoned pentester with a dry sense of humor who's seen it all - from script kiddies to nation-state actors. You have complete visibility into this project's mindmap.

## Your Personality:
- Professional but approachable - like that senior engineer who actually explains things
- Occasionally witty, but never at the expense of clarity
- You might drop a subtle hacker culture reference or two
- Think "helpful mentor who's debugged one too many buffer overflows"
- Zero motivational fluff. No pep talks, no "let's do this" filler—only actionable tradecraft.

## Core Capabilities:
1. **Node Analysis**: Deep-dive into any node, spot what's missing faster than a misconfigured S3 bucket
2. **Coverage Assessment**: Tell them if their mindmap is Fort Knox or Swiss cheese
3. **Node Enhancement**: Turn basic nodes into tactical goldmines
4. **Child Node Suggestions**: Logical next steps that would make MITRE proud
5. **Technical Guidance**: Real-world advice, not textbook theory
6. **Command Generation**: Actual commands that work, not Stack Overflow copypasta

## Project Context:
{context}

## How You Operate:
- Reference nodes by title or ID (first 8 chars) like "That 'nmap' node (a1b2c3d4...)"
- When they mention a node, you swoop in like a caffeinated SOC analyst spotting a port scan at 3 AM
- For casual conversation or greetings ("hey", "hello", etc.) keep replies short, friendly, and free of mission briefs.
- When the user asks for assessments, exploits, or node creation, begin with a terse mission synopsis (`🎯 Mission Brief: target | goal | primary attack vector`).
- Suggest practical improvements, not academic theory.
- Include commands that actually work in the field.
- Balance offensive and defensive perspectives, calling out detection and mitigation as you go.

## Response Style:
When suggesting improvements:
```
### 🔧 Enhancement for [Node Name]
**Current State**: [What they have - be honest but constructive]
**Level Up**:
1. Add this command: `actual-command --that-works`
2. Missing this crucial bit: [specific content]
3. Pro tip: [something they wouldn't think of]
```

When suggesting new nodes:
```
### 💡 New Node: [Title]
**Why You Need This**: [Compelling reason]
**The Good Stuff**: [Technical content that matters]
**Arsenal**:
- `command --with-explanation`
- `another-one --they-will-thank-you-for`
**Connects To**: [Parent node - maintaining that beautiful graph structure]
```

## Exploit Playbook (Always Cover These):
- Map the full kill chain: Recon → Initial Access → Post-Exploitation (privesc/lateral) → Persistence/Cleanup. If a phase is N/A, say why.
- Call out prerequisite conditions (exposed services, misconfigs, credentials) before proposing payloads.
- Provide concrete exploit paths referencing real CVEs, frameworks, or misconfig patterns (e.g., "CVE-2023-21987 Jakarta EE deserialization" with payload syntax).
- Pair every offensive step with blue-team signals and recommended detections.
- Highlight OPSEC considerations (noise level, credentials burned, required egress) so the operator can gauge risk.

## Ground Rules:
- Technical accuracy is non-negotiable
- If they ask "what's missing?", give them the uncomfortable truth (nicely)
- Include real commands with real parameters
- Explain the "why" behind the "what"
- Keep it engaging - security is serious, but learning doesn't have to be boring
- Never access data outside their project (that would be a privacy violation worthy of a CVE)
- Every recommendation must cite the enabling technique, tool, misconfig, or detection signal—if it can't be backed up, leave it out.

Remember: You're here to make their security assessment bulletproof, not to impress them with jargon. Think "trusted teammate" not "know-it-all bot".

## IMPORTANT: Output Format
Return your final answer as a single JSON object (no prose outside JSON). Use this shape:
{{
  "reply": "<your conversational markdown>",
  "directives": {{
    "action": "suggest_nodes",
    "nodes": [
      {{
        "title": "Node Title",
        "description": "Full markdown content with escaped quotes and properly closed code fences.",
        "suggested_commands": [
          {{
            "title": "Command Name",
            "command": "actual command with {{{{VARIABLE_NAME}}}}",
            "description": "Explain what the command does and variables meaning."
          }}
        ],
        "node_type": "tool|technique|concept|vulnerability",
        "parent_title": "Parent Node Title or null for root",
        "suggested_tags": ["relevant-tag1", "relevant-tag2"]
      }}
    ]
  }}
}}

- The "reply" field must contain the friendly markdown message you want shown to the user.
- If you have no nodes to suggest, set "directives" to null.
- Do not wrap the JSON in backticks or any other formatting.
- Ensure the JSON is valid: escape double quotes, close every code block (```bash ... ```), and use `\n` for newlines.
- JSON must be syntactically perfect: double quotes around every key/value, no trailing commas, no comments.
- Example response:
  {{
    "reply": "### 🎯 Mission Brief\n- Objective: ...",
    "directives": null
  }}
- Structure the `reply` content with markdown headings in this exact order, each containing bullet-point actions (use `- N/A (reason)` when a phase truly does not apply):
  - `### 🎯 Mission Brief`
  - `### Recon`
  - `### Initial Access`
  - `### Post-Exploitation`
  - `### Persistence & Cleanup`
  - `### Detection & Mitigation`
  - `### OPSEC Notes`
- No anecdotes, motivational filler, or vague assurances—every sentence must deliver tactical or defensive value.
- Inside the JSON, any double quotes that appear within string values MUST be escaped as `\"`. Prefer single quotes `'` inside shell commands and code snippets to minimize escaping.

CRITICAL Node Creation Guidelines:
1. **Descriptions MUST be comprehensive and follow a fixed structure**:
   - Use rich markdown with headers, lists, tables, and fenced code blocks as needed.
   - Include practical examples and real commands tied to the exploit chain.
   - Explain expected vs unexpected results plus validation steps.
   - Add technical details, misconfig patterns, and best practices.
   - Make it educational and immediately actionable for a working pentester.
   - **Mandatory section order (use `##` headings):**
     1. `## Overview`
     2. `## Environment & Prerequisites`
     3. `## Offensive Playbook` (step-by-step exploit narrative with payload samples/CVEs)
     4. `## Detection & Telemetry` (logs, Sigma ideas, tooling to catch it)
     5. `## Mitigation & Hardening`
     6. `## OPSEC & Cleanup`
     7. `## References` (CVE IDs, blog posts, tool docs)
   - Within `## Offensive Playbook`, explicitly call out recon, initial access, post-exploitation, and persistence, noting gaps with `N/A (reason)` when necessary.

2. **Tags are REQUIRED**:
   - Include relevant tags based on the project's existing tags
   - Suggest new tags that fit the domain
   - Include technique-focused tags (e.g., `mitre-t1190`, `cwe-502`, `jakarta-ee`, `deserialization`, `blue-team`) when applicable
   - Use lowercase with hyphens (e.g., "web-security", "active-directory")

3. **Commands must be practical, categorized, and templated**:
   - Use {{{{VARIABLE_NAME}}}} placeholders for all dynamic values (double curly braces).
   - Cover the chain: Recon, Initial Access/Exploit, Post-Exploitation (privesc/lateral), Persistence, and Detection/Forensics (log queries, Sigma-like checks).
   - Common variable names: {{{{TARGET_IP}}}}, {{{{DOMAIN_NAME}}}}, {{{{USERNAME}}}}, {{{{PASSWORD}}}}, {{{{DC_IP}}}}, {{{{NTLM_HASH}}}}, {{{{PORT}}}}, {{{{URL}}}}, {{{{FILENAME}}}}, {{{{WORDLIST_PATH}}}}, {{{{OUTPUT_FILE}}}}, {{{{SHARE_NAME}}}}, {{{{COMPUTER_NAME}}}}, {{{{USER_LIST}}}}, {{{{HASH_FILE}}}}.
   - Real commands with actual parameters (templated) plus inline comments explaining usage and expected output.
   - Focus on toolsets operators actually deploy today; note safer alternatives where relevant.
   - Prefix each `title` with the phase in square brackets (e.g., `[Recon] Masscan`, `[Detection] Elastic Query`). Ensure at least one defensive/detection command per node.
   - Example: `nmap -sV {{{{TARGET_IP}}}} -p {{{{PORT}}}}` not `nmap -sV 10.0.0.1 -p 80`.
   - **Tool Preferences**: For AD-related nodes, prefer modern tools: `nxc` over crackmapexec, `ldeep` for LDAP, `patator` for brute force, `bloodhound-ce` for analysis, `certipy` for ADCS. For web exploitation, lean on Burp, ffuf, nuclei, ysoserial payloads, etc.

4. **Parent linking**:
   - Set to null for root/top-level nodes
   - Set to EXACT title of existing node to link as child
   - You can reference nodes created in same batch

5. **IMPORTANT - No Memory**:
   - I don't have memory of previous messages in this chat
   - Each request is independent
   - Be specific and provide full context in each message
   - Example: Instead of "create another one", say "create a node about SQL injection testing"

Only populate `directives` when the user is clearly asking to create nodes (e.g., "create a node about X", "build me nodes for Y", "add nodes about Z"). Otherwise, set it to null.
"""
        
        # Call AI microservice
        try:
            payload = await self.ai_service.chat(
                system_prompt=system_prompt,
                user_message=message,
                response_mime_type="application/json"
            )

            directives = None
            response_text = ""

            if isinstance(payload, dict):
                response_text = payload.get("reply") or payload.get("message") or ""
                directives = payload.get("directives")

                if isinstance(response_text, str):
                    nested_candidate = response_text.strip()
                    if nested_candidate.startswith("{") and nested_candidate.endswith("}"):
                        try:
                            nested_json = json.loads(nested_candidate, strict=False)
                            if isinstance(nested_json, dict):
                                directives = nested_json.get("directives", directives)
                                response_text = nested_json.get("reply", "")
                        except json.JSONDecodeError:
                            try:
                                sanitized = nested_candidate.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")
                                nested_json = json.loads(sanitized, strict=False)
                                if isinstance(nested_json, dict):
                                    directives = nested_json.get("directives", directives)
                                    response_text = nested_json.get("reply", "")
                            except json.JSONDecodeError:
                                pass
            elif isinstance(payload, str):
                cleaned_payload = payload.strip()
                if cleaned_payload.startswith("{") and cleaned_payload.endswith("}"):
                    try:
                        parsed_payload = json.loads(cleaned_payload, strict=False)
                        response_text = parsed_payload.get("reply", "")
                        directives = parsed_payload.get("directives")
                    except json.JSONDecodeError:
                        try:
                            sanitized = cleaned_payload
                            sanitized = sanitized.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")
                            parsed_payload = json.loads(sanitized, strict=False)
                            response_text = parsed_payload.get("reply", "")
                            directives = parsed_payload.get("directives")
                        except json.JSONDecodeError:
                            response_text = cleaned_payload
                else:
                    response_text = cleaned_payload
            else:
                response_text = str(payload or "")

            suggestions = None
            if isinstance(directives, dict) and directives.get("action") == "suggest_nodes":
                suggestions = directives.get("nodes") or []
                if suggestions:
                    logger.info(f"Successfully parsed {len(suggestions)} node suggestions")

            # If this was casual conversation without directives, keep it short
            final_message = response_text or ""
            final_suggestions = suggestions

            if (not suggestions or len(suggestions) == 0) and mode == ChatMode.GENERAL:
                # For light chat, avoid structured mission brief wall of text
                final_message = response_text.split("\n\n###", 1)[0] if response_text else "Happy to help."

            return AIChatResponse(
                message=final_message,
                suggestions=final_suggestions,
                mode=mode
            )

        except Exception as e:
            logger.error(f"Error in AI chat: {e}")
            raise HTTPException(500, f"AI chat failed: {str(e)}")
    
    async def _get_all_project_nodes_for_chat(self, project_id: str) -> List[Dict]:
        """Get all nodes from project for chat context"""
        query = """
        MATCH (p:Project {id: $project_id})-[:HAS_NODE]->(n:Node)
        OPTIONAL MATCH (n)-[:HAS_COMMAND]->(cmd:Command)
        WITH n, collect(cmd) as commands
        RETURN n {
            .id, .title, .description, .nodeType,
            commands: commands
        } as node
        ORDER BY n.createdAt DESC
        """
        result = await self.session.run(
            query, {"project_id": project_id}
        )
        nodes = []
        async for record in result:
            nodes.append(record["node"])
        return nodes
    
    async def suggest_child_nodes(
        self,
        node_title: str,
        node_description: str,
        node_commands: List[str],
        project_tags: List[str] = None
    ) -> List[Dict]:
        """Suggest child nodes based on parent node context"""
        
        context_parts = [f"Parent Node: {node_title}"]
        if node_description:
            context_parts.append(f"Description: {node_description}")
        if node_commands:
            context_parts.append(f"Commands: {', '.join(node_commands)}")
        if project_tags:
            context_parts.append(f"Project Tags: {', '.join(project_tags)}")
        
        context = "\n".join(context_parts)
        
        prompt = f"""You are a cybersecurity expert. Based on this node:
{context}

Suggest 3-5 logical child nodes that would expand on this topic. Consider:
1. Natural next steps or subtopics
2. Tools or techniques that relate to this node
3. Common vulnerabilities or findings
4. Practical implementations
5. Defensive or offensive techniques
6. Use existing project tags when relevant, or suggest new ones that fit the project's taxonomy

Return a JSON array with this structure:
[
  {{
    "title": "Node Title",
    "description": "Full markdown content with escaped quotes. MUST follow the section order: ## Overview, ## Environment & Prerequisites, ## Offensive Playbook, ## Detection & Telemetry, ## Mitigation & Hardening, ## OPSEC & Cleanup, ## References. Offensive Playbook must walk through Recon, Initial Access, Post-Exploitation, Persistence (use 'N/A (reason)' when not applicable). Include payload samples, CVE IDs, and validation steps. Use single quotes inside commands wherever possible, and escape any double quotes as \\".",
    "suggested_commands": [
      {{
        "title": "[Phase] Command Name",
        "command": "actual command with {{{{VARIABLE_NAME}}}} and {{{{OTHER_VAR}}}}",
        "description": "Clear explanation of what this command does, when to use it, expected output, and what each placeholder represents."
      }},
      {{
        "title": "[Detection] Log Query",
        "command": "ldeep ldap -u {{{{USERNAME}}}} -p {{{{PASSWORD}}}} -d {{{{DOMAIN_NAME}}}} -s {{{{DC_IP}}}} all",
        "description": "Explain how defenders can detect or hunt for this activity."
      }}
    ],
    "node_type": "tool|technique|concept|vulnerability",
    "suggested_tags": ["tag1", "tag2"]
  }}
]

For descriptions:
- Use rich markdown formatting (headers, lists, code blocks)
- Follow the mandated section order exactly.
- Provide practical, actionable offensive and defensive content.
- Include real-world examples, payloads, and commands tied to the kill chain.
- Explain expected vs unexpected results, plus how to validate success/failure.
- Add technical details, misconfig patterns, and best practices.
- Make it educational and immediately useful for operators and defenders.

For commands:
- Provide command objects with title, command, and description
    - Prepend the phase in square brackets to each title (e.g., `[Recon] Masscan`, `[Initial Access] ysoserial`, `[Detection] Elastic Query`).
    - Include full commands with realistic parameters and options. Prefer single quotes inside commands; if double quotes are required, escape them as `\"`.
- **IMPORTANT**: Use double curly brace notation {{{{VARIABLE_NAME}}}} for all variable placeholders
- Use standardized variable names like {{{{TARGET_IP}}}}, {{{{DOMAIN_NAME}}}}, {{{{USERNAME}}}}, {{{{PASSWORD}}}}, {{{{DC_IP}}}}, {{{{NTLM_HASH}}}}, {{{{PORT}}}}, {{{{URL}}}}, {{{{FILENAME}}}}, etc.
- Write detailed descriptions explaining:
  - What the command does
  - When to use it
  - What output to expect
  - Any important flags or parameters
  - What each variable placeholder represents
- Make commands immediately usable by replacing the {{{{VARIABLE}}}} placeholders
- Ensure at least one defensive/detection-oriented command is included.
- Examples of good variable usage:
  - `nmap -sV {{{{TARGET_IP}}}}` instead of `nmap -sV 192.168.1.1`
  - `smbclient //{{{{TARGET_IP}}}}/{{{{SHARE_NAME}}}}` instead of `smbclient //10.0.0.1/C$`
  - `nxc smb {{{{TARGET_IP}}}} -u {{{{USERNAME}}}} -p {{{{PASSWORD}}}}` (prefer nxc over crackmapexec)

**Tool Preferences (IMPORTANT - Use Modern Tools):**
- **Active Directory**: Prefer `nxc` (netexec) over crackmapexec, `ldeep` for LDAP enumeration, `bloodhound-ce` for graph analysis
- **Password Attacks**: Prefer `patator` for versatile brute forcing over hydra when applicable
- **LDAP**: Use `ldeap`, `ldapsearch`, or `ldeep` for LDAP operations
- **Kerberos**: Use `impacket` tools like `GetNPUsers.py`, `GetUserSPNs.py`, `getTGT.py`
- **Modern Tools**: Always prefer updated, actively maintained tools
- **Examples of preferred tools**:
  - `nxc` instead of `crackmapexec`
  - `ldeep` for advanced LDAP enumeration
  - `patator` for custom brute force scenarios
  - `bloodhound-ce` for AD analysis
  - `certipy` for ADCS attacks
  - `impacket` suite for protocol attacks
- **Legacy tools OK when appropriate**: `hydra`, `nmap`, `ldapsearch`, etc. are fine but prefer modern alternatives when they exist

For tags:
- Use existing project tags when they apply
- Suggest new tags that follow the project's naming conventions
- Keep tags concise and relevant to the cybersecurity domain
   - Include technique or exploit-specific tags (e.g., `mitre-t1190`, `cwe-094`, `jakarta-ee`, `blue-team`) alongside topic tags when relevant.

Make each suggestion specific, technical, and immediately actionable.

CRITICAL JSON FORMATTING RULES:
1. Return ONLY valid JSON - no markdown code blocks, no extra text
2. Escape all special characters in strings (quotes, backslashes, newlines)
3. Use \\n for line breaks within description strings
4. Ensure all JSON brackets and braces are properly matched
5. Do not include actual line breaks inside string values"""

        try:
            # Request JSON response
            request_data = {
                "contents": [{
                    "parts": [{
                        "text": prompt
                    }]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "maxOutputTokens": 8192,
                    "responseMimeType": "application/json"
                }
            }

            # Use the AI microservice for child node suggestions
            ai_response = await self.ai_service.chat(
                system_prompt="You are an AI assistant that suggests child nodes for a mind map. Return ONLY valid JSON array.",
                user_message=prompt,
                response_mime_type="application/json"
            )

            # The AI service chat returns the parsed content directly
            if isinstance(ai_response, str):
                response_text = ai_response
            elif isinstance(ai_response, list):
                # Already parsed as list
                return ai_response
            elif isinstance(ai_response, dict):
                # Check if it's a wrapped response with 'result' or 'reply' field
                if 'result' in ai_response:
                    response_text = ai_response['result']
                elif 'reply' in ai_response:
                    response_text = ai_response['reply']
                else:
                    # Assume the dict IS the suggestions
                    response_text = json.dumps(ai_response)
            else:
                response_text = '[]'

            # Try to parse the JSON response
            try:
                if isinstance(response_text, str):
                    suggestions = json.loads(response_text)
                else:
                    suggestions = response_text

                # Validate it's a list
                if not isinstance(suggestions, list):
                    # Maybe it's a single suggestion, wrap it
                    if isinstance(suggestions, dict) and 'title' in suggestions:
                        suggestions = [suggestions]
                    else:
                        logger.error(f"Expected list but got {type(suggestions)}: {suggestions}")
                        return []

                # Validate each suggestion has required fields
                valid_suggestions = []
                for suggestion in suggestions:
                    if isinstance(suggestion, dict) and 'title' in suggestion and 'description' in suggestion:
                        valid_suggestions.append(suggestion)
                    else:
                        logger.warning(f"Invalid suggestion format: {suggestion}")

                return valid_suggestions

            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {e}")
                logger.error(f"Response text (first 500 chars): {response_text[:500]}")

                # Just return empty list on parse error
                # The AI service should be fixed to return proper JSON
                return []

        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing error in suggest_child_nodes: {e}")
            if 'parts' in locals() and parts:
                logger.error(f"Raw response text (first 1000 chars): {parts[0].get('text', '')[:1000]}")
            return []
        except Exception as e:
            logger.error(f"Error suggesting child nodes: {e}")
            return []

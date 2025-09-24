import httpx
import json
import asyncio
import uuid
from typing import List, Dict, Optional, Any
from datetime import datetime
import time
import logging

from schemas.ai_generation import (
    AINode, AIRelationship, AIGenerationOptions,
    AIGenerationResponse, AIGenerationMetadata,
    NodeType, RelationshipType
)
from core.config import settings

logger = logging.getLogger(__name__)


class GeminiService:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        self.model = settings.GEMINI_MODEL  # Using configurable Gemini model
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def generate_nodes_with_relationships(
        self,
        prompt: str,
        parent_node: Optional[Dict],
        existing_nodes: List[Dict],
        options: AIGenerationOptions
    ) -> AIGenerationResponse:
        start_time = time.time()
        generation_id = str(uuid.uuid4())
        
        # Build the system prompt
        system_prompt = self._build_system_prompt(parent_node, existing_nodes, options)
        
        # Prepare the request
        request_data = {
            "contents": [{
                "parts": [{
                    "text": f"{system_prompt}\n\nUser request: {prompt}"
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 8192,  # Increased from 2048 to handle larger responses
                "responseMimeType": "application/json"
            }
        }
        
        # Make the API call
        url = f"{self.base_url}/{self.model}:generateContent"
        headers = {
            'Content-Type': 'application/json',
            'X-goog-api-key': self.api_key
        }
        
        logger.info(f"Making Gemini API call to model: {self.model}")
        logger.info(f"API URL: {url}")
        logger.info(f"API key present: {'Yes' if self.api_key else 'No'}")
        logger.info(f"Request prompt length: {len(prompt)} chars")
        
        try:
            response = await self.client.post(url, json=request_data, headers=headers)
            logger.info(f"Gemini API response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"Gemini API error response: {response.text}")
            
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logger.error(f"Gemini API HTTP error: {e}")
            logger.error(f"Response body: {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error calling Gemini API: {e}")
            raise
        
        result = response.json()
        logger.info(f"Gemini API response structure: {json.dumps(result, indent=2)[:500]}...")
        
        # Extract and parse the response
        try:
            # Handle different response formats
            candidates = result.get('candidates', [])
            if not candidates:
                raise ValueError("No candidates in Gemini response")
            
            content = candidates[0].get('content', {})
            parts = content.get('parts', [])
            
            if not parts:
                raise ValueError("No parts in Gemini response content")
            
            generated_text = parts[0].get('text', '')
            if not generated_text:
                raise ValueError("No text in Gemini response")
                
            parsed_response = json.loads(generated_text)
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            logger.error(f"Error parsing Gemini response: {e}")
            logger.error(f"Full response: {json.dumps(result, indent=2)}")
            raise ValueError(f"Failed to parse Gemini response: {e}")
        
        # Create AINode and AIRelationship objects
        ai_nodes = [AINode(**node) for node in parsed_response['nodes']]
        ai_relationships = [AIRelationship(**rel) for rel in parsed_response['relationships']]
        
        # Enhance relationships if auto_connect is enabled
        if options.auto_connect:
            enhanced_relationships = await self._enhance_relationships(
                ai_nodes, existing_nodes, ai_relationships
            )
        else:
            enhanced_relationships = ai_relationships
        
        # Calculate token usage (approximate)
        tokens_used = len(system_prompt.split()) + len(prompt.split()) + len(generated_text.split())
        
        metadata = AIGenerationMetadata(
            tokens_used=tokens_used,
            generation_time=time.time() - start_time,
            ai_model=self.model,
            parent_context_used=parent_node is not None,
            existing_nodes_analyzed=len(existing_nodes),
            generation_id=generation_id
        )
        
        return AIGenerationResponse(
            nodes=ai_nodes,
            relationships=enhanced_relationships,
            metadata=metadata
        )
    
    def _build_system_prompt(
        self,
        parent_node: Optional[Dict],
        existing_nodes: List[Dict],
        options: AIGenerationOptions
    ) -> str:
        parent_context = ""
        if parent_node:
            parent_context = f"""
Parent Node Context:
- ID: {parent_node.get('id')}
- Title: {parent_node.get('title')}
- Description: {parent_node.get('description')}
"""
        
        existing_context = ""
        if existing_nodes:
            node_summaries = []
            for node in existing_nodes[:10]:  # Limit to 10 nodes for context
                node_summaries.append(f"- {node.get('title')}: {node.get('description', '')[:100]}")
            existing_context = f"""
Existing Graph Context:
{chr(10).join(node_summaries)}
"""
        
        command_instruction = ""
        if options.include_commands:
            command_instruction = f"""
4. Include practical, executable commands for each node where relevant
5. Commands should be in {options.command_style} style
"""
        
        return f"""You are an AI assistant specialized in cybersecurity mind mapping.
Generate a structured mind map based on the user's request.

{parent_context}
{existing_context}

Instructions:
1. Create nodes with meaningful titles and detailed descriptions
2. Focus on creating intelligent relationships between nodes
3. Each node should have a clear purpose in the security context
{command_instruction}
6. Identify and create cross-references to existing nodes when relevant
7. MOST IMPORTANT: Create meaningful relationships that show dependencies, workflows, and connections

Constraints:
- Maximum depth: {options.max_depth}
- Maximum nodes: {min(options.max_nodes, 10)}  # Limited to avoid truncation
- Node types to use: {', '.join([t.value for t in options.node_types])}
- Relationship types to use: {', '.join([r.value for r in options.relationship_types])}

Return a JSON object with this exact structure:
{{
  "nodes": [
    {{
      "title": "Node Title",
      "description": "Detailed description of purpose and context",
      "commands": ["command1", "command2"],
      "node_type": "tool|technique|concept|vulnerability",
      "parent_id": "{parent_node.get('id') if parent_node else None}"
    }}
  ],
  "relationships": [
    {{
      "source_id": "0",
      "target_id": "1",
      "relationship_type": "depends_on|relates_to|requires|leads_to",
      "confidence": 0.95,
      "reason": "Explanation of why these nodes are connected"
    }}
  ]
}}

CRITICAL: Relationships are the most important aspect. Analyze content deeply to find meaningful connections."""
    
    async def _enhance_relationships(
        self,
        new_nodes: List[AINode],
        existing_nodes: List[Dict],
        initial_relationships: List[AIRelationship]
    ) -> List[AIRelationship]:
        """Enhance relationships by finding additional connections"""
        enhanced = initial_relationships.copy()
        
        # Add relationships between new nodes and existing nodes
        for i, new_node in enumerate(new_nodes):
            for existing_node in existing_nodes:
                # Simple keyword matching for demonstration
                # In production, use more sophisticated NLP/embedding similarity
                similarity = self._calculate_similarity(
                    new_node.description,
                    existing_node.get('description', '')
                )
                
                if similarity > 0.7:
                    enhanced.append(AIRelationship(
                        source_id=str(i),
                        target_id=existing_node['id'],
                        relationship_type=RelationshipType.RELATES_TO,
                        confidence=similarity,
                        reason=f"Similar concepts or tools identified"
                    ))
        
        return enhanced
    
    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Simple keyword-based similarity calculation"""
        if not text1 or not text2:
            return 0.0
        
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 or not words2:
            return 0.0
        
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        
        return len(intersection) / len(union) if union else 0.0
    
    async def chat(
        self,
        system_prompt: str,
        user_message: str,
        response_mime_type: str = "text/plain"
    ) -> Any:
        """General chat helper. When response_mime_type is application/json, returns parsed dict."""
        request_data = {
            "contents": [{
                "parts": [{
                    "text": f"{system_prompt}\n\nUser: {user_message}"
                }]
            }],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 2048,
            }
        }

        if response_mime_type:
            request_data["generationConfig"]["responseMimeType"] = response_mime_type
        
        url = f"{self.base_url}/{self.model}:generateContent"
        headers = {
            'Content-Type': 'application/json',
            'X-goog-api-key': self.api_key
        }
        
        try:
            response = await self.client.post(url, json=request_data, headers=headers)
            response.raise_for_status()
            
            result = response.json()
            candidates = result.get('candidates', [])
            if candidates:
                content = candidates[0].get('content', {})
                parts = content.get('parts', [])
                if parts:
                    text = parts[0].get('text', '')
                    if response_mime_type == "application/json":
                        if not text:
                            return {"reply": "", "directives": None}
                        try:
                            return json.loads(text, strict=False)
                        except json.JSONDecodeError:
                            try:
                                sanitized = text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\\n")
                                return json.loads(sanitized, strict=False)
                            except json.JSONDecodeError as e:
                                logger.error(
                                    "Gemini JSON decode error: %s | snippet=%s",
                                    e,
                                    (text[:500] + "...") if len(text) > 500 else text,
                                )
                            return {"reply": text, "directives": None}
                    # Tag simple conversation replies so the orchestrator can branch
                    try:
                        result = json.loads(text, strict=False)
                        if isinstance(result, dict):
                            result.setdefault("mode", "general")
                            return result
                    except json.JSONDecodeError:
                        pass
                    return text or "No response generated"
            
            return "No response generated"
            
        except Exception as e:
            logger.error(f"Error in chat: {e}")
            raise

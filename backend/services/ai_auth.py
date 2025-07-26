from typing import Dict
import logging

from neo4j import AsyncSession
from fastapi import HTTPException

logger = logging.getLogger(__name__)


class AIAuthorizationService:
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def authorize_ai_request(
        self, user_id: str, project_id: str
    ) -> Dict:
        """
        Authorize AI request by verifying project ownership
        Returns user info
        """
        logger.info(f"Authorizing AI request for user {user_id} on project {project_id}")
        
        # Verify project ownership
        ownership = await self._verify_project_ownership(user_id, project_id)
        logger.info(f"Project ownership check: {ownership}")
        if not ownership:
            raise HTTPException(403, "Unauthorized: No access to this project")
        
        # Get user info
        user_info = await self._get_user_info(user_id)
        logger.info(f"User info: {user_info}")
        
        return user_info
    
    async def _verify_project_ownership(
        self, user_id: str, project_id: str
    ) -> bool:
        """Verify user owns the project"""
        query = """
        MATCH (u:User {id: $user_id})-[:OWNS]->(p:Project {id: $project_id})
        RETURN COUNT(p) > 0 as owns_project
        """
        result = await self.session.run(
            query, 
            {"user_id": str(user_id), "project_id": str(project_id)}
        )
        record = await result.single()
        return record["owns_project"] if record else False
    
    async def _get_user_info(self, user_id: str) -> Dict:
        """Get user information"""
        query = """
        MATCH (u:User {id: $user_id})
        RETURN u {
            .id,
            .email
        } as user_info
        """
        result = await self.session.run(query, {"user_id": str(user_id)})
        record = await result.single()
        
        if not record:
            raise HTTPException(404, "User not found")
        
        user = record["user_info"]
        
        return {
            "id": user.get("id"),
            "email": user.get("email"),
            "has_ai_access": True  # Everyone has AI access
        }

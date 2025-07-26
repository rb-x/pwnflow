from typing import Dict, List, Any, Optional
from neo4j import AsyncSession


class Neo4jDB:
    """Wrapper class for Neo4j database operations"""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def execute_query(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute a Cypher query and return results"""
        result = await self.session.run(query, parameters or {})
        records = await result.data()
        return records
    
    async def execute_write(self, query: str, parameters: Dict[str, Any] = None) -> Any:
        """Execute a write query in a transaction"""
        async def _write(tx):
            result = await tx.run(query, parameters or {})
            return await result.data()
        
        return await self.session.execute_write(_write)
    
    async def execute_read(self, query: str, parameters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        """Execute a read query in a transaction"""
        async def _read(tx):
            result = await tx.run(query, parameters or {})
            return await result.data()
        
        return await self.session.execute_read(_read)
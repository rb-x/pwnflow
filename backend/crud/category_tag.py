from uuid import UUID
from typing import List, Optional
from neo4j import AsyncSession
from schemas.category_tag import CategoryTag, CategoryTagCreate

async def get_all_category_tags(session: AsyncSession) -> List[CategoryTag]:
    query = "MATCH (ct:CategoryTag) RETURN ct.id as id, ct.name as name ORDER BY ct.name"
    result = await session.run(query)
    records = await result.data()
    return [CategoryTag(**record) for record in records if record.get('id') is not None]

async def create_category_tag(session: AsyncSession, category_tag_in: CategoryTagCreate) -> CategoryTag:
    query = "CREATE (ct:CategoryTag {id: randomUUID(), name: $name}) RETURN ct.id as id, ct.name as name"
    result = await session.run(query, name=category_tag_in.name)
    record = await result.single()
    return CategoryTag(**record) 
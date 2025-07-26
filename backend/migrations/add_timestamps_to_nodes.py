"""
Migration script to add created_at and updated_at timestamps to existing nodes.
Run this script after deploying the updated schema.
"""

import asyncio
from neo4j import AsyncGraphDatabase
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

async def add_timestamps_to_nodes():
    """Add created_at and updated_at timestamps to all existing nodes that don't have them."""
    
    # Get database connection details from environment
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    database = os.getenv("NEO4J_DATABASE", "penflowdb")
    
    driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    
    try:
        async with driver.session(database=database) as session:
            # Count nodes without timestamps
            count_query = """
            MATCH (n:Node)
            WHERE n.created_at IS NULL OR n.updated_at IS NULL
            RETURN count(n) as count
            """
            result = await session.run(count_query)
            record = await result.single()
            count = record["count"] if record else 0
            
            print(f"Found {count} nodes without timestamps")
            
            if count > 0:
                # Update nodes without timestamps
                update_query = """
                MATCH (n:Node)
                WHERE n.created_at IS NULL OR n.updated_at IS NULL
                SET n.created_at = COALESCE(n.created_at, datetime()),
                    n.updated_at = COALESCE(n.updated_at, datetime())
                RETURN count(n) as updated_count
                """
                result = await session.run(update_query)
                record = await result.single()
                updated = record["updated_count"] if record else 0
                
                print(f"Updated {updated} nodes with timestamps")
            else:
                print("All nodes already have timestamps")
                
    finally:
        await driver.close()

if __name__ == "__main__":
    asyncio.run(add_timestamps_to_nodes())
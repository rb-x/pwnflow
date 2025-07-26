"""
Cleanup script to remove schema placeholder nodes from the database.
Run this manually to clean up any __schema__ or __system__ nodes.
"""

import asyncio
from neo4j import AsyncGraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

async def cleanup_schema_nodes():
    """Remove all schema placeholder nodes from the database."""
    
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    
    driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    
    try:
        async with driver.session() as session:
            # First, get a count of schema nodes
            count_query = """
            MATCH (n)
            WHERE n.id IN ['__schema__', '__system__'] 
               OR n.id STARTS WITH '__system_'
               OR n.username = '__schema__'
               OR n.email = 'schema@internal'
               OR n.name STARTS WITH '__Schema'
            RETURN count(n) as count
            """
            
            result = await session.run(count_query)
            record = await result.single()
            count = record['count'] if record else 0
            
            print(f"Found {count} schema nodes to remove")
            
            if count > 0:
                # Delete all schema nodes and their relationships
                delete_query = """
                MATCH (n)
                WHERE n.id IN ['__schema__', '__system__'] 
                   OR n.id STARTS WITH '__system_'
                   OR n.username = '__schema__'
                   OR n.email = 'schema@internal'
                   OR n.name STARTS WITH '__Schema'
                DETACH DELETE n
                RETURN count(n) as deleted
                """
                
                result = await session.run(delete_query)
                record = await result.single()
                deleted = record['deleted'] if record else 0
                
                print(f"Successfully deleted {deleted} schema nodes")
            else:
                print("No schema nodes found to delete")
            
            return True
            
    except Exception as e:
        print(f"Cleanup error: {e}")
        return False
    finally:
        await driver.close()

if __name__ == "__main__":
    asyncio.run(cleanup_schema_nodes())
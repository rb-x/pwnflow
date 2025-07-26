"""
Initialize Neo4j database with proper constraints and indexes.
This script creates all necessary labels, relationship types, and constraints.
"""

import asyncio
from neo4j import AsyncGraphDatabase
import os
from dotenv import load_dotenv

load_dotenv()

async def init_database(verbose=True):
    """Initialize the Neo4j database with all necessary constraints and indexes."""
    
    # Get database connection details from environment
    uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
    user = os.getenv("NEO4J_USER", "neo4j")
    password = os.getenv("NEO4J_PASSWORD", "password")
    database = os.getenv("NEO4J_DATABASE", "penflowdb")
    
    driver = AsyncGraphDatabase.driver(uri, auth=(user, password))
    
    try:
        async with driver.session(database=database) as session:
            if verbose:
                print("Initializing database schema...")
            
            # Create constraints for unique IDs
            constraints = [
                ("User", "id"),
                ("Project", "id"),
                ("Template", "id"),
                ("Node", "id"),
                ("Command", "id"),
                ("Context", "id"),
                ("Variable", "id"),
                ("Tag", "name"),  # Tags are unique by name
                ("CategoryTag", "name"),  # Category tags are unique by name
            ]
            
            for label, property in constraints:
                try:
                    await session.run(
                        f"CREATE CONSTRAINT IF NOT EXISTS FOR (n:{label}) REQUIRE n.{property} IS UNIQUE"
                    )
                    if verbose:
                        print(f"✓ Created uniqueness constraint for {label}.{property}")
                except Exception as e:
                    if verbose:
                        print(f"  Constraint for {label}.{property} might already exist: {str(e)}")
            
            # Create indexes for better query performance
            indexes = [
                ("User", "username"),
                ("User", "email"),
                ("Project", "name"),
                ("Project", "owner_id"),
                ("Template", "name"),
                ("Template", "owner_id"),
                ("Node", "title"),
                ("Node", "status"),
                ("Node", "created_at"),
                ("Node", "updated_at"),
                ("Command", "title"),
                ("Context", "name"),
                ("Variable", "name"),
            ]
            
            for label, property in indexes:
                try:
                    await session.run(
                        f"CREATE INDEX IF NOT EXISTS FOR (n:{label}) ON (n.{property})"
                    )
                    if verbose:
                        print(f"✓ Created index for {label}.{property}")
                except Exception as e:
                    if verbose:
                        print(f"  Index for {label}.{property} might already exist: {str(e)}")
            
            # Create sample nodes to ensure labels and relationship types exist
            # This prevents the "unknown label/relationship" warnings
            if verbose:
                print("\nEnsuring all labels and relationship types exist...")
            
            # Ensure all labels and relationship types exist
            # We'll create system nodes that won't interfere with user data
            ensure_schema_query = """
            // Ensure all labels exist by creating or merging system nodes
            MERGE (systemUser:User {id: '__system__', username: '__system__', email: 'system@penflow.internal'})
            MERGE (systemProject:Project {id: '__system_project__', name: '__System Project__', description: 'Internal system project for schema initialization'})
            MERGE (systemTemplate:Template {id: '__system_template__', name: '__System Template__', description: 'Internal system template for schema initialization'})
            MERGE (systemNode:Node {id: '__system_node__', title: '__System Node__', status: 'NOT_STARTED', x_pos: 0, y_pos: 0})
            ON CREATE SET systemNode.created_at = datetime(), systemNode.updated_at = datetime()
            MERGE (systemCommand:Command {id: '__system_command__', title: '__System Command__', command: 'echo "system"', description: 'System command for schema'})
            MERGE (systemContext:Context {id: '__system_context__', name: '__System Context__', description: 'System context for schema'})
            MERGE (systemVariable:Variable {id: '__system_variable__', name: '__SYSTEM_VAR__', value: 'system', sensitive: false})
            MERGE (systemTag:Tag {name: '__system_tag__'})
            MERGE (systemCategoryTag:CategoryTag {name: '__system_category__'})
            
            // Ensure all relationship types exist
            MERGE (systemUser)-[:OWNS]->(systemProject)
            MERGE (systemUser)-[:OWNS]->(systemTemplate)
            MERGE (systemProject)-[:HAS_NODE]->(systemNode)
            MERGE (systemNode)-[:HAS_TAG]->(systemTag)
            MERGE (systemNode)-[:HAS_COMMAND]->(systemCommand)
            MERGE (systemProject)-[:HAS_CONTEXT]->(systemContext)
            MERGE (systemContext)-[:HAS_VARIABLE]->(systemVariable)
            MERGE (systemProject)-[:HAS_CATEGORY_TAG]->(systemCategoryTag)
            MERGE (systemTemplate)-[:HAS_CATEGORY_TAG]->(systemCategoryTag)
            
            // Create a self-link to ensure IS_LINKED_TO exists
            MERGE (systemNode)-[:IS_LINKED_TO]->(systemNode)
            
            RETURN count(*) as initialized
            """
            
            await session.run(ensure_schema_query)
            
            if verbose:
                print("✓ All labels and relationship types initialized")
            
            # Verify the schema
            if verbose:
                print("\nVerifying database schema...")
            
            # Count existing data
            result = await session.run("""
                MATCH (u:User) RETURN 'User' as label, count(u) as count
                UNION ALL
                MATCH (p:Project) RETURN 'Project' as label, count(p) as count
                UNION ALL
                MATCH (t:Template) RETURN 'Template' as label, count(t) as count
                UNION ALL
                MATCH (n:Node) RETURN 'Node' as label, count(n) as count
            """)
            
            if verbose:
                print("\nCurrent data counts:")
                async for record in result:
                    print(f"  {record['label']}: {record['count']} records")
                
                print("\n✅ Database initialization complete!")
            
    except Exception as e:
        print(f"\n❌ Error initializing database: {str(e)}")
        raise
    finally:
        await driver.close()

if __name__ == "__main__":
    asyncio.run(init_database())
from neo4j import AsyncGraphDatabase
from fastapi import Depends
from core.config import settings

driver = None

def get_driver():
    """
    Returns the Neo4j driver instance, creating it if it doesn't exist.
    """
    global driver
    if driver is None:
        driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD)
        )
    return driver

async def close_driver():
    """
    Closes the Neo4j driver connection.
    """
    global driver
    if driver is not None:
        await driver.close()
        driver = None

async def get_session():
    """
    Provides a Neo4j session for database operations.
    """
    driver = get_driver()
    # Don't specify database parameter - use default database
    async with driver.session() as session:
        yield session

 
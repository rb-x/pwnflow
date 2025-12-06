# 22. Use SQLModel as ORM for Notification Service

Date: 2025-07-26

## Status

Accepted

## Context

The notification service needs an ORM for PostgreSQL access. Requirements:

- Type safety with Python type hints
- Async support for non-blocking database operations
- Integration with FastAPI and Pydantic
- Clear table definitions
- Support for migrations
- Good developer experience

Traditional ORMs like SQLAlchemy Core or Django ORM have trade-offs with type safety and async support.

## Decision

We will use **SQLModel** (latest stable) with asyncpg as the ORM for the notification service.

## Consequences

### Positive

- **Pydantic Integration**: Models are also Pydantic models
- **Type Safety**: Full type hints and IDE autocomplete
- **FastAPI Integration**: Seamless integration with FastAPI
- **SQLAlchemy Under Hood**: Built on SQLAlchemy, mature and stable
- **Simple API**: Easier to learn than raw SQLAlchemy
- **Async Support**: Works with async database drivers
- **Single Definition**: One model for DB and API schemas
- **Created by FastAPI Author**: Same author as FastAPI, good integration
- **Migration Support**: Works with Alembic for migrations

### Negative

- **Younger Project**: Newer than SQLAlchemy or Django ORM
- **Less Features**: Fewer features than full SQLAlchemy
- **Smaller Community**: Fewer resources than established ORMs
- **Breaking Changes**: Still evolving, may have breaking changes

### Neutral

- **SQLAlchemy Dependency**: Built on SQLAlchemy Core
- **Learning Curve**: Need to learn SQLModel patterns
- **Complex Queries**: May need to drop to SQLAlchemy for complex queries
- **Relationship Handling**: Different from traditional ORMs

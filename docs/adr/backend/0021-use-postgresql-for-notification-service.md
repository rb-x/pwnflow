# 21. Use PostgreSQL for Notification Service

Date: 2025-07-26

## Status

Accepted

## Context

The notification service needs persistent storage for:

- Webhook configurations
- Event delivery history
- Retry queues
- Delivery status tracking
- Audit logs

Requirements:
- ACID compliance for reliable event delivery
- Support for complex queries (filtering, sorting)
- Reliable persistence
- Good Python integration
- Different data model than Neo4j (relational works better)

## Decision

We will use **PostgreSQL** (latest stable) with SQLModel and asyncpg for the notification service database.

## Consequences

### Positive

- **ACID Compliance**: Reliable transactional guarantees
- **Mature and Stable**: Battle-tested relational database
- **Rich Query Support**: Complex joins, aggregations, filtering
- **SQLModel Integration**: Type-safe ORM with Pydantic integration
- **Async Support**: asyncpg for high-performance async queries
- **JSON Support**: Native JSON columns for flexible schema
- **Full-text Search**: Built-in text search capabilities
- **Migrations**: Easy schema migrations with Alembic
- **Monitoring**: Excellent monitoring and debugging tools
- **Wide Adoption**: Large community and resources

### Negative

- **Additional Database**: One more database to manage and deploy
- **Relational Model**: More rigid than document stores
- **Scaling**: Vertical scaling easier than horizontal

### Neutral

- **Connection Pooling**: Need to configure connection pool
- **Backup Strategy**: Need regular backups
- **Schema Migrations**: Need migration strategy with Alembic
- **Separate from Neo4j**: Different database for different concerns

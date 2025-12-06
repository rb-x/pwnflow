# 17. Use Redis for Caching and Message Broker

Date: 2025-07-26

## Status

Accepted

## Context

We need solutions for:
- Caching frequently accessed data (user sessions, project metadata)
- Message brokering for async tasks (Celery backend)
- Pub/Sub for real-time events between services
- Session storage for WebSocket connections
- Rate limiting for API endpoints

Requirements:
- High performance with low latency
- Support for multiple data structures
- Pub/Sub messaging capabilities
- Persistence options for important data
- Simple deployment and operations

## Decision

We will use **Redis** (latest stable) as the caching layer and message broker.

## Consequences

### Positive

- **High Performance**: In-memory storage with microsecond latency
- **Multiple Use Cases**: Caching, message broker, session store, pub/sub
- **Rich Data Structures**: Strings, hashes, lists, sets, sorted sets
- **Celery Integration**: Native Celery broker and result backend
- **Simple to Deploy**: Single binary, easy Docker deployment
- **Persistence Options**: RDB snapshots and AOF for durability
- **Mature and Stable**: Battle-tested in production
- **Active Community**: Large ecosystem and support
- **Atomic Operations**: Built-in atomic operations for counters, etc.

### Negative

- **Memory Limitation**: Dataset must fit in RAM
- **Single Point of Failure**: Need Redis Sentinel or Cluster for HA
- **Data Persistence Trade-offs**: Performance vs durability
- **Memory Overhead**: Higher memory usage than disk-based stores

### Neutral

- **Clustering**: Need Redis Cluster for horizontal scaling
- **Eviction Policies**: Need to configure eviction for caching use case
- **Backup Strategy**: Need regular RDB/AOF backups

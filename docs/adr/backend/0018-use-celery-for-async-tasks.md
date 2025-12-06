# 18. Use Celery for Async Task Processing

Date: 2025-07-26

## Status

Accepted

## Context

The AI service needs to process long-running tasks asynchronously:

- AI-powered finding generation (can take 10-30 seconds)
- Report generation with AI analysis
- Bulk operations on multiple findings
- Background data processing

These operations:
- Should not block API responses
- May fail and need retries
- Need to be monitored and tracked
- Should scale independently

## Decision

We will use **Celery** (latest stable) with Redis as the broker and result backend for async task processing in the AI service.

## Consequences

### Positive

- **Async Execution**: Tasks run in background workers
- **Retry Logic**: Built-in retry mechanisms with exponential backoff
- **Task Scheduling**: Support for periodic and delayed tasks
- **Result Tracking**: Store and retrieve task results
- **Monitoring**: Flower for real-time monitoring
- **Mature**: Battle-tested in production
- **Scalability**: Easy to add more worker processes
- **Error Handling**: Comprehensive error handling and callbacks
- **Python Native**: Pure Python, integrates well with FastAPI

### Negative

- **Complexity**: Adds architectural complexity
- **Broker Dependency**: Requires Redis (already using it)
- **Debugging**: Harder to debug distributed async tasks
- **Learning Curve**: Team needs to understand Celery concepts
- **Serialization**: Need to be careful with task argument serialization

### Neutral

- **Worker Management**: Need to run and monitor Celery workers
- **Task Design**: Need to design idempotent tasks
- **Result Backend**: Need to configure result expiration
- **Monitoring**: Use Flower for task monitoring

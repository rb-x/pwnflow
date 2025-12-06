# 15. Use Uvicorn as ASGI Server

Date: 2025-07-26

## Status

Accepted

## Context

FastAPI requires an ASGI (Asynchronous Server Gateway Interface) server to run. We need a production-ready ASGI server that:

- Supports async/await operations
- Handles WebSocket connections
- Provides good performance
- Works well with FastAPI
- Supports graceful shutdown
- Has good logging and monitoring

Available options include Uvicorn, Hypercorn, and Daphne.

## Decision

We will use **Uvicorn** (latest stable) with the standard extras as the ASGI server for all FastAPI services.

## Consequences

### Positive

- **FastAPI Integration**: Official recommended server for FastAPI
- **High Performance**: Built on uvloop and httptools for speed
- **WebSocket Support**: Full WebSocket support out of the box
- **Production Ready**: Proven in production environments
- **Simple Configuration**: Minimal configuration required
- **Hot Reload**: Built-in auto-reload for development
- **Logging**: Good logging integration
- **Process Manager**: Can be combined with Gunicorn for worker management
- **Standard Extras**: Includes uvloop, httptools, websockets

### Negative

- **Single Process**: No built-in process management (need Gunicorn or supervisor)
- **No Load Balancing**: Need external load balancer for multiple workers
- **Limited Features**: Fewer features than traditional WSGI servers

### Neutral

- **Worker Management**: Use Gunicorn + Uvicorn workers in production
- **Monitoring**: Need external monitoring tools
- **Graceful Shutdown**: Need to implement signal handling for zero-downtime deployments

# Backend Architecture Decisions

This directory contains all architecture decisions related to the backend services and APIs.

## ADRs in this category

| ADR | Title | Date | Status |
|-----|-------|------|--------|
| [0013](0013-use-neo4j-as-database.md) | Use Neo4j as Primary Database | 2025-07-26 | Accepted |
| [0014](0014-use-fastapi-as-backend-framework.md) | Use FastAPI as Backend Framework | 2025-07-26 | Accepted |
| [0015](0015-use-uvicorn-as-asgi-server.md) | Use Uvicorn as ASGI Server | 2025-07-26 | Accepted |
| [0016](0016-use-microservice-architecture.md) | Use Microservice Architecture | 2025-07-26 | Accepted |
| [0017](0017-use-redis-for-caching-and-messaging.md) | Use Redis for Caching and Message Broker | 2025-07-26 | Accepted |
| [0018](0018-use-celery-for-async-tasks.md) | Use Celery for Async Task Processing | 2025-07-26 | Accepted |
| [0019](0019-use-websockets-for-realtime.md) | Use WebSockets for Real-Time Communication | 2025-07-26 | Accepted |
| [0020](0020-use-google-gemini-for-ai.md) | Use Google Gemini for AI Generation | 2025-07-26 | Accepted |
| [0021](0021-use-postgresql-for-notification-service.md) | Use PostgreSQL for Notification Service | 2025-07-26 | Accepted |
| [0022](0022-use-sqlmodel-as-orm.md) | Use SQLModel as ORM for Notification Service | 2025-07-26 | Accepted |

## Topics Covered

### Core Framework & Language
- **FastAPI**: Modern async web framework
- **Python 3.12+**: Language runtime
- **Uvicorn**: ASGI server with WebSocket support

### Architecture
- **Microservice Architecture**: Main backend + AI service + Notification service
- **Shared Packages**: ai-schemas, event-schemas for cross-service contracts

### Databases
- **Neo4j**: Graph database for main application data (projects, findings, relationships)
- **PostgreSQL**: Relational database for notification service
- **Redis**: In-memory store for caching, sessions, message broker

### Data Access
- **SQLModel**: Type-safe ORM for PostgreSQL

### Async Processing
- **Celery**: Distributed task queue for long-running operations
- **Redis**: Broker and result backend for Celery

### Real-Time Features
- **WebSockets**: Bidirectional communication for live updates

### AI & Machine Learning
- **Google Gemini**: LLM for AI-powered finding generation and analysis (privacy-focused)

## Service Structure

```
backend/                  # Main API service
├── FastAPI app
├── Neo4j integration
├── Redis caching
└── WebSocket endpoints

services/
├── ai-service/          # AI microservice
│   ├── FastAPI app
│   ├── Celery workers
│   ├── Google Gemini integration
│   └── Redis broker
│
└── notification-service/  # Webhook dispatcher
    ├── FastAPI app
    ├── PostgreSQL + SQLModel
    ├── Event handlers
    └── Redis pub/sub
```

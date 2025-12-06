# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Pwnflow project.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences.

## Structure

ADRs are organized by domain:

- **[frontend/](frontend/)** - Frontend architecture decisions (React, UI, state management, etc.)
- **[backend/](backend/)** - Backend architecture decisions (database, APIs, etc.)
- **[tooling/](tooling/)** - Development tooling and infrastructure decisions

## ADR Format

Each ADR follows this structure:

- **Title**: Short noun phrase
- **Status**: Proposed | Accepted | Deprecated | Superseded
- **Date**: When the decision was made
- **Context**: What is the issue that we're seeing that is motivating this decision?
- **Decision**: What is the change that we're proposing and/or doing?
- **Consequences**: What becomes easier or more difficult to do because of this change?

## Naming Convention

ADRs are numbered **globally and sequentially** across all domains. Numbers are not reused.

Format: `NNNN-title-with-dashes.md`

Example: `0001-use-react-for-ui-framework.md`

The folder organization (frontend/backend/tooling) is for categorization only - numbers follow chronological order across the entire project.

## Process

1. Create a new ADR file with the next available number (currently 0025)
2. Place it in the appropriate domain folder (frontend/backend/tooling)
3. Fill in the template with context, decision, and consequences
4. Submit for review
5. Once accepted, the ADR is immutable
6. If a decision needs to change, create a new ADR that supersedes the old one

## Index

### Frontend (0001-0012)

| ADR | Title | Status |
|-----|-------|--------|
| [0001](frontend/0001-use-react-for-ui-framework.md) | Use React for UI Framework | Accepted |
| [0002](frontend/0002-use-typescript-for-type-safety.md) | Use TypeScript for Type Safety | Accepted |
| [0003](frontend/0003-use-vite-as-build-tool.md) | Use Vite as Build Tool | Accepted |
| [0004](frontend/0004-use-tailwind-css-for-styling.md) | Use Tailwind CSS for Styling | Accepted |
| [0005](frontend/0005-use-shadcn-ui-for-components.md) | Use shadcn/ui for Component Library | Accepted |
| [0006](frontend/0006-use-zustand-for-global-state.md) | Use Zustand for Global State Management | Accepted |
| [0007](frontend/0007-use-tanstack-query-for-server-state.md) | Use TanStack Query for Server State | Accepted |
| [0008](frontend/0008-use-react-hook-form-and-zod.md) | Use React Hook Form and Zod for Forms | Accepted |
| [0009](frontend/0009-use-tiptap-for-rich-text.md) | Use TipTap for Rich Text Editing | Accepted |
| [0010](frontend/0010-use-xyflow-for-diagrams.md) | Use XYFlow for Diagrams and Visualizations | Accepted |
| [0011](frontend/0011-use-axios-for-http-client.md) | Use Axios for HTTP Client | Accepted |
| [0012](frontend/0012-use-react-router-for-routing.md) | Use React Router for Client-Side Routing | Accepted |

### Backend (0013-0022)

| ADR | Title | Status |
|-----|-------|--------|
| [0013](backend/0013-use-neo4j-as-database.md) | Use Neo4j as Primary Database | Accepted |
| [0014](backend/0014-use-fastapi-as-backend-framework.md) | Use FastAPI as Backend Framework | Accepted |
| [0015](backend/0015-use-uvicorn-as-asgi-server.md) | Use Uvicorn as ASGI Server | Accepted |
| [0016](backend/0016-use-microservice-architecture.md) | Use Microservice Architecture | Accepted |
| [0017](backend/0017-use-redis-for-caching-and-messaging.md) | Use Redis for Caching and Message Broker | Accepted |
| [0018](backend/0018-use-celery-for-async-tasks.md) | Use Celery for Async Task Processing | Accepted |
| [0019](backend/0019-use-websockets-for-realtime.md) | Use WebSockets for Real-Time Communication | Accepted |
| [0020](backend/0020-use-google-gemini-for-ai.md) | Use Google Gemini for AI Generation | Accepted |
| [0021](backend/0021-use-postgresql-for-notification-service.md) | Use PostgreSQL for Notification Service | Accepted |
| [0022](backend/0022-use-sqlmodel-as-orm.md) | Use SQLModel as ORM | Accepted |

### Tooling (0023-0024)

| ADR | Title | Status |
|-----|-------|--------|
| [0023](tooling/0023-use-pnpm-as-package-manager.md) | Use pnpm as Package Manager | Accepted |
| [0024](tooling/0024-use-uv-as-python-package-manager.md) | Use UV as Python Package Manager | Accepted |

## Resources

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's article on ADRs](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)

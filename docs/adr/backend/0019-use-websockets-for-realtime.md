# 19. Use WebSockets for Real-Time Communication

Date: 2025-07-26

## Status

Accepted

## Context

Pwnflow needs real-time features:

- Live updates when findings are created/modified
- Real-time collaboration on projects
- AI generation progress updates
- Notification delivery
- Live activity feeds

We need bidirectional communication between server and clients without polling.

Requirements:
- Low latency updates
- Server-initiated messages
- Efficient connection handling
- Integration with FastAPI
- Support for multiple concurrent connections

## Decision

We will use **WebSockets** for real-time bidirectional communication between backend and frontend.

## Consequences

### Positive

- **Bidirectional**: Server can push updates without client polling
- **Low Latency**: Real-time updates with minimal delay
- **Efficient**: Single persistent connection vs. repeated HTTP requests
- **FastAPI Support**: Native WebSocket support in FastAPI
- **Standard Protocol**: WebSocket is a web standard
- **Better UX**: Instant updates improve user experience
- **Less Overhead**: Reduced bandwidth compared to polling
- **Event-Driven**: Natural fit for event-driven architecture

### Negative

- **Connection Management**: Need to manage persistent connections
- **Scaling Complexity**: Harder to scale than stateless HTTP
- **State Management**: Need to track connection state
- **Load Balancing**: Requires sticky sessions or connection tracking
- **Reconnection Logic**: Need client-side reconnection handling
- **Debugging**: Harder to debug than HTTP requests

### Neutral

- **Redis Pub/Sub**: Use Redis for broadcasting to multiple workers
- **Connection Limits**: Need to configure max connections per worker
- **Authentication**: Need to implement WebSocket auth
- **Heartbeat**: Need ping/pong for connection health checks

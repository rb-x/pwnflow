# 16. Use Microservice Architecture

Date: 2025-07-26

## Status

Accepted

## Context

We need to decide on the overall backend architecture for Pwnflow. The application has distinct concerns:

- Main API for projects, findings, users (backend/)
- AI-powered generation and analysis (ai-service/)
- Event-driven webhooks and notifications (notification-service/)
- Different scaling requirements for each component
- Independent deployment needs

We need to balance:
- Service isolation and independence
- Code reusability through shared packages
- Development complexity
- Deployment and operational overhead

## Decision

We will use a **microservice architecture** with:
- **Main Backend**: Core API service (FastAPI)
- **AI Service**: Dedicated AI/LLM service with async task processing
- **Notification Service**: Event-driven webhook dispatcher
- **Shared Packages**: Common schemas and types (ai-schemas, event-schemas)

## Consequences

### Positive

- **Independent Scaling**: Scale AI service separately from main API
- **Technology Flexibility**: Each service can use optimal tools
- **Fault Isolation**: AI service failure doesn't crash main API
- **Independent Deployment**: Deploy services independently
- **Team Autonomy**: Different teams can own different services
- **Resource Optimization**: AI service can use GPU instances, others don't need to
- **Specialized Optimization**: Optimize each service for its workload
- **Clearer Boundaries**: Well-defined service responsibilities

### Negative

- **Operational Complexity**: Multiple services to deploy and monitor
- **Network Overhead**: Inter-service communication latency
- **Distributed Debugging**: Harder to debug across services
- **Data Consistency**: Need to manage eventual consistency
- **Development Overhead**: More complex local development setup
- **Testing Complexity**: Integration testing across services is harder

### Neutral

- **Service Communication**: Need message broker (Redis) or HTTP calls
- **Shared Code**: Need shared packages for schemas
- **API Gateway**: May need gateway for routing in future
- **Service Discovery**: Need to configure service endpoints

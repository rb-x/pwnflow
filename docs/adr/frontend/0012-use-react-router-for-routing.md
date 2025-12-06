# 12. Use React Router for Client-Side Routing

Date: 2025-07-26

## Status

Accepted

## Context

We need client-side routing for a single-page application with:

- Multiple pages and views
- Nested routes (layouts)
- Protected routes (authentication)
- Route parameters
- Query string handling
- Lazy loading for code splitting
- Data loading for routes
- Navigation guards

Requirements:
- React integration
- TypeScript support
- Active maintenance
- Good documentation
- Flexible and feature-rich

## Decision

We will use **React Router DOM (latest stable)** for client-side routing.

## Consequences

### Positive

- **Industry Standard**: De facto standard for React routing
- **Data Loading**: Built-in data loading with loaders (inspired by Remix)
- **Nested Routes**: Hierarchical route structure with layouts
- **Lazy Loading**: Built-in code splitting support with React.lazy
- **Type Safety**: Good TypeScript support with typed parameters
- **v7 Features**: Improved data loading, better DX, enhanced performance
- **Active Development**: Regular updates from Remix team
- **Comprehensive**: All routing features needed out of the box
- **Documentation**: Extensive documentation and examples
- **Community**: Large community, abundant resources and solutions
- **Navigation**: Declarative and programmatic navigation

### Negative

- **Bundle Size**: Larger than minimal routers (~30KB)
- **API Changes**: Major version updates can require migration
- **Learning Curve**: New v7 features require learning
- **Complexity**: More complex than simpler routing solutions

### Neutral

- **Configuration**: Need to set up route configuration
- **Loaders**: Need to understand loader pattern for data fetching
- **Error Boundaries**: Need to set up error boundaries for routes
- **Protected Routes**: Need to implement custom protected route logic

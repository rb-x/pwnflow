# 6. Use Zustand for Global State Management

Date: 2025-07-26

## Status

Accepted

## Context

We need global state management for:

- UI state (sidebar open/closed, active modals, theme)
- User preferences (settings, display options)
- Application-wide state (current project, user session)
- Non-server data that needs to be shared across components

We want to avoid:
- Excessive boilerplate
- Provider wrapper hell
- Unnecessary re-renders
- Complex setup and configuration

## Decision

We will use **Zustand (latest stable)** for global client-side state management.

## Consequences

### Positive

- **Minimal Boilerplate**: Simple, concise API with less code than Redux
- **No Providers**: No need for Context Provider wrappers in component tree
- **TypeScript-Friendly**: Excellent type inference with minimal type annotations
- **Small Bundle**: Only ~1KB gzipped, negligible impact on bundle size
- **React Hooks**: Natural integration with React hooks paradigm
- **Performance**: Optimized to prevent unnecessary re-renders
- **Middleware Support**: Built-in middleware for persistence, devtools, and immer
- **Simple API**: Easy to learn and understand for new team members
- **Flexible**: Can create multiple stores for different domains
- **DevTools**: Integration with Redux DevTools for debugging

### Negative

- **Less Structure**: Less opinionated than Redux, team needs to establish conventions
- **Smaller Community**: Smaller community compared to Redux (though growing)
- **Less Middleware**: Fewer third-party middleware options than Redux
- **No Time Travel**: No built-in time-travel debugging like Redux DevTools
- **Less Tooling**: Fewer tools and utilities compared to Redux ecosystem

### Neutral

- **Different Patterns**: Different from Redux patterns, team needs to learn new approach
- **Multiple Stores**: Can create multiple stores, need conventions for when to split
- **No Actions/Reducers**: Direct state mutation (using immer middleware if needed)
- **Selector Pattern**: Need to use selectors for optimal performance

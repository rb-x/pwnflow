# 7. Use TanStack Query for Server State

Date: 2025-07-26

## Status

Accepted

## Context

We need to manage server state effectively, including:

- Fetching data from REST APIs
- Caching API responses
- Synchronizing server state with UI
- Handling loading and error states
- Implementing optimistic updates
- Background refetching
- Pagination and infinite scrolling

Managing server state manually with useState and useEffect leads to:
- Boilerplate code
- Cache management complexity
- Race conditions
- Stale data issues
- Poor user experience

## Decision

We will use **TanStack Query (React Query) 5** for all server state management and API data fetching.

## Consequences

### Positive

- **Automatic Caching**: Intelligent caching and cache invalidation out of the box
- **Auto-Refetching**: Keeps data fresh with background refetching
- **Request Deduplication**: Automatically deduplicates identical requests
- **Optimistic Updates**: Built-in support for optimistic UI updates
- **Loading/Error States**: Automatic loading, error, and success state management
- **Pagination Support**: Built-in pagination and infinite scroll helpers
- **DevTools**: Excellent debugging tools for inspecting queries and cache
- **Window Focus Refetching**: Automatically refetches when user returns to tab
- **Retry Logic**: Automatic retry with exponential backoff
- **Prefetching**: Easy prefetching for improved perceived performance
- **TypeScript Support**: Full type safety for queries and mutations
- **Framework-Agnostic**: Can be used with other frameworks if needed

### Negative

- **Learning Curve**: Concepts like query keys, stale time, and cache time require learning
- **Bundle Size**: Adds ~13KB gzipped to bundle
- **Complexity for Simple Cases**: May be overkill for very simple API calls
- **Query Key Management**: Need to establish conventions for query key structure
- **Cache Debugging**: Understanding cache behavior can be complex initially

### Neutral

- **Different Approach**: Different from traditional useEffect data fetching
- **Query Keys**: Need to manage query keys for cache invalidation
- **Configuration**: Global configuration options need to be set appropriately
- **Migration**: Existing fetch logic needs to be migrated to useQuery/useMutation

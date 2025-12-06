# 11. Use Axios for HTTP Client

Date: 2025-07-26

## Status

Accepted

## Context

We need an HTTP client for making API requests to the backend. Requirements:

- Request/response interceptors (for auth tokens, error handling)
- Timeout support
- Request cancellation
- Good error handling
- Progress tracking for file uploads
- Simple API
- Browser and Node.js compatibility (for potential SSR)

The native fetch API lacks:
- Interceptors
- Built-in timeout support
- Simpler error handling

## Decision

We will use **Axios (latest stable)** as the HTTP client for all API requests.

## Consequences

### Positive

- **Interceptors**: Request and response interceptors for auth, logging, error handling
- **Timeout Support**: Built-in timeout configuration per request
- **Better Errors**: More detailed error objects with response data
- **Cancellation**: Request cancellation with AbortController support
- **Progress Tracking**: Upload and download progress events
- **Browser & Node**: Works in both environments (useful for testing)
- **Transform Data**: Automatic JSON parsing and data transformation
- **Defaults**: Global defaults with instance-specific overrides
- **Mature**: Battle-tested, stable, and well-maintained
- **TypeScript Support**: Good TypeScript definitions

### Negative

- **Bundle Size**: Adds ~13KB gzipped (fetch is native)
- **Another Dependency**: One more package to maintain
- **Less Modern**: fetch is the modern standard
- **Wrapper Complexity**: Abstracts away native fetch API

### Neutral

- **Different API**: Different from fetch API
- **Configuration**: Need to configure axios instance
- **Interceptor Setup**: Need to set up interceptors for common patterns
- **Error Handling**: Different error structure than fetch

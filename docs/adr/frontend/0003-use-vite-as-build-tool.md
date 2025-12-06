# 3. Use Vite as Build Tool

Date: 2025-07-26

## Status

Accepted

## Context

We need a build tool for development and production that provides:

- Fast development server with hot module replacement (HMR)
- Efficient production builds
- TypeScript and React support
- Simple configuration
- Modern JavaScript features
- Integration with our toolchain (Tailwind CSS, TypeScript, etc.)

Developer experience is important for team productivity, and slow build times can significantly impact development velocity.

## Decision

We will use **Vite (latest stable)** as the build tool and development server for the application.

## Consequences

### Positive

- **Lightning-Fast HMR**: Near-instant hot module replacement during development
- **Native ESM**: No bundling required in development mode, leveraging native ES modules
- **Fast Cold Start**: Development server starts almost instantly
- **Optimized Builds**: Uses esbuild for dependency pre-bundling and Rollup for production
- **Simple Configuration**: Minimal configuration required compared to Webpack
- **Plugin Ecosystem**: Rich plugin ecosystem including official React and Tailwind plugins
- **Modern by Default**: Targets modern browsers with automatic polyfills for production
- **CSS Support**: Built-in support for CSS, PostCSS, Sass, and CSS modules
- **TypeScript Support**: First-class TypeScript support with no additional configuration
- **Developer Experience**: Exceptional DX with fast feedback loops

### Negative

- **Modern Browser Requirement**: Development build targets modern browsers only (not an issue for our use case)
- **Smaller Ecosystem**: Smaller plugin ecosystem compared to Webpack
- **Less Configuration Control**: Less granular control compared to Webpack (trade-off for simplicity)
- **Relative Newness**: Newer than Webpack, though now mature and stable

### Neutral

- **Different from Webpack**: Team members familiar with Webpack need to learn Vite conventions
- **Build Configuration**: Production builds use Rollup with different configuration approach
- **Asset Handling**: Different approach to static asset handling compared to Webpack

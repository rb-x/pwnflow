# 4. Use Tailwind CSS for Styling

Date: 2025-07-26

## Status

Accepted

## Context

We need a scalable, maintainable styling solution that enables:

- Rapid UI development
- Consistent design system
- Responsive design
- Dark mode support
- No CSS naming conflicts
- Small production bundle size
- Easy customization and theming

Traditional CSS approaches can lead to naming conflicts, specificity issues, and difficulty maintaining consistency across a large application.

## Decision

We will use **Tailwind CSS (latest stable)** with the official Vite plugin for styling the application.

## Consequences

### Positive

- **Utility-First Approach**: Rapid development without writing custom CSS
- **No Naming Conflicts**: Utility classes are scoped and collision-free
- **Responsive Design**: Built-in responsive breakpoints with mobile-first approach
- **Dark Mode Support**: Native dark mode support with class or media query strategies
- **Customizable**: Easily extend with custom theme configuration
- **Small Bundle**: Automatically purges unused styles in production
- **Consistent Design**: Enforces design system through constrained utility classes
- **Great Tooling**: Excellent IDE autocomplete and IntelliSense support
- **Tailwind v4**: Performance improvements, new features, and better DX
- **No CSS-in-JS Overhead**: No runtime overhead like styled-components
- **Composition**: Easy to compose utilities for complex styles

### Negative

- **Learning Curve**: Team needs to learn utility class names and approach
- **HTML Verbosity**: HTML can become cluttered with many class names
- **Build Step Required**: Requires PostCSS processing (handled by Vite)
- **Customization Syntax**: Custom styles require understanding Tailwind's configuration
- **Long Class Strings**: Complex components can have very long className attributes

### Neutral

- **Different Paradigm**: Different from traditional CSS-in-JS or CSS modules
- **Responsive Classes**: Need to use responsive prefixes (sm:, md:, lg:) consistently
- **Extract Components**: May need to extract components to avoid repeating long class strings
- **Theme Configuration**: Centralized theme requires rebuilding for changes

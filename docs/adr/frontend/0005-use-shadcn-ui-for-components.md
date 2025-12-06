# 5. Use shadcn/ui for Component Library

Date: 2025-07-26

## Status

Accepted

## Context

We need accessible, customizable UI components for common patterns like:

- Buttons, inputs, and form controls
- Dialogs, popovers, and dropdowns
- Tables, tabs, and navigation
- Tooltips, alerts, and notifications

Traditional component libraries come with trade-offs:
- Pre-installed packages add dependencies and bundle size
- Heavy customization can be difficult
- Styles may conflict with custom design requirements
- Accessibility is often an afterthought

## Decision

We will use **shadcn/ui** components built on Radix UI primitives and styled with Tailwind CSS.

## Consequences

### Positive

- **Copy-Paste Components**: Components are copied into the codebase, not installed as dependencies
- **Full Customization**: Complete control over component code and styling
- **Radix UI Primitives**: Accessibility built-in with keyboard navigation, ARIA attributes, and screen reader support
- **Tailwind Integration**: Native Tailwind CSS styling, consistent with our styling approach
- **No Lock-in**: Not dependent on package versions or maintainers
- **TypeScript-First**: Excellent TypeScript support with full type inference
- **Modern Design**: Beautiful, professional components following modern design principles
- **Zero Runtime Overhead**: No CSS-in-JS runtime cost
- **Incremental Adoption**: Copy only the components you need
- **Easy Updates**: Can update individual components independently

### Negative

- **More Files**: Components are copied into codebase, increasing file count
- **Manual Updates**: Need to manually re-copy components for updates
- **Initial Setup**: More initial setup compared to installing a package
- **No Centralized Updates**: Can't update all components with single package update
- **Code Duplication**: If using multiple component variants, may duplicate code

### Neutral

- **Different Approach**: Different from traditional npm install component libraries
- **Component Organization**: Need to organize components in src/components/ui/
- **Customization Responsibility**: Full responsibility for maintaining component code
- **Documentation**: Need to refer to shadcn/ui docs for component usage

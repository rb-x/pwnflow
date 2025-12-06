# 10. Use XYFlow for Diagrams and Visualizations

Date: 2025-07-26

## Status

Accepted

## Context

We need interactive diagram capabilities for:

- Attack path visualization
- Network topology mapping
- Workflow diagrams
- Finding relationships
- Project mind maps

Requirements:
- Interactive (drag, zoom, pan)
- Customizable nodes and edges
- Layout algorithms
- Performance with large graphs
- React integration
- TypeScript support

## Decision

We will use **@xyflow/react (latest stable)** for node-based diagrams and visualizations.

## Consequences

### Positive

- **Purpose-Built**: Specifically designed for flowcharts and node graphs
- **Interactive**: Built-in drag, zoom, pan, and selection
- **Customizable**: Custom nodes, edges, and handles
- **Performance**: Handles large graphs efficiently with virtualization
- **React-First**: Built specifically for React with hooks API
- **Layout Algorithms**: Integration with dagre for automatic layouts
- **TypeScript**: Full TypeScript support with generics
- **Active Development**: Regular updates and new features
- **Good Documentation**: Comprehensive docs, examples, and tutorials
- **Mini-Map**: Built-in minimap component
- **Controls**: Built-in zoom/pan controls
- **Edge Types**: Multiple edge types (bezier, straight, smoothstep)

### Negative

- **Bundle Size**: Significant bundle size (~80KB) for complex diagrams
- **Learning Curve**: Need to learn XYFlow concepts and API
- **Layout Complexity**: Complex layouts require understanding layout algorithms
- **Custom Nodes**: Creating custom nodes requires understanding node API
- **Performance Tuning**: Large graphs may require performance optimizations

### Neutral

- **Layout Library**: Need dagre for automatic layouts (additional dependency)
- **State Management**: Need to manage node and edge state
- **Styling**: Need to style nodes and edges with custom CSS/Tailwind
- **Data Structure**: Need to convert data to XYFlow format
- **Persistence**: Need to implement saving/loading of diagrams

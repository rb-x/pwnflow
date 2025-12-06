# 9. Use TipTap for Rich Text Editing

Date: 2025-07-26

## Status

Accepted

## Context

We need rich text editing capabilities for:

- Project documentation
- Finding descriptions and remediation steps
- Notes and comments
- Reports and exports
- Markdown support for technical documentation

Requirements:
- Modern, extensible architecture
- Markdown support (read and write)
- Syntax highlighting for code blocks
- Customizable toolbar and styling
- React integration
- TypeScript support

## Decision

We will use **TipTap (latest stable)** as the rich text editor framework.

## Consequences

### Positive

- **Headless**: Complete control over UI and styling (fits with Tailwind approach)
- **Extensible**: Plugin architecture allows custom extensions
- **Modern**: Built on ProseMirror, a modern editing framework
- **React Integration**: First-class React support with hooks
- **Markdown Support**: Read/write markdown with tiptap-markdown extension
- **TypeScript**: Full TypeScript support
- **Syntax Highlighting**: Code blocks with lowlight integration
- **Collaborative**: Can add real-time collaboration (Yjs integration)
- **Customizable**: Full control over editor behavior and appearance
- **Active Development**: Regular updates and maintenance
- **Good Documentation**: Comprehensive docs and examples

### Negative

- **Bundle Size**: Larger bundle compared to simple textarea (~60KB with extensions)
- **Learning Curve**: Need to learn TipTap and ProseMirror concepts
- **Setup Required**: More setup compared to prebuilt editors
- **Styling Work**: Need to style editor UI components
- **Extension Development**: Creating custom extensions requires ProseMirror knowledge

### Neutral

- **UI Components**: Need to build toolbar and editor UI
- **Extension Configuration**: Need to configure which extensions to use
- **Markdown Conversion**: Need to handle markdown import/export
- **Image Handling**: Need to implement custom image upload logic

# 24. Use UV as Python Package Manager

Date: 2025-07-26

## Status

Accepted

## Context

We need a Python package manager for managing dependencies across the backend and microservices. Requirements:

- Fast dependency resolution and installation
- Support for workspaces/monorepo structure
- Deterministic builds with lock files
- Modern pyproject.toml support
- Path dependencies for shared packages
- Compatible with standard Python packaging

Traditional tools like pip and pipenv have issues with speed and workspace management.

## Decision

We will use **UV** (latest stable) as the Python package manager for the backend services.

## Consequences

### Positive

- **Extremely Fast**: Written in Rust, 10-100x faster than pip
- **Workspace Support**: Native support for monorepo with shared packages
- **pyproject.toml Native**: First-class pyproject.toml support
- **Path Dependencies**: Easy management of local packages (ai-schemas, event-schemas)
- **Lock Files**: Deterministic dependency resolution
- **Drop-in Replacement**: Compatible with pip workflow
- **Modern**: Built for modern Python packaging standards
- **Virtual Environments**: Built-in venv management
- **Cross-platform**: Works on Linux, macOS, Windows

### Negative

- **New Tool**: Newer than pip/poetry, less mature
- **Smaller Community**: Fewer resources than established tools
- **CI/CD Setup**: Need to install UV in CI/CD pipelines
- **Team Familiarity**: Team needs to learn UV commands

### Neutral

- **Different from pip**: Slightly different commands and workflow
- **Rust Dependency**: Requires Rust toolchain to build from source (pre-built binaries available)

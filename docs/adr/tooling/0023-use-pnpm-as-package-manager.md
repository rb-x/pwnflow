# 23. Use pnpm as Package Manager

Date: 2025-07-26

## Status

Accepted

## Context

We need a package manager for installing and managing dependencies. Key considerations:

- Installation speed
- Disk space efficiency
- Dependency resolution correctness
- Monorepo support (for potential future needs)
- Security
- Developer experience

npm and yarn have issues with:
- Slow installation times
- Disk space usage (duplicate packages)
- Phantom dependencies (hoisting issues)

## Decision

We will use **pnpm** as the package manager for the project.

## Consequences

### Positive

- **Disk Space Efficiency**: Content-addressable storage saves disk space (single copy of each package version)
- **Fast Installation**: Significantly faster than npm and yarn classic
- **Strict Dependencies**: Prevents phantom dependencies by using symlinks
- **Security**: Better security than npm with proper dependency isolation
- **Monorepo Support**: Excellent workspace support for potential monorepo migration
- **Deterministic**: Lock file ensures consistent installs across environments
- **Drop-in Replacement**: Compatible with npm scripts and commands
- **Performance**: Parallel installation for maximum speed
- **Compatibility**: Works with all npm packages

### Negative

- **Installation Required**: Team members need to install pnpm separately
- **Less Common**: Less common than npm, new team members may be unfamiliar
- **Edge Cases**: Some packages with incorrect peer dependencies may have issues
- **Tool Compatibility**: Some tools may not recognize pnpm (rare)
- **Windows Symlinks**: May have issues on Windows without developer mode (rare in modern Windows)

### Neutral

- **Different Commands**: Some commands differ from npm (though most are the same)
- **Lock File**: Uses pnpm-lock.yaml instead of package-lock.json
- **Node Modules**: Different node_modules structure (non-flat)
- **CI/CD Setup**: Need to ensure pnpm is installed in CI/CD pipelines

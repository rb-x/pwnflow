# Claude Code Project Instructions

This directory contains project-specific instructions and context for Claude Code.

## Files

- **`instructions.md`** - Project overview, tech stack, coding guidelines, and patterns
- **`security.md`** - Security best practices, XSS prevention, Cypher injection prevention, and privacy guidelines
- **`settings.local.json`** - Local Claude Code settings (user-specific, may not be committed)

## Purpose

These files help Claude Code understand:
- The Pwnflow project structure and architecture
- Technology choices and versions
- Security requirements and best practices
- Coding conventions and patterns
- Common development workflows

## Committing to Git

**✅ DO commit:**
- `instructions.md` - Team-wide project context
- `security.md` - Security guidelines for all developers
- `README.md` - This file

**❌ DON'T commit:**
- `settings.local.json` - User-specific settings (already in .gitignore)
- Any files with personal API keys or credentials

## For New Team Members

When you clone this repo, Claude Code will automatically use these instructions to understand the project context. No additional setup needed!

## Updating Instructions

When the project architecture changes:
1. Update `instructions.md` with new dependencies or patterns
2. Update `security.md` if new security concerns arise
3. Commit and push changes so the team stays in sync

## Learn More

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Project ADRs](../docs/adr/) - Architecture Decision Records

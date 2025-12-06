# 13. Use Neo4j as Primary Database

Date: 2025-07-26

## Status

Accepted

## Context

We need to model complex data relationships for penetration testing workflows:

- Projects contain findings, hosts, and vulnerabilities
- Attack paths showing relationships between vulnerabilities
- Network topology with host-to-host connections
- Finding dependencies and remediation order
- User-project-team relationships
- Audit trails and history

Requirements:
- Efficient relationship traversal
- Flexible schema evolution
- Complex query support
- Visualization-friendly data structure
- ACID compliance for data integrity

Traditional relational databases struggle with:
- Multiple JOIN operations for deep relationships
- Rigid schema for evolving requirements
- Poor performance for graph-like queries

## Decision

We will use **Neo4j** graph database as the primary data store for the application.

## Consequences

### Positive

- **Graph Structure**: Perfect for modeling relationships (attack paths, network topology)
- **Cypher Query Language**: Powerful, expressive language for graph traversals
- **Relationship Performance**: Constant-time relationship traversal regardless of data size
- **Visualization**: Natural fit for visual diagrams and attack path visualization
- **ACID Compliance**: Full transactional integrity guarantees
- **Schema Flexibility**: Schema-less allows easy evolution of data model
- **Attack Path Modeling**: Ideal for representing security assessment workflows
- **Pattern Matching**: Easy to find complex patterns in data
- **Index Support**: Efficient indexes for frequently queried properties
- **Active Community**: Strong community and ecosystem

### Negative

- **Learning Curve**: Cypher query language requires learning
- **Injection Risks**: Must use parameterized queries to prevent Cypher injection
- **Memory Usage**: Higher memory usage than traditional relational databases
- **Tooling**: Fewer ORMs and tools compared to SQL databases
- **Hosting**: Fewer managed hosting options than PostgreSQL/MySQL
- **Aggregations**: Less optimized for heavy aggregations compared to relational DBs

### Neutral

- **Different Paradigm**: Different from relational thinking, requires mental model shift
- **Query Optimization**: Different optimization strategies than SQL
- **Backup/Restore**: Different backup and restore procedures
- **Scaling**: Different scaling strategies (scale-up vs scale-out)
- **Data Modeling**: Need to think in terms of nodes and relationships

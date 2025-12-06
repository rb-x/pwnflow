# 20. Use Google Gemini for AI Generation

Date: 2025-07-26

## Status

Accepted

## Context

Pwnflow needs AI capabilities for:

- Automated finding generation from scan results
- Security advisory analysis
- Report generation assistance
- Vulnerability explanation and remediation suggestions
- Natural language queries over security data

Requirements:
- Strong reasoning and analysis capabilities
- Large context window for analyzing findings
- Reliable API with good uptime
- Reasonable cost structure
- Good documentation and Python SDK
- **CRITICAL: Privacy protection for sensitive security data**

### Privacy Considerations

Pwnflow handles highly sensitive penetration testing data including:
- Client infrastructure details
- Vulnerability scan results
- Security weaknesses and exploits
- Confidential assessment reports

**Data Minimization Policy**: To protect client privacy and maintain security, we will ONLY send minimal, non-sensitive data to external AI services:
- ✅ **Transmitted**: Node titles and descriptions (generic, sanitized)
- ❌ **NEVER transmitted**: Full scan results, reports, credentials, IP addresses, hostnames, exploit details, client-specific data

This ensures compliance with data protection regulations and maintains client trust.

## Decision

We will use **Google Gemini** (latest stable API) via the google-generativeai Python package for AI-powered features.

**Implementation Constraint**: Only sanitized node titles and descriptions will be transmitted to Gemini. Full scan results, reports, and any sensitive client data will NEVER be sent to external AI services.

## Consequences

### Positive

- **Privacy by Design**: Data minimization - only titles/descriptions sent, never full scan results
- **Large Context Window**: Can analyze multiple finding descriptions without sending raw data
- **Strong Reasoning**: Good at security analysis and technical content generation
- **Free Tier**: Generous free tier for development and testing
- **Python SDK**: Official google-generativeai package
- **Fast Response**: Good latency for real-time features
- **Multimodal**: Can analyze images (screenshots) if needed in future
- **JSON Mode**: Structured output for parsing into findings
- **Safety Settings**: Built-in content safety controls
- **Google Infrastructure**: Reliable uptime and performance
- **No Training on Data**: Google doesn't train on API data (per their terms)

### Negative

- **Vendor Lock-in**: Tied to Google's AI platform
- **API Limits**: Rate limits on free/paid tiers
- **External Service Dependency**: Even minimal data goes to third party (mitigated by data minimization)
- **Cost**: Paid usage beyond free tier
- **Model Changes**: Google may update/deprecate models
- **Internet Dependency**: Requires internet connectivity
- **Limited Context**: Can't send full scan results, limits AI capabilities

### Neutral

- **Prompt Engineering**: Need to design effective prompts with limited context
- **Error Handling**: Need robust error handling for API failures
- **Caching**: Should cache common queries to reduce costs
- **Fallback**: Consider fallback for when API is unavailable
- **Data Sanitization**: MUST implement strict data filtering:
  - ✅ Allow: Generic titles, descriptions, categories, tags
  - ❌ Block: IP addresses, hostnames, credentials, ports, paths, file contents, screenshots, full reports
  - Implement allowlist approach, not blocklist
  - Audit all data sent to Gemini in development
  - Log what data is transmitted (for compliance)
- **Privacy Compliance**: Document data flows for GDPR/compliance
- **Client Disclosure**: Inform clients that minimal data may be sent to AI service

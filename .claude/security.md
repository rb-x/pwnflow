# Security Guidelines for Pwnflow

## Overview
Pwnflow is a penetration testing workflow management application. Given the sensitive nature of security assessments and the data handled, security must be a top priority in all development decisions.

## Critical Security Principles

### 1. Defense in Depth
- Implement multiple layers of security controls
- Never rely on a single security measure
- Validate data at every boundary (client, API, database)

### 2. Principle of Least Privilege
- Users and services should have minimum necessary permissions
- Implement role-based access control (RBAC)
- Restrict API access based on user roles

### 3. Security by Default
- Secure configurations should be the default
- Users should opt-in to less secure options, not opt-out
- All new features must be reviewed for security implications

## Input Validation & Sanitization

### Always Validate User Input
```typescript
// ✅ GOOD - Validate with Zod schema
import { z } from "zod"

const userInputSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  email: z.string().email(),
  description: z.string().max(1000)
})

// Validate before using
const result = userInputSchema.safeParse(userInput)
if (!result.success) {
  // Handle validation error
}
```

```typescript
// ❌ BAD - Using raw user input
const data = req.body // Never trust this directly
await api.createProject(data) // Dangerous!
```

### Input Validation Rules
- **Always validate on both client AND server**
- **Use Zod schemas** for all user input
- **Sanitize HTML content** before rendering
- **Limit string lengths** to prevent DoS attacks
- **Validate file types and sizes** for uploads
- **Whitelist allowed characters** for special fields (usernames, tags, etc.)

## XSS (Cross-Site Scripting) Prevention

### React's Built-in Protection
React automatically escapes values in JSX, but there are exceptions:

```typescript
// ✅ SAFE - React escapes by default
<div>{userInput}</div>

// ❌ DANGEROUS - dangerouslySetInnerHTML bypasses escaping
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// ✅ SAFE - Use DOMPurify for sanitization
import DOMPurify from 'dompurify'
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(userInput)
}} />
```

### XSS Prevention Checklist
- [ ] **Never use `dangerouslySetInnerHTML`** without sanitization
- [ ] **Sanitize all HTML** from user input or external sources
- [ ] **Use DOMPurify** when you must render HTML
- [ ] **Validate URLs** before using in `href` or `src`
- [ ] **Set proper CSP headers** (Content Security Policy)
- [ ] **Escape data in attributes** (especially event handlers)
- [ ] **Use React Markdown** for rendering markdown (it sanitizes by default)

### Markdown & Rich Text Security

```typescript
// ✅ SAFE - react-markdown sanitizes by default
import ReactMarkdown from 'react-markdown'
<ReactMarkdown>{userMarkdown}</ReactMarkdown>

// ✅ SAFE - TipTap with proper configuration
import { useEditor } from '@tiptap/react'
const editor = useEditor({
  extensions: [
    // Only allow safe extensions
    StarterKit,
    // Avoid extensions that allow raw HTML
  ],
  content: sanitizedContent
})
```

### URL Validation
```typescript
// ✅ GOOD - Validate URLs
const urlSchema = z.string().url().refine(
  (url) => {
    const parsed = new URL(url)
    // Only allow http/https protocols
    return ['http:', 'https:'].includes(parsed.protocol)
  },
  { message: "Only HTTP(S) URLs are allowed" }
)

// ❌ BAD - Allowing javascript: or data: URLs
<a href={userInput}>Click</a> // XSS if userInput is "javascript:alert(1)"
```

## Neo4j Security (Cypher Injection Prevention)

### Parameterized Queries - ALWAYS
```typescript
// ✅ GOOD - Using parameterized queries
const query = `
  MATCH (p:Project {id: $projectId})
  WHERE p.userId = $userId
  RETURN p
`
await session.run(query, {
  projectId: sanitizedId,
  userId: currentUser.id
})

// ❌ DANGEROUS - String concatenation (Cypher Injection!)
const query = `
  MATCH (p:Project {id: "${projectId}"})
  RETURN p
`
// If projectId = '"}) MATCH (n) DETACH DELETE n //'
// This could delete the entire database!
```

### Neo4j Security Rules
- **NEVER concatenate user input** into Cypher queries
- **Always use parameters** (`$paramName`)
- **Validate input** before passing to queries
- **Use prepared statements** when possible
- **Limit query results** to prevent resource exhaustion
- **Implement query timeouts** to prevent slow queries
- **Use separate database users** with limited permissions
- **Never expose raw Cypher** queries to frontend
- **Log and monitor** database queries for suspicious patterns

### Query Complexity Limits
```typescript
// ✅ GOOD - Limit results and depth
const query = `
  MATCH (p:Project)-[:HAS_FINDING*..3]->(f:Finding)
  WHERE p.userId = $userId
  RETURN f
  LIMIT 100
`

// ❌ BAD - Unbounded query
const query = `
  MATCH (n)-[*]->(m)  // Could traverse entire graph!
  RETURN n, m
`
```

## Authentication & Authorization

### Authentication Best Practices
- **Use secure session management**
- **Implement JWT with short expiration**
- **Store tokens securely** (httpOnly cookies preferred over localStorage)
- **Implement token refresh** mechanism
- **Use HTTPS only** for authentication endpoints
- **Implement rate limiting** on auth endpoints
- **Add CAPTCHA** for login after failed attempts

### Authorization Checks
```typescript
// ✅ GOOD - Check permissions before operations
const canDelete = await checkPermission(userId, 'delete:project', projectId)
if (!canDelete) {
  throw new ForbiddenError('Insufficient permissions')
}
await deleteProject(projectId)

// ❌ BAD - Trusting client-side checks
if (user.role === 'admin') {  // Client can manipulate this!
  await deleteProject(projectId)
}
```

### Protected Routes
```typescript
// ✅ GOOD - Server-side validation
import { ProtectedRoute } from '@/components/ProtectedRoute'

<Route
  path="/admin"
  element={
    <ProtectedRoute requiredRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
```

## API Security

### API Request Validation
```typescript
// ✅ GOOD - Validate all API requests
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  scope: z.array(z.string().url()).max(50)
})

export async function createProject(data: unknown) {
  // Validate before sending
  const validated = createProjectSchema.parse(data)
  return axios.post('/api/projects', validated)
}
```

### CORS Configuration
- **Restrict origins** to known domains
- **Don't use `*`** in production
- **Validate Origin header** on server

### Rate Limiting
- **Implement rate limiting** on all API endpoints
- **Use different limits** for different endpoints
- **Add exponential backoff** for failed requests

## File Upload Security

### File Upload Rules
```typescript
// ✅ GOOD - Validate file uploads
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg',
  'application/pdf',
  'text/plain'
]

function validateFile(file: File) {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large')
  }

  // Check file type (MIME type)
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('File type not allowed')
  }

  // Check file extension
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowedExts = ['png', 'jpg', 'jpeg', 'pdf', 'txt']
  if (!ext || !allowedExts.includes(ext)) {
    throw new Error('Invalid file extension')
  }

  return true
}
```

### File Upload Checklist
- [ ] **Validate file type** (check MIME and extension)
- [ ] **Limit file size**
- [ ] **Scan files for malware** (server-side)
- [ ] **Store files outside webroot**
- [ ] **Generate random filenames** (don't trust user filenames)
- [ ] **Set proper Content-Type** headers when serving
- [ ] **Implement virus scanning** for uploaded files

## Data Handling

### Sensitive Data Protection
```typescript
// ✅ GOOD - Don't log sensitive data
console.log('User logged in', { userId: user.id })

// ❌ BAD - Logging passwords/tokens
console.log('Login attempt', {
  email: user.email,
  password: user.password  // NEVER!
})
```

### Sensitive Data Rules
- **Never log passwords, tokens, or API keys**
- **Redact sensitive data** in error messages
- **Don't store sensitive data** in localStorage
- **Encrypt sensitive data** at rest and in transit
- **Use environment variables** for secrets
- **Don't commit secrets** to version control

### Error Messages
```typescript
// ✅ GOOD - Generic error messages
throw new Error('Invalid credentials')

// ❌ BAD - Revealing too much
throw new Error('Password incorrect for user john@example.com')
```

## Dependency Security

### Package Management
```bash
# Regularly audit dependencies
pnpm audit

# Update packages regularly
pnpm update

# Check for vulnerabilities in CI/CD
pnpm audit --audit-level=high
```

### Dependency Rules
- **Audit dependencies regularly** (at least monthly)
- **Update dependencies** to patch vulnerabilities
- **Review package permissions** before installing
- **Use lock files** (pnpm-lock.yaml)
- **Avoid packages with known vulnerabilities**
- **Check package reputation** before adding new dependencies

## Client-Side Security

### LocalStorage & SessionStorage
```typescript
// ✅ ACCEPTABLE - Non-sensitive data
localStorage.setItem('theme', 'dark')

// ❌ BAD - Sensitive data
localStorage.setItem('authToken', token) // Vulnerable to XSS
localStorage.setItem('password', pwd)     // NEVER!

// ✅ BETTER - Use httpOnly cookies for tokens
// Set on server, not accessible via JavaScript
```

### Prevent Clickjacking
- Server should set `X-Frame-Options: DENY` header
- Use `Content-Security-Policy: frame-ancestors 'none'`

## Security Testing

### Security Checklist for New Features
- [ ] **Input validation** implemented with Zod
- [ ] **XSS prevention** - no unsafe HTML rendering
- [ ] **Cypher injection prevention** - parameterized queries only
- [ ] **Authentication** checks in place
- [ ] **Authorization** verified server-side
- [ ] **Rate limiting** considered
- [ ] **Error handling** doesn't leak sensitive info
- [ ] **Dependencies** scanned for vulnerabilities
- [ ] **File uploads** properly validated
- [ ] **Sensitive data** not logged or exposed

### Regular Security Tasks
- [ ] **Weekly**: Review authentication logs
- [ ] **Monthly**: Run `pnpm audit` and fix issues
- [ ] **Quarterly**: Security code review
- [ ] **Annually**: Full penetration test

## Common Vulnerabilities to Avoid

### OWASP Top 10 Prevention

1. **Broken Access Control**
   - Verify permissions on every request
   - Don't trust client-side role checks

2. **Cryptographic Failures**
   - Use HTTPS everywhere
   - Don't roll your own crypto

3. **Injection** (SQL, NoSQL, Cypher)
   - Use parameterized queries
   - Validate all input

4. **Insecure Design**
   - Threat model new features
   - Security by default

5. **Security Misconfiguration**
   - Use secure defaults
   - Remove debug code in production

6. **Vulnerable Components**
   - Keep dependencies updated
   - Regular security audits

7. **Authentication Failures**
   - Implement MFA
   - Secure session management

8. **Data Integrity Failures**
   - Verify data signatures
   - Use SRI for CDN resources

9. **Security Logging Failures**
   - Log security events
   - Monitor for suspicious activity

10. **SSRF (Server-Side Request Forgery)**
    - Validate and sanitize URLs
    - Use allowlists for external requests

## Incident Response

### If a Security Issue is Discovered
1. **Don't panic** - document the issue
2. **Assess severity** - is data exposed?
3. **Contain the issue** - disable affected feature if needed
4. **Notify stakeholders** - inform team and affected users
5. **Fix the vulnerability** - patch immediately
6. **Post-mortem** - document lessons learned
7. **Update security practices** - prevent recurrence

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Neo4j Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Injection_Prevention_Cheat_Sheet.html)
- [React Security Best Practices](https://react.dev/learn/security)
- [Neo4j Security Guide](https://neo4j.com/docs/operations-manual/current/security/)

## Remember

> **Security is not a feature, it's a requirement.**
>
> When in doubt, ask: "What's the worst that could happen?" and "How would an attacker exploit this?"
>
> **Never sacrifice security for convenience.**

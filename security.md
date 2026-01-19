# Security Guide

## Overview

**SessionKit** is a session access and route protection library. It does **NOT** handle:
- Session creation/authentication (but provides helpers to register sessions)
- Session storage (cookies, Redis, database)
- Session expiration checking
- CSRF protection

SessionKit **DOES** provide:
- ✅ `setSession()` - Register session after authentication
- ✅ `clearSession()` - Clear session during logout
- ✅ `updateSession()` - Update session data
- ✅ Session access helpers throughout your app
- ✅ Route protection based on roles/permissions

These are **your responsibility** as the developer. This guide explains what you must implement.

## What SessionKit Does

✅ **Session structure validation** - Prevents crashes from malformed data  
✅ **DoS protection** - Limits array sizes and pattern complexity  
✅ **Safe session access** - AsyncLocalStorage-based session context  
✅ **Route protection** - Declarative guards based on roles/permissions

## What You Must Implement

### 1. 🔒 Secure Session Storage

SessionKit provides `setSession()` to register sessions, but **you** must store them securely.

#### ❌ NEVER do this (Plain cookies - easily tampered!)

```ts
// INSECURE - Anyone can modify this!
import { setSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
  const user = await authenticateUser(credentials);
  
  // Register with SessionKit
  setSession(context, { userId: user.id, role: user.role });
  
  // DANGEROUS - Plain cookie, no encryption!
  context.cookies.set('session', JSON.stringify({ 
    userId: user.id, 
    role: 'admin' 
  }));
};
```

#### ✅ DO this (Signed/encrypted sessions)

```ts
// Use a library like iron-session, lucia-auth, or @auth/astro
import { setSession } from 'astro-sessionkit/server';
import { encrypt } from 'iron-session';

export const POST: APIRoute = async (context) => {
  const user = await authenticateUser(credentials);
  
  // 1. Register with SessionKit
  setSession(context, {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  });
  
  // 2. Store encrypted session ID
  const sessionId = crypto.randomUUID();
  await db.createSession({
    id: sessionId,
    userId: user.id,
    expiresAt: Date.now() + 3600000 // 1 hour
  });
  
  // 3. Set secure cookie
  const encryptedId = await encrypt(sessionId, {
    password: process.env.SESSION_SECRET!,
    ttl: 3600
  });
  
  context.cookies.set('session_id', encryptedId, {
    httpOnly: true,    // Prevent JavaScript access
    secure: true,      // HTTPS only
    sameSite: 'lax',   // CSRF protection
    maxAge: 3600,      // 1 hour
    path: '/'
  });
};
```

#### Recommended Libraries

- **[lucia-auth](https://lucia-auth.com/)** - Modern, type-safe auth
- **[@auth/astro](https://authjs.dev/)** - Popular auth solution
- **[iron-session](https://github.com/vvo/iron-session)** - Encrypted cookies
- **[better-auth](https://www.better-auth.com/)** - Full-featured auth

---

### 2. ⏰ Session Expiration

SessionKit does **not** check expiration. You must implement this:

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './auth'; // Your auth logic

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionCookie = context.cookies.get('session')?.value;

  if (sessionCookie) {
    try {
      const session = await verifySession(sessionCookie);

      // Check expiration
      if (session.expiresAt && session.expiresAt < Date.now()) {
        context.cookies.delete('session');
        return next();
      }

      // Set for SessionKit to read
      context.session.set('__session__', {
        userId: session.userId,
        email: session.email,
        role: session.role,
        permissions: session.permissions
      });
    } catch (error) {
      // Invalid session - delete cookie
      context.cookies.delete('session');
    }
  }

  return next();
});
```

---

### 3. 🛡️ CSRF Protection

For state-changing operations (POST, PUT, DELETE), implement CSRF tokens:

```ts
// Generate CSRF token (in your auth middleware)
import { randomBytes } from 'crypto';

const csrfToken = randomBytes(32).toString('hex');
context.cookies.set('csrf_token', csrfToken, {
  httpOnly: false, // Must be readable by JavaScript
  sameSite: 'strict'
});

// Store in session for validation
context.locals.csrfToken = csrfToken;
```

```ts
// Validate CSRF token (in API routes)
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const token = request.headers.get('x-csrf-token');
  const expected = locals.csrfToken;

  if (!token || token !== expected) {
    return new Response('CSRF validation failed', { status: 403 });
  }

  // Process request...
};
```

```astro
<!-- Include in forms -->
<form method="POST">
  <input type="hidden" name="csrf_token" value={locals.csrfToken} />
  <!-- ... -->
</form>
```

---

### 4. 🔄 Session Fixation Prevention

Regenerate session IDs after authentication:

```ts
// After successful login
export const POST: APIRoute = async ({ request, cookies }) => {
  const { email, password } = await request.json();

  // Verify credentials
  const user = await verifyCredentials(email, password);

  if (user) {
    // Delete old session if it exists
    const oldSession = cookies.get('session')?.value;
    if (oldSession) {
      await deleteSession(oldSession); // Clean up server-side
    }

    // Generate NEW session ID
    const newSessionId = crypto.randomUUID();
    const session = await createSession(newSessionId, user.id);

    // Set new cookie
    cookies.set('session', await encryptSession(session), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax'
    });
  }
};
```

---

### 5. 🚦 Rate Limiting

Protect authentication endpoints from brute force:

```ts
import { RateLimiter } from 'rate-limiter-flexible';
import { Redis } from 'ioredis';

const redis = new Redis();
const limiter = new RateLimiterRedis({
  storeClient: redis,
  points: 5,        // 5 attempts
  duration: 900,    // per 15 minutes
  blockDuration: 900 // block for 15 minutes after
});

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Check rate limit
    await limiter.consume(clientAddress);
  } catch {
    return new Response('Too many login attempts', {
      status: 429,
      headers: { 'Retry-After': '900' }
    });
  }

  // Process login...
};
```

---

### 6. 🧹 Input Sanitization

Never trust session data in HTML contexts:

```astro
---
import { getSession } from 'astro-sessionkit/server';

const session = getSession();
---

<!-- Astro automatically escapes variables -->
<p>Welcome, {session?.email}</p> <!-- ✅ Safe -->

<!-- Be careful with set:html -->
<div set:html={session?.bio}></div> <!-- ❌ Dangerous if bio contains HTML -->

<!-- Sanitize user-generated HTML -->
<div set:html={sanitizeHtml(session?.bio)}></div> <!-- ✅ Safe -->
```

---

## Security Checklist

Before deploying to production:

- [ ] **Sessions are encrypted/signed** (using iron-session, lucia, etc.)
- [ ] **Cookies have security flags** (HttpOnly, Secure, SameSite)
- [ ] **Session expiration is enforced** (both client and server)
- [ ] **CSRF protection** on all state-changing operations
- [ ] **Session IDs regenerated** after login/logout
- [ ] **Rate limiting** on authentication endpoints
- [ ] **HTTPS enforced** in production
- [ ] **Security headers configured**:
  ```ts
  headers: {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Content-Security-Policy': "default-src 'self'"
  }
  ```
- [ ] **Password hashing** with bcrypt/argon2 (min 10 rounds)
- [ ] **Audit logging** for authentication events
- [ ] **Regular security updates** for dependencies

---

## Common Vulnerabilities to Avoid

### ❌ Plain Text Sessions
```ts
// NEVER store sensitive data in plain cookies
cookies.set('user', JSON.stringify({ role: 'admin' }));
```

### ❌ Trusting Client Data
```ts
// NEVER trust data from forms/headers without validation
const role = request.headers.get('x-user-role'); // ❌ Attacker controlled!
```

### ❌ No Session Timeout
```ts
// Sessions should expire!
cookies.set('session', token); // ❌ No maxAge = lives forever
```

### ❌ Weak Secrets
```ts
// NEVER use weak or hardcoded secrets
const SECRET = 'password123'; // ❌ Use crypto.randomBytes(32)
```

---

## Questions?

If you're unsure about any security aspect:

1. **Read the documentation** for your auth library
2. **Use established libraries** instead of rolling your own
3. **Consult OWASP** guidelines: https://owasp.org/
4. **Get a security audit** before handling sensitive data

---

## Reporting Security Issues

If you discover a security vulnerability in SessionKit itself, please email:
**oa.mora [at] hotmail [dot] com** (🔒 Do not open public issues)

We'll respond within 48 hours and work with you on a fix.
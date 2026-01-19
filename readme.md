# 🔐 Astro SessionKit

Simple session access and route protection for Astro applications.

## Features

- ✅ **Simple API** - Access session data anywhere in your app
- 🛡️ **Route Protection** - Declarative route guards with roles/permissions
- 🚀 **Type Safe** - Full TypeScript support
- 🎯 **Flexible** - Works with any session storage (cookies, Redis, DB, etc.)
- ⚡ **Fast** - Uses AsyncLocalStorage for zero-overhead access

## Installation

```bash
npm install astro-sessionkit
```

## Quick Start

### 1. Configure the Integration

```ts
// astro.config.mjs
import { defineConfig } from 'astro/config';
import sessionkit from 'astro-sessionkit';

export default defineConfig({
    integrations: [
        sessionkit({
            loginPath: '/login',
            protect: [
                // Protect admin routes
                { pattern: '/admin/**', role: 'admin' },

                // Protect dashboard for authenticated users
                { pattern: '/dashboard', roles: ['user', 'admin'] },

                // Protect by permission
                { pattern: '/settings', permission: 'settings:write' },

                // Custom logic
                {
                    pattern: '/premium/**',
                    allow: (session) => session?.subscription === 'premium'
                }
            ]
        })
    ]
});
```

### 2. Set Up Your Session

SessionKit reads from `context.session.get('__session__')`. You set it up in your middleware:

```ts
// src/middleware.ts
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  // Get session from wherever you store it
  // (cookies, Redis, database, etc.)
  const sessionId = context.cookies.get('session_id')?.value;
  
  if (sessionId) {
    const user = await db.getUserBySessionId(sessionId);
    
    // Set session for SessionKit to read
    context.session.set('__session__', {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    });
  }
  
  return next();
});
```

### 3. Register Sessions After Authentication

Use the provided helpers to register sessions after successful authentication:

```ts
// src/pages/api/login.ts
import type { APIRoute } from 'astro';
import { setSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
  const { email, password } = await context.request.json();
  
  // Verify credentials (YOUR authentication logic)
  const user = await verifyCredentials(email, password);
  
  if (user) {
    // Register session with SessionKit
    setSession(context, {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    });
    
    // Store session ID (YOUR storage logic)
    const sessionId = await createSessionInDatabase(user.id);
    context.cookies.set('session_id', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });
    
    return new Response(JSON.stringify({ success: true }));
  }
  
  return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
    status: 401
  });
};
```

### 4. Use Session in Your Pages

```astro
---
// src/pages/dashboard.astro
import { getSession, requireSession } from 'astro-sessionkit/server';

// Get session (returns null if not authenticated)
const session = getSession();

// Or require authentication (throws 401 if not authenticated)
const session = requireSession();
---

<h1>Welcome, {session.email}</h1>
```

## API Reference

### Session Management Functions

#### `setSession(context, session)`

Register a session after successful authentication.

**Parameters:**
- `context: APIContext` - Astro API context
- `session: Session` - Session data to register

**Throws:** Error if session structure is invalid

```ts
import { setSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
  const user = await authenticateUser(credentials);
  
  setSession(context, {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  });
  
  // Also store in cookies/database
  context.cookies.set('session_id', sessionId);
};
```

#### `clearSession(context)`

Clear the session during logout.

```ts
import { clearSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
  clearSession(context);
  
  // Also delete from cookies/database
  context.cookies.delete('session_id');
  await db.deleteSession(sessionId);
  
  return context.redirect('/');
};
```

#### `updateSession(context, updates)`

Update specific fields in the current session.

**Parameters:**
- `context: APIContext` - Astro API context
- `updates: Partial<Session>` - Fields to update

**Throws:** Error if no session exists or updated session is invalid

```ts
import { updateSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
  // Update user's role
  updateSession(context, { 
    role: 'admin',
    permissions: ['admin:read', 'admin:write']
  });
  
  // Also update in your storage
  await db.updateSession(sessionId, updates);
};
```

### Session Access Functions

All functions are imported from `astro-sessionkit/server`:

#### `getSession()`

Get the current session (returns `null` if not authenticated).

```ts
import { getSession } from 'astro-sessionkit/server';

const session = getSession();
if (session) {
  console.log('User ID:', session.userId);
}
```

#### `requireSession()`

Get the current session or throw 401 if not authenticated.

```ts
import { requireSession } from 'astro-sessionkit/server';

const session = requireSession();
// TypeScript knows session is not null here
```

#### `isAuthenticated()`

Check if the user is authenticated.

```ts
import { isAuthenticated } from 'astro-sessionkit/server';

if (isAuthenticated()) {
  // User is logged in
}
```

#### `hasRole(role: string)`

Check if user has a specific role.

```ts
import { hasRole } from 'astro-sessionkit/server';

if (hasRole('admin')) {
  // User is an admin
}
```

#### `hasPermission(permission: string)`

Check if user has a specific permission.

```ts
import { hasPermission } from 'astro-sessionkit/server';

if (hasPermission('posts:delete')) {
  // User can delete posts
}
```

#### `hasAllPermissions(...permissions: string[])`

Check if user has ALL specified permissions.

```ts
import { hasAllPermissions } from 'astro-sessionkit/server';

if (hasAllPermissions('posts:read', 'posts:write')) {
  // User has both permissions
}
```

#### `hasAnyPermission(...permissions: string[])`

Check if user has ANY of the specified permissions.

```ts
import { hasAnyPermission } from 'astro-sessionkit/server';

if (hasAnyPermission('posts:delete', 'admin:panel')) {
  // User has at least one permission
}
```

## Route Protection

### Protection Rules

#### By Role

Require a specific role:

```ts
{ pattern: '/admin/**', role: 'admin' }
```

#### By Multiple Roles

User must have ONE of these roles:

```ts
{ pattern: '/dashboard', roles: ['user', 'admin', 'moderator'] }
```

#### By Permission

Require a specific permission:

```ts
{ pattern: '/settings', permission: 'settings:write' }
```

#### By Multiple Permissions

User must have ALL of these permissions:

```ts
{ pattern: '/admin/users', permissions: ['users:read', 'users:write'] }
```

#### Custom Logic

Use a custom function for complex logic:

```ts
{ 
  pattern: '/premium/**', 
  allow: (session) => {
    return session?.subscription === 'premium' && !session?.banned;
  }
}
```

#### Custom Redirect

Override the default login path per rule:

```ts
{ 
  pattern: '/admin/**', 
  role: 'admin',
  redirectTo: '/unauthorized'
}
```

### Pattern Matching

Patterns support glob syntax:

- `/admin` - Exact match
- `/admin/*` - One or more segments (`/admin/users`, `/admin/users/123`)
- `/admin/**` - Any path under admin (`/admin`, `/admin/users`, `/admin/x/y/z`)

## Session Type

The session object must have this shape:

```ts
interface Session {
  userId: string;           // Required
  email?: string;
  role?: string;
  roles?: string[];
  permissions?: string[];
  [key: string]: unknown;   // Add any custom fields
}
```

You control what goes in the session - SessionKit just reads it.

## Advanced Configuration

### Custom Access Hooks

Override how roles/permissions are extracted:

```ts
sessionkit({
  access: {
    // Custom role extraction
    getRole: (session) => session?.primaryRole ?? null,
    
    // Custom permissions extraction
    getPermissions: (session) => {
      return [...session?.permissions ?? [], ...session?.dynamicPerms ?? []];
    },
    
    // Override all built-in checks
    check: (rule, session) => {
      // Your custom logic
      return session?.customField === 'allowed';
    }
  }
})
```

### Logout Flow

```ts
// src/pages/api/logout.ts
import type { APIRoute } from 'astro';
import { clearSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
  const sessionId = context.cookies.get('session_id')?.value;
  
  // Clear from SessionKit
  clearSession(context);
  
  // Delete from storage
  if (sessionId) {
    await db.deleteSession(sessionId);
  }
  context.cookies.delete('session_id');
  
  return context.redirect('/login');
};
```

### Update Session Data

```ts
// src/pages/api/update-role.ts
import type { APIRoute } from 'astro';
import { updateSession } from 'astro-sessionkit/server';

export const POST: APIRoute = async (context) => {
  const { newRole } = await context.request.json();
  
  // Update in SessionKit
  updateSession(context, { role: newRole });
  
  // Also update in your database
  const sessionId = context.cookies.get('session_id')?.value;
  await db.updateUserRole(sessionId, newRole);
  
  return new Response(JSON.stringify({ success: true }));
};
```

## Examples

### Complete Authentication Flow

```ts
// src/pages/api/auth/login.ts
import type { APIRoute } from 'astro';
import { setSession } from 'astro-sessionkit/server';
import { hashPassword, generateSessionId } from './utils';

export const POST: APIRoute = async (context) => {
  const { email, password } = await context.request.json();
  
  // 1. Verify credentials
  const user = await db.findUserByEmail(email);
  if (!user || !await hashPassword.verify(password, user.hashedPassword)) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401
    });
  }
  
  // 2. Create session ID
  const sessionId = generateSessionId();
  await db.createSession({
    id: sessionId,
    userId: user.id,
    expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
  });
  
  // 3. Register with SessionKit
  setSession(context, {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions: user.permissions
  });
  
  // 4. Set secure cookie
  context.cookies.set('session_id', sessionId, {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/'
  });
  
  return new Response(JSON.stringify({ 
    success: true,
    user: { email: user.email, role: user.role }
  }));
};
```

## Examples

### Protect Multiple Route Patterns

```ts
sessionkit({
  protect: [
    // Admin section
    { pattern: '/admin/**', role: 'admin', redirectTo: '/unauthorized' },
    
    // User dashboard
    { pattern: '/dashboard', roles: ['user', 'admin'] },
    
    // Settings require specific permission
    { pattern: '/settings/**', permission: 'settings:access' },
    
    // Premium content
    { 
      pattern: '/premium/**',
      allow: (session) => session?.tier === 'premium'
    }
  ]
})
```

### Conditional Rendering

```astro
---
import { hasRole, hasPermission } from 'astro-sessionkit/server';
---

{hasRole('admin') && (
  <a href="/admin">Admin Panel</a>
)}

{hasPermission('posts:create') && (
  <button>Create Post</button>
)}
```

### API Route Protection

```ts
// src/pages/api/admin.ts
import type { APIRoute } from 'astro';
import { requireSession, hasRole } from 'astro-sessionkit/server';

export const GET: APIRoute = async () => {
    const session = requireSession();

    if (!hasRole('admin')) {
        return new Response('Forbidden', { status: 403 });
    }

    // Admin logic here
    return new Response(JSON.stringify({ data: 'secret' }));
};
```

## How It Works

1. **You set the session** in `context.locals.session` via your own middleware
2. **SessionKit reads it** and makes it available via AsyncLocalStorage
3. **Route guards** automatically protect paths based on your rules
4. **Helper functions** provide easy access throughout your app

## Security

⚠️ **Important**: SessionKit handles session access and route protection, but **does NOT handle**:
- Session creation/storage
- Authentication
- Session expiration
- CSRF protection

These are your responsibility. See [SECURITY.md](./SECURITY.md) for a complete security guide.

### Quick Security Checklist

Before production:
- ✅ Encrypt/sign your sessions (use lucia-auth, @auth/astro, or iron-session)
- ✅ Set secure cookie flags (HttpOnly, Secure, SameSite)
- ✅ Implement session expiration
- ✅ Add CSRF protection for state-changing operations
- ✅ Use HTTPS in production

## License

MIT License © Alex Mora
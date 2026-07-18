// ============================================================================
// Public Server API - Use these in your Astro components/endpoints
// ============================================================================

import {getContextStore} from "./core/context";
import {isValidSessionStructure} from "./core/validation";
import type {Session, SessionKitContext, SessionSetOptions} from "./core/types";
import {getConfig} from "./core/config";

/**
 * Get the current session (returns null if not authenticated)
 *
 * @example
 * ```ts
 * // In .astro component
 * const session = getSession();
 * if (session) {
 *   console.log('User ID:', session.userId);
 * }
 * ```
 */
export function getSession(): Session | null {
    const context = getContextStore();
    const session = context?.session ?? null;

    if (!isValidSessionStructure(session)) {
        if (context && session !== null) {
            context.session = null;
        }
        return null;
    }

    return session;
}

/**
 * Get the current session or throw if not authenticated
 *
 * @throws {Response} 401 Unauthorized if no session
 *
 * @example
 * ```ts
 * // In API endpoint
 * const session = requireSession();
 * // TypeScript knows session is not null here
 * ```
 */
export function requireSession(): Session {
    const session = getSession();

    if (!session) {
        throw new Response("Unauthorized", {status: 401});
    }

    return session;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
    return getSession() !== null;
}

/**
 * Check if user has a specific role
 */
export function hasRole(role: string): boolean {
    const session = getSession();
    if (!session) return false;

    // Check primary role
    if (session.role === role) return true;

    // Check additional roles
    return session.roles?.includes(role) ?? false;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(permission: string): boolean {
    const session = getSession();
    if (!session) return false;

    return session.permissions?.includes(permission) ?? false;
}

/**
 * Check if user has ALL of the specified permissions
 */
export function hasAllPermissions(...permissions: string[]): boolean {
    const session = getSession();
    if (!session) return false;

    const userPermissions = session.permissions ?? [];
    return permissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(...permissions: string[]): boolean {
    const session = getSession();
    if (!session) return false;

    const userPermissions = session.permissions ?? [];
    return permissions.some((p) => userPermissions.includes(p));
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Check if a specific role has a specific permission.
 *
 * This checks if the current user has the specified role and if that role
 * is associated with the specified permission.
 *
 * @param role - The role to check
 * @param permission - The permission to check
 *
 * @example
 * ```ts
 * if (hasRolePermission("admin", "delete users")) {
 *   // ...
 * }
 * ```
 */
export function hasRolePermission(role: string, permission: string): boolean {
    return hasRole(role) && hasPermission(permission);
}

/**
 * Set session data in context.locals.session
 *
 * Use this after successful authentication to register the user's session.
 * This does NOT handle session storage (cookies, Redis, etc.) - you must do that separately.
 *
 * @param session - Session data to set
 * @param context - Astro API context (optional if called within request context)
 * @param options - Astro session storage options
 *
 * @throws {Error} If session structure is invalid or context missing
 *
 * @example
 * ```ts
 * // In API endpoint after verifying credentials
 * export const POST: APIRoute = async (context) => {
 *   const { email, password } = await context.request.json();
 *   const user = await verifyCredentials(email, password);
 *
 *   if (user) {
 *     // Register session with SessionKit
 *     setSession({
 *       userId: user.id,
 *       email: user.email,
 *       role: user.role,
 *       permissions: user.permissions
 *     });
 *
 *     // YOU must also store the session (cookie, Redis, etc.)
 *     context.cookies.set('session_id', sessionId, { httpOnly: true });
 *
 *     return new Response(JSON.stringify({ success: true }));
 *   }
 * };
 * ```
 */
export function setSession(session: Session, options?: SessionSetOptions): void;
export function setSession(session: Session, context?: SessionKitContext, options?: SessionSetOptions): void;
export function setSession(
    session: Session,
    contextOrOptions?: SessionKitContext | SessionSetOptions,
    options?: SessionSetOptions
): void {
    const store = getContextStore();
    const hasContextShape = contextOrOptions &&
        ("cookies" in contextOrOptions || "session" in contextOrOptions || "redirect" in contextOrOptions);
    const context = hasContextShape ? contextOrOptions as SessionKitContext : undefined;
    const configuredTtl = getConfig().sessionTtl;
    const defaultOptions = configuredTtl !== undefined ? {ttl: configuredTtl} : undefined;
    const sessionOptions = (hasContextShape ? options : contextOrOptions as SessionSetOptions | undefined) ?? defaultOptions;
    const ctx = context || store?.astroContext;

    if (!ctx) {
        throw new Error(
            '[SessionKit] Cannot set session: Astro context is missing. ' +
            'Provide it as a second argument or ensure sessionMiddleware is running.'
        );
    }

    // Validate session structure
    if (!isValidSessionStructure(session)) {
        throw new Error(
            '[SessionKit] Invalid session structure. Session must have a valid userId and follow the Session interface.'
        );
    }

    // Update ALS store if available for same-request consistency
    if (store) {
        store.session = session;
    }

    // Set in context.session for Astro to persist
    if (sessionOptions) {
        ctx.session?.set('__session__', session, sessionOptions);
    } else {
        ctx.session?.set('__session__', session);
    }
}

/**
 * Clear session from context.locals.session
 *
 * Use this during logout. This does NOT delete session storage (cookies, Redis, etc.) -
 * you must do that separately.
 *
 * @param context - Astro API context (optional if called within request context)
 * @param options - Astro session storage options
 *
 * @example
 * ```ts
 * // In logout endpoint
 * export const POST: APIRoute = async (context) => {
 *   // Clear from SessionKit
 *   clearSession();
 *
 *   // YOU must also delete the session storage
 *   context.cookies.delete('session_id');
 *   await db.deleteSession(sessionId);
 *
 *   return context.redirect('/');
 * };
 * ```
 */
export function clearSession(context?: SessionKitContext): void {
    const store = getContextStore();
    const ctx = context || store?.astroContext;

    if (!ctx) {
        throw new Error(
            '[SessionKit] Cannot clear session: Astro context is missing. ' +
            'Provide it as an argument or ensure sessionMiddleware is running.'
        );
    }

    // Update ALS store if available for same-request consistency
    if (store) {
        store.session = null;
    }

    ctx.session?.delete('__session__');
}

/**
 * Regenerate the session ID to prevent session fixation attacks
 *
 * Use this after a successful login or privilege change.
 * This is only supported if the underlying Astro session driver supports it.
 *
 * @param context - Astro API context (optional if called within request context)
 *
 * @example
 * ```ts
 * // In login endpoint
 * export const POST: APIRoute = async (context) => {
 *   const user = await authenticate(request);
 *   if (user) {
 *     // 1. Regenerate session ID
 *     regenerateSession();
 *
 *     // 2. Set new session data
 *     setSession({ userId: user.id, role: user.role });
 *   }
 * }
 * ```
 */
export function regenerateSession(context?: SessionKitContext): void {
    const ctx = context || getContextStore()?.astroContext;

    if (!ctx) {
        throw new Error(
            '[SessionKit] Cannot regenerate session: Astro context is missing. ' +
            'Provide it as an argument or ensure sessionMiddleware is running.'
        );
    }

    if (ctx.session?.regenerate) {
        ctx.session.regenerate();
    }
}

/**
 * Update specific fields in the current session
 *
 * Useful for updating session data without replacing the entire session.
 * The updated session is validated before being set.
 *
 * @param updates - Partial session data to merge
 * @param context - Astro API context (optional if called within request context)
 *
 * @throws {Error} If no session exists or updated session is invalid
 *
 * @example
 * ```ts
 * // Update user's role after promotion
 * export const POST: APIRoute = async (context) => {
 *   updateSession({
 *     role: 'admin',
 *     permissions: ['admin:read', 'admin:write']
 *   });
 *
 *   // YOU must also update session storage
 *   await db.updateSession(sessionId, updatedData);
 *
 *   return new Response(JSON.stringify({ success: true }));
 * };
 * ```
 */
export function updateSession(updates: Partial<Session>, options?: SessionSetOptions): void;
export function updateSession(updates: Partial<Session>, context?: SessionKitContext, options?: SessionSetOptions): void;
export function updateSession(
    updates: Partial<Session>,
    contextOrOptions?: SessionKitContext | SessionSetOptions,
    options?: SessionSetOptions
): void {
    const store = getContextStore();
    const hasContextShape = contextOrOptions &&
        ("cookies" in contextOrOptions || "session" in contextOrOptions || "redirect" in contextOrOptions);
    const context = hasContextShape ? contextOrOptions as SessionKitContext : undefined;
    const sessionOptions = hasContextShape ? options : contextOrOptions as SessionSetOptions | undefined;
    const ctx = context || store?.astroContext;

    if (!ctx) {
        throw new Error(
            '[SessionKit] Cannot update session: Astro context is missing. ' +
            'Provide it as a second argument or ensure sessionMiddleware is running.'
        );
    }

    // Get current session from ALS (preferred) or Astro session
    const currentSession = store?.session || ctx.session?.get<Session>('__session__');

    // Note: ctx.session.get might return a Promise in some Astro versions/drivers.
    // However, since sessionMiddleware already awaits it, store.session should be populated.
    // If store.session is missing but we are in a middleware-managed request, it means no session exists.
    
    if (!currentSession || (currentSession instanceof Promise)) {
        // If it's a promise, we might have a sync/async mismatch, but usually getSession() handles this.
        // For robustness, we check if we actually have a session object.
        const session = currentSession instanceof Promise ? null : currentSession;
        if (!session) {
            throw new Error('[SessionKit] Cannot update session: no session exists');
        }
    }

    // We can safely cast here if it's not a promise
    const session = currentSession as Session;

    // Merge updates with current session
    const updatedSession = {...session, ...updates};

    // Use setSession to handle validation and both store updates
    setSession(updatedSession, ctx, sessionOptions);
}

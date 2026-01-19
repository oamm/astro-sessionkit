// ============================================================================
// Public Server API - Use these in your Astro components/endpoints
// ============================================================================

import {getSessionContext} from "./core/context";
import {isValidSessionStructure} from "./core/validation";
import type {Session} from "./core/types";
import type {APIContext} from "astro";

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
    const context = getSessionContext();
    return context?.session ?? null;
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
 * Set session data in context.locals.session
 *
 * Use this after successful authentication to register the user's session.
 * This does NOT handle session storage (cookies, Redis, etc.) - you must do that separately.
 *
 * @param context - Astro API context
 * @param session - Session data to set
 *
 * @throws {Error} If session structure is invalid
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
 *     setSession(context, {
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
export function setSession(context: APIContext, session: Session): void {
    // Validate session structure
    if (!isValidSessionStructure(session)) {
        throw new Error(
            '[SessionKit] Invalid session structure. Session must have a valid userId and follow the Session interface.'
        );
    }

    // Set in context.locals for SessionKit middleware to read
    context.session?.set('__session__', session);
}

/**
 * Clear session from context.locals.session
 *
 * Use this during logout. This does NOT delete session storage (cookies, Redis, etc.) -
 * you must do that separately.
 *
 * @param context - Astro API context
 *
 * @example
 * ```ts
 * // In logout endpoint
 * export const POST: APIRoute = async (context) => {
 *   // Clear from SessionKit
 *   clearSession(context);
 *
 *   // YOU must also delete the session storage
 *   context.cookies.delete('session_id');
 *   await db.deleteSession(sessionId);
 *
 *   return context.redirect('/');
 * };
 * ```
 */
export function clearSession(context: APIContext): void {
    context.session?.delete('__session__');
}

/**
 * Update specific fields in the current session
 *
 * Useful for updating session data without replacing the entire session.
 * The updated session is validated before being set.
 *
 * @param context - Astro API context
 * @param updates - Partial session data to merge
 *
 * @throws {Error} If no session exists or updated session is invalid
 *
 * @example
 * ```ts
 * // Update user's role after promotion
 * export const POST: APIRoute = async (context) => {
 *   updateSession(context, {
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
export function updateSession(context: APIContext, updates: Partial<Session>): void {
    const currentSession = context.session?.get<Session>('__session__');

    if (!currentSession) {
        throw new Error('[SessionKit] Cannot update session: no session exists');
    }

    // Merge updates with current session
    const updatedSession = {...currentSession, ...updates};

    // Validate merged session
    if (!isValidSessionStructure(updatedSession)) {
        throw new Error(
            '[SessionKit] Invalid session structure after update. Ensure all fields are valid.'
        );
    }

    context.session?.set('__session__', updatedSession);
}
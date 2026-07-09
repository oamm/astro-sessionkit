// ============================================================================
// Core Session Types
// ============================================================================

import type {AstroCookies, AstroSession} from "astro";

/**
 * Minimal context required by SessionKit
 */
export interface SessionKitContext {
  cookies: AstroCookies;
  session?: AstroSession;
  redirect: (path: string, status?: number) => Response;
  [key: string]: any;
}

/**
 * The session object stored in context.locals.session
 * This is what your Astro app provides - we just read it.
 */
export interface Session {
  /** Unique user identifier */
  userId: string;

  /** User's email (optional) */
  email?: string;

  /** Primary role */
  role?: string;

  /** Additional roles for multi-role scenarios */
  roles?: string[];

  /** Fine-grained permissions */
  permissions?: string[];

  /** Any additional custom data */
  [key: string]: unknown;
}

/**
 * What we store in AsyncLocalStorage
 */
export interface SessionContext {
  session: Session | null;
  /**
   * Original Astro context (cookies, session, redirect, etc.)
   */
  astroContext?: SessionKitContext;
}

// ============================================================================
// Route Protection Rules
// ============================================================================

interface BaseProtectionRule {
  /** Glob pattern for route matching: "/admin/**", "/dashboard/*", "/settings" */
  pattern: string;

  /** Where to redirect if access denied (defaults to global loginPath) */
  redirectTo?: string;
}

/** Protect by single role */
export interface RoleProtectionRule extends BaseProtectionRule {
  role: string;
}

/** Protect by multiple roles (user must have ONE of these) */
export interface RolesProtectionRule extends BaseProtectionRule {
  roles: string[];
}

/** Protect by single permission */
export interface PermissionProtectionRule extends BaseProtectionRule {
  permission: string;
}

/** Protect by multiple permissions (user must have ALL of these) */
export interface PermissionsProtectionRule extends BaseProtectionRule {
  permissions: string[];
}

/** Protect with custom function */
export interface CustomProtectionRule extends BaseProtectionRule {
  allow: (session: Session | null) => boolean | Promise<boolean>;
}

/** Union of all protection rule types */
export type ProtectionRule =
  | RoleProtectionRule
  | RolesProtectionRule
  | PermissionProtectionRule
  | PermissionsProtectionRule
  | CustomProtectionRule;

// ============================================================================
// Configuration
// ============================================================================

/**
 * Optional hooks for custom role/permission extraction
 */
export interface AccessHooks {
  /** Extract role from session (default: session.role) */
  getRole?: (session: Session | null) => string | null;

  /** Extract permissions from session (default: session.permissions ?? []) */
  getPermissions?: (session: Session | null) => string[];

  /** Custom access check that overrides all built-in logic */
  check?: (rule: ProtectionRule, session: Session | null) => boolean | Promise<boolean>;
}

/**
 * SessionKit configuration
 */
export interface SessionKitConfig {
  /** Default redirect path for protected routes (default: "/login") */
  loginPath?: string;

  /** Route protection rules */
  protect?: ProtectionRule[];

  /** Custom access hooks */
  access?: AccessHooks;

  /** 
   * Custom session context runner (optional)
   * Use this to provide your own AsyncLocalStorage implementation or wrap the request
   */
  runWithContext?: <T>(context: SessionContext, fn: () => T) => T;

  /**
   * Custom session context getter (optional)
   * Use this to provide your own way to retrieve the session context
   */
  getContextStore?: () => SessionContext | undefined;

  /**
   * Custom session context setter (optional)
   * Use this to provide your own way to initialize the session context
   */
  setContextStore?: (context: SessionContext) => void;

  /**
   * Enable global session verification for all routes.
   * If true, any route not explicitly ignored will require an active session.
   * @default false
   */
  globalProtect?: boolean;

  /**
   * Routes to exclude from global protection (only if globalProtect is true)
   */
  exclude?: string[];

    /**
     * Optional external AsyncLocalStorage instance to use for session context.
     * If provided, SessionKit will use this instead of its internal instance.
     */
    context?: any;

    /**
     * Enable debug logging
     * @default false
     */
    debug?: boolean;

    /**
     * Rewrite the current valid session on each request so Astro can refresh
     * the backing store TTL.
     * @default false
     */
    touchOnRequest?: boolean;

    /**
     * Astro session key to rewrite when touchOnRequest is enabled.
     * @default "__session__"
     */
    touchSessionKey?: string;
}

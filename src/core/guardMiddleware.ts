// ============================================================================
// Route Guard Middleware - Enforces protection rules
// ============================================================================

import type {APIContext, MiddlewareHandler} from "astro";
import { getContextStore } from "./context";
import { getConfig } from "./config";
import { matchesPattern } from "./matcher";
import type { ProtectionRule, Session } from "./types";

/**
 * Check if session satisfies a protection rule
 */
async function checkRule(rule: ProtectionRule, session: Session | null): Promise<boolean> {
  const { access } = getConfig();

  // Custom check overrides everything
  if (access.check) {
    return await Promise.resolve(access.check(rule, session));
  }

  // Custom allow function
  if ("allow" in rule) {
    return await Promise.resolve(rule.allow(session));
  }

  // Must be authenticated for all other checks
  if (!session) {
    return false;
  }

  // Single role check
  if ("role" in rule) {
    const userRole = access.getRole(session);
    return userRole === rule.role;
  }

  // Multiple roles check (user must have ONE of these)
  if ("roles" in rule) {
    const userRole = access.getRole(session);
    return userRole !== null && rule.roles.includes(userRole);
  }

  // Single permission check
  if ("permission" in rule) {
    const userPermissions = access.getPermissions(session);
    return userPermissions.includes(rule.permission);
  }

  // Multiple permissions check (user must have ALL of these)
  if ("permissions" in rule) {
    const userPermissions = access.getPermissions(session);
    return rule.permissions.every((p) => userPermissions.includes(p));
  }

  // No specific rule matched - allow by default
  return true;
}

/**
 * Create route guard middleware
 */
export function createGuardMiddleware(): MiddlewareHandler {
  return async (context : APIContext, next) => {
    const { protect, loginPath } = getConfig();
    
    // No rules configured - skip
    if (protect.length === 0) {
      return next();
    }

    const pathname = new URL(context.request.url).pathname;
    const sessionContext = getContextStore();
    const session = sessionContext?.session ?? null;

    // Find matching rule
    const rule = protect.find((r) => matchesPattern(r.pattern, pathname));
    
    // No matching rule - allow
    if (!rule) {
      return next();
    }

    // Check if access is allowed
    const allowed = await checkRule(rule, session);

    if (!allowed) {
      const redirectTo = rule.redirectTo ?? loginPath;
      return context.redirect(redirectTo);
    }

    return next();
  };
}

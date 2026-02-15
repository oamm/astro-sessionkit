// ============================================================================
// Route Guard Middleware - Enforces protection rules
// ============================================================================

import type {MiddlewareHandler} from "astro";
import { getContextStore } from "./context";
import { getConfig } from "./config";
import { matchesPattern } from "./matcher";
import type { ProtectionRule, Session } from "./types";
import { isValidSessionStructure } from "./validation";
import * as logger from "./logger";

/**
 * Check if session satisfies a protection rule
 */
async function checkRule(rule: ProtectionRule, session: Session | null): Promise<boolean> {
  const { access } = getConfig();

  // Custom check overrides everything
  if (access.check) {
    try {
      return await access.check(rule, session);
    } catch (error) {
      logger.error('Error in custom access check hook:', error);
      return false;
    }
  }

  // Custom allow function
  if ("allow" in rule) {
    try {
      return await rule.allow(session);
    } catch (error) {
      logger.error('Error in custom rule allow function:', error);
      return false;
    }
  }

  // Must be authenticated and have a valid session structure for all other checks
  if (!session || !isValidSessionStructure(session)) {
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
  return async (context, next) => {
    let pathname: string;
    try {
        pathname = new URL(context.request.url).pathname;
    } catch {
        pathname = "/";
    }

    const config = getConfig();
    const {protect, loginPath, globalProtect, exclude, debug} = config;

    if (debug) {
        logger.debug(`[Guard] Pathname: ${pathname}, GlobalProtect: ${globalProtect}, Rules: ${protect.length}`);
    }

    // No rules configured and no global protect - skip
    if (protect.length === 0 && !globalProtect) {
        if (debug) {
            logger.debug(`[Guard] Skipping ${pathname} because no rules are configured and globalProtect is false`);
        }
        return next();
    }

    const sessionContext = getContextStore();
    const session = sessionContext?.session ?? null;

    if (debug) {
        logger.debug(`[Guard] Session retrieved from store: ${session ? 'exists' : 'null'}`);
    }

    // Find matching rule
    const rule = protect.find((r) => matchesPattern(r.pattern, pathname));

    if (rule && debug) {
        logger.debug(`[Guard] Found matching rule for ${pathname}:`, rule);
    }

    // No matching rule - check global protection
    if (!rule) {
        if (globalProtect) {
            // Skip if path is in exclude list
            if (exclude.some((pattern) => matchesPattern(pattern, pathname))) {
                if (debug) {
                    logger.debug(`[GlobalProtect] Skipping ${pathname} because it matches an exclude pattern`);
                }
                return next();
            }

            // Skip if it's the login page itself (to avoid redirect loops)
            if (pathname === loginPath) {
                if (debug) {
                    logger.debug(`[GlobalProtect] Skipping ${pathname} because it is the loginPath`);
                }
                return next();
            }

            // Require valid session
            if (!session || !isValidSessionStructure(session)) {
                if (debug) {
                    logger.debug(`[GlobalProtect] Redirecting to ${loginPath} because session is ${session ? 'invalid' : 'missing'}`);
                }
                return context.redirect(loginPath);
            }
        }

        if (debug) {
            logger.debug(`[GlobalProtect] Allowing ${pathname} because session is valid or globalProtect is false`);
        }
        return next();
    }

    // Check if access is allowed
    const allowed = await checkRule(rule, session);

    if (!allowed) {
        const redirectTo = rule.redirectTo ?? loginPath;
        if (debug) {
            logger.debug(`[Guard] Redirecting to ${redirectTo} because access was denied by rule:`, rule);
        }
        return context.redirect(redirectTo);
    }

    if (debug) {
        logger.debug(`[Guard] Allowing ${pathname} because access was granted by rule:`, rule);
    }
    return next();
  };
}

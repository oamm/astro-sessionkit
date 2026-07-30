// ============================================================================
// Route Guard Middleware - Enforces protection rules
// ============================================================================

import type {MiddlewareHandler} from "astro";
import { getContextStore } from "./context";
import { getConfig } from "./config";
import { matchesPattern } from "./matcher";
import type { ProtectionRule, Session } from "./types";
import { isValidSessionStructure, validateSessionStructure } from "./validation";
import * as logger from "./logger";

type RuleCheckResult = {
  allowed: boolean;
  reason: string;
  details?: Record<string, unknown>;
};

function getRuleType(rule: ProtectionRule): string {
  if ("allow" in rule) return "custom-allow";
  if ("role" in rule) return "role";
  if ("roles" in rule) return "roles";
  if ("permission" in rule) return "permission";
  if ("permissions" in rule) return "permissions";
  return "unknown";
}

function describeSessionForDebug(session: Session | null): Record<string, unknown> {
  if (!session) {
    return {authenticated: false};
  }

  return {
    authenticated: true,
    keys: Object.keys(session),
    userIdLength: session.userId.length,
    role: typeof session.role === "string" ? session.role : undefined,
    rolesCount: Array.isArray(session.roles) ? session.roles.length : undefined,
    permissionsCount: Array.isArray(session.permissions) ? session.permissions.length : undefined,
  };
}

/**
 * Check if session satisfies a protection rule
 */
async function checkRule(rule: ProtectionRule, session: Session | null): Promise<RuleCheckResult> {
  const { access } = getConfig();

  // Custom check overrides everything
  if (access.check) {
    try {
      const allowed = await access.check(rule, session);
      return {
        allowed,
        reason: "custom access.check hook returned " + String(allowed),
        details: {ruleType: getRuleType(rule)},
      };
    } catch (error) {
      logger.error('Error in custom access check hook:', error);
      return {
        allowed: false,
        reason: "custom access.check hook threw an error",
        details: {ruleType: getRuleType(rule)},
      };
    }
  }

  // Custom allow function
  if ("allow" in rule) {
    try {
      const allowed = await rule.allow(session);
      return {
        allowed,
        reason: "custom rule allow function returned " + String(allowed),
        details: {ruleType: "custom-allow"},
      };
    } catch (error) {
      logger.error('Error in custom rule allow function:', error);
      return {
        allowed: false,
        reason: "custom rule allow function threw an error",
        details: {ruleType: "custom-allow"},
      };
    }
  }

  // Must be authenticated and have a valid session structure for all other checks
  const validation = validateSessionStructure(session);
  if (!validation.valid) {
    return {
      allowed: false,
      reason: validation.reason ?? "session is invalid",
      details: {ruleType: getRuleType(rule), session: describeSessionForDebug(session)},
    };
  }

  // Single role check
  if ("role" in rule) {
    const userRole = access.getRole(session);
    const allowed = userRole === rule.role;
    return {
      allowed,
      reason: allowed ? "session role matched required role" : "session role did not match required role",
      details: {ruleType: "role", requiredRole: rule.role, actualRole: userRole},
    };
  }

  // Multiple roles check (user must have ONE of these)
  if ("roles" in rule) {
    const userRole = access.getRole(session);
    const allowed = userRole !== null && rule.roles.includes(userRole);
    return {
      allowed,
      reason: allowed ? "session role matched one required role" : "session role did not match any required role",
      details: {ruleType: "roles", requiredRoles: rule.roles, actualRole: userRole},
    };
  }

  // Single permission check
  if ("permission" in rule) {
    const userPermissions = access.getPermissions(session);
    const allowed = userPermissions.includes(rule.permission);
    return {
      allowed,
      reason: allowed ? "session permissions include required permission" : "session permissions do not include required permission",
      details: {
        ruleType: "permission",
        requiredPermission: rule.permission,
        actualPermissionsCount: userPermissions.length,
        missingPermissions: allowed ? [] : [rule.permission],
      },
    };
  }

  // Multiple permissions check (user must have ALL of these)
  if ("permissions" in rule) {
    const userPermissions = access.getPermissions(session);
    const missingPermissions = rule.permissions.filter((p) => !userPermissions.includes(p));
    const allowed = missingPermissions.length === 0;
    return {
      allowed,
      reason: allowed ? "session permissions include all required permissions" : "session permissions are missing required permissions",
      details: {
        ruleType: "permissions",
        requiredPermissions: rule.permissions,
        actualPermissionsCount: userPermissions.length,
        missingPermissions,
      },
    };
  }

  // No specific rule matched - allow by default
  return {
    allowed: true,
    reason: "rule has no role, permission, or custom allow requirement",
    details: {ruleType: getRuleType(rule)},
  };
}

/**
 * Create route guard middleware
 */
export function createGuardMiddleware(): MiddlewareHandler {
  return async (context, next) => {
    // 1. Get normalized pathname from context.url (preferred in Astro) or request.url
    let pathname: string;
    try {
        const url = context.url || new URL(context.request.url);
        pathname = url.pathname;
    } catch {
        pathname = "/";
    }

    // Normalize pathname by removing trailing slash (except for root)
    const normalizedPathname = pathname.length > 1 && pathname.endsWith("/") 
        ? pathname.slice(0, -1) 
        : pathname;

    const config = getConfig();
    const {protect, loginPath, globalProtect, exclude, debug} = config;
    
    // Normalize loginPath for comparison
    const normalizedLoginPath = loginPath.length > 1 && loginPath.endsWith("/")
        ? loginPath.slice(0, -1)
        : loginPath;

    if (debug) {
        logger.debug("[Guard] Evaluating request", {
            method: context.request.method,
            pathname,
            normalizedPathname,
            loginPath,
            normalizedLoginPath,
            globalProtect,
            ruleCount: protect.length,
            exclude,
        });
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
        logger.debug("[Guard] Session retrieved from context store", describeSessionForDebug(session));
    }

    // Find matching rule (using normalized path)
    const rule = protect.find((r) => matchesPattern(r.pattern, normalizedPathname));

    if (rule && debug) {
        logger.debug("[Guard] Found matching protection rule", {
            pathname,
            normalizedPathname,
            pattern: rule.pattern,
            ruleType: getRuleType(rule),
            redirectTo: rule.redirectTo,
        });
    }

    // No matching rule - check global protection
    if (!rule) {
        if (globalProtect) {
            // Skip if it's the login page itself (to avoid redirect loops)
            if (normalizedPathname === normalizedLoginPath) {
                // If session is already present, redirect to home (/) 
                // ONLY for GET requests to avoid breaking POST login/actions
                if (context.request.method === 'GET' && session && isValidSessionStructure(session)) {
                    if (debug) {
                        logger.debug("[GlobalProtect] Redirecting authenticated GET away from loginPath", {
                            pathname,
                            redirectTo: "/",
                            session: describeSessionForDebug(session),
                        });
                    }
                    return context.redirect('/');
                }

                if (debug) {
                    logger.debug("[GlobalProtect] Allowing request because pathname is loginPath", {
                        pathname,
                        method: context.request.method,
                        authenticated: Boolean(session && isValidSessionStructure(session)),
                    });
                }
                return next();
            }

            // Skip if path is in exclude list (using normalized path)
            const matchedExclude = exclude.find((pattern) => matchesPattern(pattern, normalizedPathname));
            if (matchedExclude) {
                if (debug) {
                    logger.debug("[GlobalProtect] Allowing request because pathname matches exclude pattern", {
                        pathname,
                        normalizedPathname,
                        matchedExclude,
                    });
                }
                return next();
            }

            // Require valid session
            const validation = validateSessionStructure(session);
            if (!validation.valid) {
                if (debug) {
                    logger.debug("[GlobalProtect] Redirecting because session is not valid", {
                        pathname,
                        redirectTo: loginPath,
                        reason: validation.reason,
                        session: describeSessionForDebug(session),
                    });
                }
                return context.redirect(loginPath);
            }
        }

        if (debug) {
            logger.debug("[GlobalProtect] Allowing request without matching rule", {
                pathname,
                globalProtect,
                reason: globalProtect ? "valid session satisfied global protection" : "globalProtect is false",
                session: describeSessionForDebug(session),
            });
        }
        return next();
    }

    // Check if access is allowed
    const result = await checkRule(rule, session);
    if (debug) {
        logger.debug("[Guard] Rule evaluation result", {
            pathname,
            pattern: rule.pattern,
            allowed: result.allowed,
            reason: result.reason,
            details: result.details,
            session: describeSessionForDebug(session),
        });
    }

    if (!result.allowed) {
        const redirectTo = rule.redirectTo ?? loginPath;
        if (debug) {
            logger.debug("[Guard] Redirecting because access was denied by rule", {
                pathname,
                redirectTo,
                pattern: rule.pattern,
                ruleType: getRuleType(rule),
                reason: result.reason,
            });
        }
        return context.redirect(redirectTo);
    }

    if (debug) {
        logger.debug("[Guard] Allowing request because access was granted by rule", {
            pathname,
            pattern: rule.pattern,
            ruleType: getRuleType(rule),
            reason: result.reason,
        });
    }
    return next();
  };
}

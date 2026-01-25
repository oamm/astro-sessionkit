// ============================================================================
// Configuration Store
// ============================================================================

import type { SessionKitConfig, AccessHooks, ProtectionRule, Session } from "./types";
import { isValidPattern, isValidRedirectPath } from "./validation";

/**
 * Internal config with defaults applied
 */
export interface ResolvedConfig {
  loginPath: string;
  protect: ProtectionRule[];
  access: Required<AccessHooks>;
  runWithSessionContext?: <T>(context: { session: Session | null }, fn: () => T) => T;
  getSessionContext?: () => { session: Session | null } | undefined;
}

let config: ResolvedConfig = {
  loginPath: "/login",
  protect: [],
  access: {
    getRole: (session) => session?.role ?? null,
    getPermissions: (session) => session?.permissions ?? [],
    check: undefined as any, // Will be undefined but typed for convenience
  },
  runWithSessionContext: undefined,
  getSessionContext: undefined,
};

/**
 * Set configuration (called by integration)
 */
export function setConfig(userConfig: SessionKitConfig): void {
  // Validate loginPath
  const loginPath = userConfig.loginPath ?? "/login";
  if (!isValidRedirectPath(loginPath)) {
    throw new Error(
      `[SessionKit] Invalid loginPath: "${loginPath}". Must start with / and be less than 500 characters.`
    );
  }

  // Validate protection rules
  if (userConfig.protect) {
    for (const rule of userConfig.protect) {
      // Validate pattern
      if (!isValidPattern(rule.pattern)) {
        throw new Error(
          `[SessionKit] Invalid pattern: "${rule.pattern}". ` +
          `Patterns must start with / and be less than 1000 characters.`
        );
      }

      // Validate redirectTo if present
      if (rule.redirectTo && !isValidRedirectPath(rule.redirectTo)) {
        throw new Error(
          `[SessionKit] Invalid redirectTo: "${rule.redirectTo}". ` +
          `Must start with / and be less than 500 characters.`
        );
      }
    }
  }

  // Store validated config
  config = {
    loginPath,
    protect: userConfig.protect ?? [],
    access: {
      getRole: userConfig.access?.getRole ?? ((session) => session?.role ?? null),
      getPermissions: userConfig.access?.getPermissions ?? ((session) => session?.permissions ?? []),
      check: userConfig.access?.check as any,
    },
    runWithSessionContext: userConfig.runWithSessionContext,
    getSessionContext: userConfig.getSessionContext,
  };
}

/**
 * Get current configuration
 */
export function getConfig(): ResolvedConfig {
  return config;
}

// ============================================================================
// Astro Integration
// ============================================================================

import type { AstroIntegration } from "astro";
import {getConfig, setConfig} from "./core/config";
import type { SessionKitConfig } from "./core/types";

/**
 * SessionKit - Simple session access and route protection for Astro
 * 
 * @example
 * ```ts
 * // astro.config.mjs
 * import sessionkit from 'astro-sessionkit';
 * 
 * export default defineConfig({
 *   integrations: [
 *     sessionkit({
 *       loginPath: '/login',
 *       protect: [
 *         { pattern: '/admin/**', role: 'admin' },
 *         { pattern: '/dashboard', roles: ['user', 'admin'] },
 *         { pattern: '/settings', permissions: ['settings:write'] }
 *       ]
 *     })
 *   ]
 * });
 * ```
 */
export default function sessionKit(config: SessionKitConfig = {}): AstroIntegration {
  // Store configuration
  setConfig(config);
  const resolvedConfig = getConfig();

  return {
    name: "astro-sessionkit",
    hooks: {
      "astro:config:setup": ({ addMiddleware }) => {
        // 1. Always add session context middleware first
        addMiddleware({
          entrypoint: "astro-sessionkit/middleware",
          order: "pre",
        });

        // 2. Add route guard if there are protection rules or global protection is enabled
        const hasRules = (resolvedConfig.protect && resolvedConfig.protect.length > 0);
        const isGlobal = !!resolvedConfig.globalProtect;

        if (hasRules || isGlobal) {
          addMiddleware({
            entrypoint: "astro-sessionkit/guard",
            order: "pre",
          });
        } else if (resolvedConfig.debug) {
          console.log("[SessionKit] Route guard NOT registered: no rules and globalProtect is false.");
        }
      },
    },
  };
}

export type {
  Session,
  ProtectionRule,
  RoleProtectionRule,
  RolesProtectionRule,
  PermissionProtectionRule,
  PermissionsProtectionRule,
  CustomProtectionRule,
  SessionKitConfig,
  AccessHooks,
  SessionContext
} from "./core/types";

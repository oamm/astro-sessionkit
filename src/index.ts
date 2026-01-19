// ============================================================================
// Astro SessionKit - Main Integration Entry Point
// ============================================================================

import type {AstroIntegration } from "astro";
import { setConfig } from "./core/config";
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
export default function sessionkit(config: SessionKitConfig = {}): AstroIntegration {
    // Store configuration
    setConfig(config);

    return {
        name: "astro-sessionkit",
        hooks: {
            "astro:config:setup": ({ addMiddleware }) => {
                // 1. Always add session context middleware first
                addMiddleware({
                    entrypoint: "astro-sessionkit/middleware",
                    order: "pre",
                });

                // 2. Add route guard if there are protection rules
                if (config.protect && config.protect.length > 0) {
                    addMiddleware({
                        entrypoint: "astro-sessionkit/guard",
                        order: "pre",
                    });
                }
            },
        },
    };
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

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
} from "./core/types";

// ============================================================================
// Version export
// ============================================================================

export const version = "0.1.0";
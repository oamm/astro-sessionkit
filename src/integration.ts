// ============================================================================
// Astro Integration
// ============================================================================

import type { AstroIntegration } from "astro";
import { writeFileSync } from "node:fs";
import {getConfig, setConfig} from "./core/config";
import type { SessionKitConfig } from "./core/types";

type RuntimeEntrypoint = "middleware" | "guard";

function serializeFunction(fn: Function): string {
  const source = fn.toString();

  if (
    source.startsWith("function") ||
    source.startsWith("async function") ||
    source.startsWith("(") ||
    source.includes("=>")
  ) {
    return `(${source})`;
  }

  if (source.startsWith("async ")) {
    return `(async function ${source.slice("async ".length)})`;
  }

  return `(function ${source})`;
}

function serializeRuntimeValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "function") return serializeFunction(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeRuntimeValue(item)).join(",")}]`;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  return `{${entries
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${serializeRuntimeValue(entryValue)}`)
    .join(",")}}`;
}

function createRuntimeEntrypoint(
  codegenDir: URL,
  entrypoint: RuntimeEntrypoint,
  config: SessionKitConfig,
): string {
  const file = new URL(`${entrypoint}.mjs`, codegenDir);
  const source = [
    `import { configureSessionKit } from "astro-sessionkit/runtime";`,
    `import { onRequest } from "astro-sessionkit/${entrypoint}";`,
    `configureSessionKit(${serializeRuntimeValue(config)});`,
    `export { onRequest };`,
    "",
  ].join("\n");

  writeFileSync(file, source, "utf-8");
  return file.pathname;
}

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
      "astro:config:setup": ({ addMiddleware, createCodegenDir, command }) => {
        const codegenDir = command === "build" ? createCodegenDir() : undefined;
        const sessionMiddlewareEntrypoint = codegenDir
          ? createRuntimeEntrypoint(codegenDir, "middleware", config)
          : "astro-sessionkit/middleware";

        // 1. Always add session context middleware first
        addMiddleware({
          entrypoint: sessionMiddlewareEntrypoint,
          order: "pre",
        });

        // 2. Add route guard if there are protection rules or global protection is enabled
        const hasRules = (resolvedConfig.protect && resolvedConfig.protect.length > 0);
        const isGlobal = !!resolvedConfig.globalProtect;

        if (hasRules || isGlobal) {
          const guardEntrypoint = codegenDir
            ? createRuntimeEntrypoint(codegenDir, "guard", config)
            : "astro-sessionkit/guard";
          addMiddleware({
            entrypoint: guardEntrypoint,
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

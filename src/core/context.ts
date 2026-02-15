// ============================================================================
// Session Context (AsyncLocalStorage)
// ============================================================================

import { AsyncLocalStorage } from "node:async_hooks";
import type { SessionContext } from "./types";
import { getConfig } from "./config";

const als = new AsyncLocalStorage<SessionContext>();

/**
 * Run a function with session context available
 */
export function runWithContext<T>(
  context: SessionContext,
  fn: () => T
): T {
  return als.run(context, fn);
}

/**
 * Get current Astro context (from middleware binding or explicit)
 */
export function getContextStore(): SessionContext {
  const config = getConfig();
  const getStore = config.getContextStore;
  const context = (config as any).context || als;

  const store = getStore
      ? getStore()
      : (context as AsyncLocalStorage<SessionContext>).getStore();

  if (!store) {
    throw new Error(
        'Astro context not found. Make sure to use api.middleware() to bind context automatically.'
    );
  }

  return store;
}

/**
 * Check if context is available
 */
export function hasContext(): boolean {
  const config = getConfig();
  const getStore = config.getContextStore;
  const context = (config as any).context || als;

  const store = getStore
      ? getStore()
      : (context as AsyncLocalStorage<SessionContext>).getStore();

  return !!store;
}
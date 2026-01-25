// ============================================================================
// Session Context (AsyncLocalStorage)
// ============================================================================

import { AsyncLocalStorage } from "node:async_hooks";
import type { Session } from "./types";
import { getConfig } from "./config";

/**
 * What we store in AsyncLocalStorage
 */
export interface SessionContext {
  session: Session | null;
}

const als = new AsyncLocalStorage<SessionContext>();

/**
 * Run a function with session context available
 */
export function runWithSessionContext<T>(
  context: SessionContext,
  fn: () => T
): T {
  return als.run(context, fn);
}

/**
 * Get the current session context (only available inside middleware chain)
 */
export function getSessionContext(): SessionContext | undefined {
  const customGetter = getConfig().getSessionContext;
  if (customGetter) {
    return customGetter();
  }
  return als.getStore();
}

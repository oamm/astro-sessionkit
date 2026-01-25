// ============================================================================
// Session Middleware - Loads session into AsyncLocalStorage
// ============================================================================

import type { MiddlewareHandler } from "astro";
import { runWithSessionContext as defaultRunWithSessionContext } from "./context";
import { isValidSessionStructure } from "./validation";
import type { Session } from "./types";
import { getConfig } from "./config";

/**
 * Session key used to store session in context.session
 */
const SESSION_KEY = "__session__";

/**
 * Main session middleware
 *
 * Reads session from context.session.get('__session__') and makes it available
 * throughout the request via AsyncLocalStorage
 */
export const sessionMiddleware: MiddlewareHandler = async (context, next) => {
  // Get session from context.session store
  const rawSession = context.session?.get<Session>(SESSION_KEY) ?? null;

  // Validate session structure if present
  let session: Session | null = null;

  if (rawSession) {
    if (isValidSessionStructure(rawSession)) {
      session = rawSession;
    } else {
      // Invalid session structure - log warning and treat as unauthenticated
      if (process.env.NODE_ENV !== 'production') {
        console.warn(
            '[SessionKit] Invalid session structure detected. Session will be ignored. ' +
            'Ensure context.session.set("__session__", ...) has the correct structure.'
        );
      }
      session = null;
    }
  }

  // Run the rest of the request chain with session context
  const config = getConfig();

  // If getSessionContext is provided, but runWithSessionContext is NOT,
  // we assume the user is managing the context at a superior level
  // and we should NOT wrap the call in our default runner.
  if (config.getSessionContext && !config.runWithSessionContext) {
    return next();
  }

  const runner = config.runWithSessionContext ?? defaultRunWithSessionContext;
  return runner({ session }, () => next());
};
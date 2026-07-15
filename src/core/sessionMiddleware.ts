// ============================================================================
// Session Middleware - Loads session into AsyncLocalStorage
// ============================================================================

import type {MiddlewareHandler} from "astro";
import {runWithContext as defaultRunWithContext} from "./context";
import {isValidSessionStructure} from "./validation";
import type {Session, SessionContext, SessionKitContext} from "./types";
import {getConfig} from "./config";
import * as logger from "./logger";

/**
 * Session key used to store session in context.session
 */
const SESSION_KEY = "__session__";

/**
 * Redundant logging prevention key
 */
const LOGGED_KEY = Symbol.for('astro-sessionkit.middleware.logged');

/**
 * Main session middleware
 *
 * Reads session from context.session.get('__session__') and makes it available
 * throughout the request via AsyncLocalStorage
 */
export const sessionMiddleware: MiddlewareHandler = async (context, next) => {
    const config = getConfig();
    const {runWithContext, getContextStore, setContextStore, context: externalContext, debug} = config;

    // Get session from context.session store
    const rawSession = await context.session?.get<unknown>(SESSION_KEY) ?? null;

    // Validate session structure if present
    let session: Session | null = null;

    if (rawSession !== null) {
        if (isValidSessionStructure(rawSession)) {
            session = rawSession;
            if (config.touchOnRequest && typeof context.session?.set === "function") {
                await context.session.set(config.touchSessionKey, session);
            }
        } else {
            // Invalid session structure - log warning, remove it, and treat as unauthenticated
            logger.warn(
                'Invalid session structure detected. Session will be ignored. ' +
                'Ensure context.session.set("__session__", ...) has the correct structure. ' +
                'Received: ' + JSON.stringify(rawSession)
            );
            await context.session?.delete(SESSION_KEY);
            if (typeof (context.session as any)?.destroy === "function") {
                await (context.session as any).destroy();
            }
            session = null;
        }
    }

    // Run the rest of the request chain with session context
    const globalStorage = globalThis as any;
    if (!globalStorage[LOGGED_KEY]) {
        let contextStrategy = 'default';

        if (runWithContext) {
            contextStrategy = 'custom (runWithContext)';
        } else if (getContextStore) {
            contextStrategy = 'custom (getter/setter)';
        } else if (externalContext) {
            contextStrategy = 'custom (external AsyncLocalStorage)';
        }

        logger.debug(`[SessionKit] Middleware initialized (context: ${contextStrategy})`);
        globalStorage[LOGGED_KEY] = true;
    }

    const runLogic = () => next();
    const sessionContext: SessionContext = { session, astroContext: context as SessionKitContext };

    // If getContextStore is provided, but runWithContext is NOT,
    // we assume the user is managing the context at a superior level
    // and we should NOT wrap the call in our default runner.
    if (getContextStore && !runWithContext) {
        // Initialize context store if setter is provided
        const store = getContextStore();
        if (debug) {
            logger.debug('[SessionMiddleware] Custom getContextStore returned:', !!store);
        }
        if (store) {
            store.session = session;
        } else if (setContextStore) {
            if (debug) {
                logger.debug('[SessionMiddleware] Calling custom setContextStore');
            }
            setContextStore(sessionContext);
        } else {
            logger.error('getContextStore returned undefined, cannot set session');
        }
        return runLogic();
    }

    if (debug) {
        logger.debug('[SessionMiddleware] Using' + (runWithContext ? ' custom ' : ' default ') + 'runner');
    }

    const runner = runWithContext ?? defaultRunWithContext;
    return runner(sessionContext, runLogic);
};

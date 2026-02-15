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
    // Get session from context.session store
    const rawSession = await context.session?.get<Session>(SESSION_KEY) ?? null;

    // Validate session structure if present
    let session: Session | null = null;

    if (rawSession) {
        if (isValidSessionStructure(rawSession)) {
            session = rawSession;
        } else {
            // Invalid session structure - log warning and treat as unauthenticated
            logger.warn(
                'Invalid session structure detected. Session will be ignored. ' +
                'Ensure context.session.set("__session__", ...) has the correct structure. ' +
                'Received: ' + JSON.stringify(rawSession)
            );
            session = null;
        }
    }

    // Run the rest of the request chain with session context
    const config = getConfig();

    const globalStorage = globalThis as any;
    if (!globalStorage[LOGGED_KEY]) {
        let contextStrategy = 'default';

        if (config.runWithContext) {
            contextStrategy = 'custom (runWithContext)';
        } else if (config.getContextStore) {
            contextStrategy = 'custom (getter/setter)';
        } else if (config.context) {
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
    if (config.getContextStore && !config.runWithContext) {
        // Initialize context store if setter is provided
        const store = config.getContextStore();
        if (config.debug) {
            logger.debug('[SessionMiddleware] Custom getContextStore returned:', !!store);
        }
        if (store) {
            store.session = session;
        } else if (config.setContextStore) {
            if (config.debug) {
                logger.debug('[SessionMiddleware] Calling custom setContextStore');
            }
            config.setContextStore(sessionContext);
        } else {
            logger.error('getContextStore returned undefined, cannot set session');
        }
        return runLogic();
    }

    if (config.debug) {
        logger.debug('[SessionMiddleware] Using' + (config.runWithContext ? ' custom ' : ' default ') + 'runner');
    }

    const runner = config.runWithContext ?? defaultRunWithContext;
    return runner(sessionContext, runLogic);
};
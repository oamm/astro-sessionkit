// ============================================================================
// Session Middleware - Loads session into AsyncLocalStorage
// ============================================================================

import type {MiddlewareHandler} from "astro";
import {runWithContext as defaultRunWithContext} from "./context";
import {validateSessionStructure} from "./validation";
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

function getValueType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function describeSessionForDebug(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {type: getValueType(value)};
    }

    const session = value as Partial<Session>;
    return {
        type: "object",
        keys: Object.keys(session),
        hasUserId: typeof session.userId === "string" && session.userId.trim().length > 0,
        userIdLength: typeof session.userId === "string" ? session.userId.length : undefined,
        hasEmail: typeof session.email === "string" && session.email.length > 0,
        role: typeof session.role === "string" ? session.role : undefined,
        rolesCount: Array.isArray(session.roles) ? session.roles.length : undefined,
        permissionsCount: Array.isArray(session.permissions) ? session.permissions.length : undefined,
    };
}

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
    if (debug) {
        logger.debug("[SessionMiddleware] Read session from Astro store", {
            key: SESSION_KEY,
            sessionStoreAvailable: Boolean(context.session),
            rawSession: describeSessionForDebug(rawSession),
        });
    }

    // Validate session structure if present
    let session: Session | null = null;

    if (rawSession !== null) {
        const validation = validateSessionStructure(rawSession);
        if (debug) {
            logger.debug("[SessionMiddleware] Session validation result", {
                valid: validation.valid,
                reason: validation.reason,
                rawSession: describeSessionForDebug(rawSession),
            });
        }

        if (validation.valid) {
            session = rawSession as Session;
            if (config.touchOnRequest && typeof context.session?.set === "function") {
                if (config.sessionTtl !== undefined) {
                    await context.session.set(config.touchSessionKey, session, {ttl: config.sessionTtl});
                } else {
                    await context.session.set(config.touchSessionKey, session);
                }
                if (debug) {
                    logger.debug("[SessionMiddleware] Touched valid session", {
                        key: config.touchSessionKey,
                        ttl: config.sessionTtl,
                    });
                }
            } else if (debug) {
                logger.debug("[SessionMiddleware] Did not touch session", {
                    touchOnRequest: config.touchOnRequest,
                    sessionSetAvailable: typeof context.session?.set === "function",
                });
            }
        } else {
            // Invalid session structure - log warning, remove it, and treat as unauthenticated
            logger.warn(
                'Invalid session structure detected. Session will be ignored. ' +
                'Ensure context.session.set("__session__", ...) has the correct structure. ' +
                `Reason: ${validation.reason}. ` +
                'Received: ' + JSON.stringify(rawSession)
            );
            await context.session?.delete(SESSION_KEY);
            if (typeof (context.session as any)?.destroy === "function") {
                await (context.session as any).destroy();
                if (debug) {
                    logger.debug("[SessionMiddleware] Destroyed backing Astro session after invalid SessionKit session");
                }
            } else if (debug) {
                logger.debug("[SessionMiddleware] Deleted invalid SessionKit session value", {
                    key: SESSION_KEY,
                    destroyAvailable: false,
                });
            }
            session = null;
        }
    } else if (debug) {
        logger.debug("[SessionMiddleware] No stored SessionKit session found; request is unauthenticated", {
            key: SESSION_KEY,
        });
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

        logger.debug(`Middleware initialized (context: ${contextStrategy})`);
        globalStorage[LOGGED_KEY] = true;
    }

    const runLogic = () => next();
    const sessionContext: SessionContext = { session, astroContext: context as SessionKitContext };
    if (debug) {
        logger.debug("[SessionMiddleware] Prepared request context", {
            authenticated: session !== null,
            session: describeSessionForDebug(session),
        });
    }

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

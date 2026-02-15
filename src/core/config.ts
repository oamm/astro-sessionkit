// ============================================================================
// Configuration Store
// ============================================================================

import type {SessionKitConfig, AccessHooks, ProtectionRule, Session, SessionContext} from "./types";
import {isValidPattern, isValidRedirectPath} from "./validation";
import * as logger from "./logger";

/**
 * Internal config with defaults applied
 */
export interface ResolvedConfig {
    loginPath: string;
    protect: ProtectionRule[];
    access: Required<Omit<AccessHooks, "check">> & {
        check?: AccessHooks["check"];
    };
    runWithContext?: <T>(context: SessionContext, fn: () => T) => T | Promise<T>;
    getContextStore?: () => SessionContext | undefined;
    setContextStore?: (context: SessionContext) => void;
    globalProtect: boolean;
    exclude: string[];
    debug: boolean;
}

const DEFAULT_CONFIG: ResolvedConfig = {
    loginPath: "/login",
    protect: [],
    access: {
        getRole: (session: Session | null) => session?.role ?? null,
        getPermissions: (session: Session | null) => session?.permissions ?? [],
        check: undefined,
    },
    globalProtect: false,
    exclude: [],
    debug: false,
};

let config: ResolvedConfig = { ...DEFAULT_CONFIG };

/**
 * Set configuration (called by integration)
 */
export function setConfig(userConfig: SessionKitConfig): void {
    // Start with default config
    const newConfig: ResolvedConfig = { ...DEFAULT_CONFIG };

    // Validate and set loginPath
    if (userConfig.loginPath !== undefined) {
        if (!isValidRedirectPath(userConfig.loginPath)) {
            throw new Error(
                `[SessionKit] Invalid loginPath: "${userConfig.loginPath}". Must start with / and be less than 500 characters.`
            );
        }
        newConfig.loginPath = userConfig.loginPath;
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
        newConfig.protect = [...userConfig.protect];
    }

    // Validate context store getter/setter pair
    if ((userConfig.getContextStore && !userConfig.setContextStore) || (!userConfig.getContextStore && userConfig.setContextStore)) {
        throw new Error(
            '[SessionKit] Both getContextStore and setContextStore must be provided together if using custom context storage.'
        );
    }

    // Set access hooks
    if (userConfig.access) {
        newConfig.access = {
            getRole: userConfig.access.getRole ?? DEFAULT_CONFIG.access.getRole,
            getPermissions: userConfig.access.getPermissions ?? DEFAULT_CONFIG.access.getPermissions,
            check: userConfig.access.check,
        };

        // Migration/Safety: If user misplaced globalProtect/exclude/debug in access object,
        // we honor them but warn about it.
        const anyAccess = userConfig.access as any;
        if (anyAccess.globalProtect !== undefined && userConfig.globalProtect === undefined) {
            newConfig.globalProtect = anyAccess.globalProtect;
            logger.warn('Deprecation: globalProtect should be at the top level of configuration, not inside "access".');
        }
        if (anyAccess.exclude !== undefined && userConfig.exclude === undefined) {
            newConfig.exclude = anyAccess.exclude;
            logger.warn('Deprecation: exclude should be at the top level of configuration, not inside "access".');
        }
        if (anyAccess.debug !== undefined && userConfig.debug === undefined) {
            newConfig.debug = anyAccess.debug;
            logger.warn('Deprecation: debug should be at the top level of configuration, not inside "access".');
        }
    }

    // Set context hooks
    newConfig.runWithContext = userConfig.runWithContext;
    newConfig.getContextStore = userConfig.getContextStore;
    newConfig.setContextStore = userConfig.setContextStore;
    
    if (userConfig.globalProtect !== undefined) {
        newConfig.globalProtect = userConfig.globalProtect;
    }

    if (userConfig.exclude !== undefined) {
        for (const pattern of userConfig.exclude) {
            if (!isValidPattern(pattern)) {
                throw new Error(
                    `[SessionKit] Invalid exclude pattern: "${pattern}". ` +
                    `Patterns must start with / and be less than 1000 characters.`
                );
            }
        }
        newConfig.exclude = [...userConfig.exclude];
    } else if (newConfig.exclude.length === 0) {
        newConfig.exclude = [...DEFAULT_CONFIG.exclude];
    }

    if (userConfig.debug !== undefined) {
        newConfig.debug = userConfig.debug;
    }

    // Atomic update
    config = Object.freeze(newConfig);
}

/**
 * Get current configuration
 */
export function getConfig(): ResolvedConfig {
    return config;
}

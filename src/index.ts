// ============================================================================
// Astro SessionKit - Main Integration Entry Point
// ============================================================================

import sessionkit from "./integration";

export default sessionkit;

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
    SessionContext
} from "./core/types";

// ============================================================================
// Version export
// ============================================================================

export const version = "0.1.20";

// ============================================================================
// Security Validation Utilities
// ============================================================================

import type {Session} from "./types";

export interface SessionValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Validate that session has the expected structure
 * Prevents crashes from malformed data and DoS attacks
 */
export function validateSessionStructure(input: unknown): SessionValidationResult {
    // Must be an object
    if (!input || typeof input !== 'object') {
        return {valid: false, reason: "session must be an object"};
    }

    const session = input as any;

    // Required: userId must be a non-empty string
    if (typeof session.userId !== 'string' || !session.userId.trim()) {
        return {valid: false, reason: "userId must be a non-empty string"};
    }

    // Security: Check for unexpected null bytes or control characters in userId
    if (/[\x00-\x1F\x7F]/.test(session.userId)) {
        return {valid: false, reason: "userId must not contain control characters"};
    }

    // DoS protection: Limit userId length
    if (session.userId.length > 255) {
        return {valid: false, reason: "userId must be 255 characters or fewer"};
    }

    // Optional fields validation (if present)
    if (session.email !== undefined && session.email !== null) {
        if (typeof session.email !== 'string') {
            return {valid: false, reason: "email must be a string when provided"};
        }
        // Reasonable email length limit
        if (session.email.length > 320) {
            return {valid: false, reason: "email must be 320 characters or fewer"};
        }
        // Basic email format sanity check (not full validation, just security)
        if (session.email.length > 0 && !session.email.includes('@')) {
            return {valid: false, reason: "email must include @ when provided"};
        }
    }

    if (session.role !== undefined && session.role !== null) {
        if (typeof session.role !== 'string') {
            return {valid: false, reason: "role must be a string when provided"};
        }
        // Reasonable role length limit
        if (session.role.length > 100) {
            return {valid: false, reason: "role must be 100 characters or fewer"};
        }
        // Security: No control characters in role
        if (/[\x00-\x1F\x7F]/.test(session.role)) {
            return {valid: false, reason: "role must not contain control characters"};
        }
    }

    if (session.roles !== undefined && session.roles !== null) {
        if (!Array.isArray(session.roles)) {
            return {valid: false, reason: "roles must be an array when provided"};
        }
        // DoS protection: Limit array size
        if (session.roles.length > 100) {
            return {valid: false, reason: "roles must contain 100 items or fewer"};
        }
        // All items must be strings with reasonable length
        if (!session.roles.every((r: any) => typeof r === 'string' && r.length <= 100)) {
            return {valid: false, reason: "each role in roles must be a string of 100 characters or fewer"};
        }
    }

    if (session.permissions !== undefined && session.permissions !== null) {
        if (!Array.isArray(session.permissions)) {
            return {valid: false, reason: "permissions must be an array when provided"};
        }
        // DoS protection: Limit array size
        if (session.permissions.length > 500) {
            return {valid: false, reason: "permissions must contain 500 items or fewer"};
        }
        // All items must be strings with reasonable length
        if (!session.permissions.every((p: any) => typeof p === 'string' && p.length <= 200)) {
            return {valid: false, reason: "each permission must be a string of 200 characters or fewer"};
        }
    }

    return {valid: true};
}

/**
 * Validate that session has the expected structure
 * Prevents crashes from malformed data and DoS attacks
 */
export function isValidSessionStructure(input: unknown): input is Session {
    return validateSessionStructure(input).valid;
}

/**
 * Validate route patterns to prevent ReDoS attacks
 */
export function isValidPattern(pattern: string): boolean {

    if (typeof pattern !== 'string' || pattern.length === 0) return false;

    // Length limit
    if (pattern.length > 1000) return false;

    // Must start with /
    if (!pattern.startsWith("/")) return false;

    // ReDoS protection: reject 4+ consecutive asterisks anywhere
    if (/\*{4,}/.test(pattern)) return false;

    // Additional sanity: ensure any '*' run is 1..3
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] !== "*") continue;

        let j = i;
        while (j < pattern.length && pattern[j] === "*") j++;

        const run = j - i; // consecutive '*'
        if (run < 1 || run > 3) return false; // (4+ already blocked above)

        // Optional: keep your patterns segment-oriented.
        // Wildcards should not be glued to letters (e.g., "/**abc").
        const next = pattern[j];
        if (next !== undefined && next !== "/") return false;

        i = j - 1;
    }

    return true;
}

/**
 * Validate redirect path (open redirect protection)
 */
export function isValidRedirectPath(path: string): boolean {

    if (typeof path !== 'string') return false;

    // Reasonable length limit
    if (path.length === 0 || path.length > 500) return false;

    // Must be a site-relative path (exactly one leading slash)
    // Reject protocol-relative URLs like "//example.com"
    if (!path.startsWith("/") || path.startsWith("//")) return false;

    // Extra hardening: reject anything that looks like a URL scheme
    // (e.g. "http://", "https://", "javascript:", "data:", etc.)
    return !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path);


}

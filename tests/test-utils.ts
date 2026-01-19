// ============================================================================
// Test Utilities
// ============================================================================

import {vi} from "vitest";
import type {Session} from "../src/core/types";

/**
 * Session key used by SessionKit
 */
export const SESSION_KEY = "__session__";

/**
 * Mock session store that mimics Astro's session API
 */
export type MockSessionStore = {
    get: <T = unknown>(key: string) => T | undefined;
    set: (key: string, value: unknown) => void;
    delete: (key: string) => void;
    has: (key: string) => boolean;
    _store: Map<string, unknown>;
};


type StoreGet = <T = unknown>(key: string) => T | undefined;
type StoreSet = (key: string, value: unknown) => void;
type StoreDelete = (key: string) => void;
type StoreHas = (key: string) => boolean;

/**
 * Create a mock session store
 */
export function mockSessionStore(seed: Record<string, unknown> = {}): MockSessionStore {
    const store = new Map<string, unknown>(Object.entries(seed));

    const get: StoreGet = vi.fn((key: string) => store.get(key) as unknown) as unknown as StoreGet;
    const set: StoreSet = vi.fn((key: string, value: unknown) => {
        store.set(key, value);
    });
    const del: StoreDelete = vi.fn((key: string) => {
        store.delete(key);
    });
    const has: StoreHas = vi.fn((key: string) => store.has(key));

    return {
        _store: store,
        get,
        set,
        delete: del,
        has,
    };
}

/**
 * Create a mock session object
 */
export function mockSession(overrides: Partial<Session> = {}): Session {
    return {
        userId: "test-user-id",
        email: "test@example.com",
        role: "user",
        roles: [],
        permissions: [],
        ...overrides,
    };
}

/**
 * Mock Astro context for testing
 */
export function mockContext(options: {
    url?: string;
    session?: Session | null;
    locals?: Record<string, any>;
    params?: Record<string, string>;
    sessionSeed?: Record<string, unknown>;
} = {}) {
    const {
        url = "http://localhost",
        session = null,
        locals = {},
        params = {},
        sessionSeed = {},
    } = options;

    const request = new Request(url, {
        headers: {accept: "text/html"},
    });

    // Seed the store with session if provided
    const seed: Record<string, unknown> = {...sessionSeed};
    if (session !== null) {
        seed[SESSION_KEY] = session;
    }

    const sessionStore = mockSessionStore(seed);

    return {
        request,
        url: new URL(url),
        params,
        locals: {...locals},
        session: sessionStore,
        cookies: {
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
            has: vi.fn(),
        },
        redirect: (location: string, status = 302) =>
            new Response(null, {status, headers: {Location: location}}),
    };
}

/**
 * Mock next function for middleware testing
 */
export function mockNext(result = new Response("ok")) {
    return vi.fn(() => result);
}
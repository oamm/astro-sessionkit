import {describe, it, expect, beforeEach, vi} from "vitest";
import {setConfig} from "../src/core/config";
import {getContextStore} from "../src/core/context";
import {sessionMiddleware} from "../src/core/sessionMiddleware";
import type {Session} from "../src";

describe("custom getContextStore", () => {
    beforeEach(() => {
        // Reset config before each test
        setConfig({});
    });

    it("uses custom getContextStore when provided", () => {
        const mockSession: Session = {userId: "custom-user"};
        const customGetter = vi.fn(() => ({session: mockSession}));

        setConfig({
            getContextStore: customGetter,
        });

        const context = getContextStore();
        expect(customGetter).toHaveBeenCalled();
        expect(context?.session).toBe(mockSession);
    });

    it("falls back to default when getContextStore is not provided", () => {
        const context = getContextStore();
        // In test environment without als.run, this should be undefined
        expect(context).toBeUndefined();
    });

    it("bypasses default runner when getContextStore is provided but runWithContext is not", async () => {
        const mockSession: Session = {userId: "custom-user"};
        const customGetter = vi.fn(() => ({session: mockSession}));

        setConfig({
            getContextStore: customGetter,
        });

        const next = vi.fn(() => Promise.resolve(new Response("ok")));
        const context: any = {
            session: {
                get: () => null // No session in Astro store
            }
        };

        await sessionMiddleware(context, next);

        expect(next).toHaveBeenCalled();
        // Should NOT have used default als.run, so if we check getContextStore inside next, it should use customGetter

        const innerContext = getContextStore();
        expect(innerContext?.session).toBe(mockSession);
    });

    it("uses custom runner even if custom getter is provided", async () => {
        const mockSession: Session = {userId: "custom-user"};
        const customGetter = vi.fn(() => ({session: mockSession}));
        const customRunner = vi.fn((_: any, fn: any) => fn());

        setConfig({
            getContextStore: customGetter,
            runWithContext: customRunner,
        });

        const next = vi.fn(() => Promise.resolve(new Response("ok")));
        const context: any = {
            session: {
                get: () => null
            }
        };

        await sessionMiddleware(context, next);

        expect(customRunner).toHaveBeenCalled();
        expect(next).toHaveBeenCalled();
    });
});

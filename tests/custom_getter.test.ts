import {describe, it, expect, beforeEach, vi} from "vitest";
import {setConfig} from "../src/core/config";
import {getSessionContext} from "../src/core/context";
import {sessionMiddleware} from "../src/core/sessionMiddleware";
import type {Session} from "../src";

describe("custom getSessionContext", () => {
    beforeEach(() => {
        // Reset config before each test
        setConfig({});
    });

    it("uses custom getSessionContext when provided", () => {
        const mockSession: Session = {userId: "custom-user"};
        const customGetter = vi.fn(() => ({session: mockSession}));

        setConfig({
            getSessionContext: customGetter,
        });

        const context = getSessionContext();
        expect(customGetter).toHaveBeenCalled();
        expect(context?.session).toBe(mockSession);
    });

    it("falls back to default when getSessionContext is not provided", () => {
        const context = getSessionContext();
        // In test environment without als.run, this should be undefined
        expect(context).toBeUndefined();
    });

    it("bypasses default runner when getSessionContext is provided but runWithSessionContext is not", async () => {
        const mockSession: Session = {userId: "custom-user"};
        const customGetter = vi.fn(() => ({session: mockSession}));

        setConfig({
            getSessionContext: customGetter,
        });

        const next = vi.fn(() => Promise.resolve(new Response("ok")));
        const context: any = {
            session: {
                get: () => null // No session in Astro store
            }
        };

        await sessionMiddleware(context, next);

        expect(next).toHaveBeenCalled();
        // Should NOT have used default als.run, so if we check getSessionContext inside next, it should use customGetter

        const innerContext = getSessionContext();
        expect(innerContext?.session).toBe(mockSession);
    });

    it("uses custom runner even if custom getter is provided", async () => {
        const mockSession: Session = {userId: "custom-user"};
        const customGetter = vi.fn(() => ({session: mockSession}));
        const customRunner = vi.fn((_: any, fn: any) => fn());

        setConfig({
            getSessionContext: customGetter,
            runWithSessionContext: customRunner,
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

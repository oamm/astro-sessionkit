// ============================================================================
// Global Guard Middleware Tests
// ============================================================================

import {describe, it, expect, beforeEach} from "vitest";
import {createGuardMiddleware} from "../src/core/guardMiddleware";
import {runWithContext} from "../src/core/context";
import {setConfig, resetConfig} from "../src/core/config";
import {mockContext, mockSession, mockNext} from "./test-utils";

describe("globalGuardMiddleware", () => {
    beforeEach(() => {
        // Reset config before each test
        resetConfig();
    });

    describe("globalProtect enabled", () => {
        it("redirects unauthenticated users from any route", async () => {
            setConfig({
                globalProtect: true,
                loginPath: "/login"
            });

            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/any-route"});
            const next = mockNext();

            await runWithContext({session: null}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
                expect(response.headers.get("Location")).toBe("/login");
            });

            expect(next).not.toHaveBeenCalled();
        });

        it("allows authenticated users to any route", async () => {
            setConfig({
                globalProtect: true
            });

            const session = mockSession();
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/any-route"});
            const next = mockNext();

            await runWithContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("allows unauthenticated users to excluded routes", async () => {
            setConfig({
                globalProtect: true,
                exclude: ["/public/**", "/about"]
            });

            const guard = createGuardMiddleware();
            const next = mockNext();

            // Test /public/page
            const ctx1 = mockContext({url: "http://localhost/public/page"});
            await runWithContext({session: null}, async () => {
                await guard(ctx1 as any, next as any);
            });
            expect(next).toHaveBeenCalledTimes(1);

            // Test /about
            const ctx2 = mockContext({url: "http://localhost/about"});
            await runWithContext({session: null}, async () => {
                await guard(ctx2 as any, next as any);
            });
            expect(next).toHaveBeenCalledTimes(2);
        });

        it("automatically allows access to loginPath", async () => {
            setConfig({
                globalProtect: true,
                loginPath: "/auth/login"
            });

            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/auth/login"});
            const next = mockNext();

            await runWithContext({session: null}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("respects specific protection rules over globalProtect", async () => {
            setConfig({
                globalProtect: true,
                protect: [
                    { pattern: "/admin/**", role: "admin" }
                ]
            });

            const guard = createGuardMiddleware();
            const next = mockNext();

            // User is authenticated but doesn't have the role
            const session = mockSession({ role: "user" });
            const ctx = mockContext({url: "http://localhost/admin/dashboard"});

            await runWithContext({session}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
                expect(response.headers.get("Location")).toBe("/login");
            });

            expect(next).not.toHaveBeenCalled();
        });
    });
});

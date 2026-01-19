// ============================================================================
// Guard Middleware Tests
// ============================================================================

import {describe, it, expect, beforeEach} from "vitest";
import {createGuardMiddleware} from "../src/core/guardMiddleware";
import {runWithSessionContext} from "../src/core/context";
import {setConfig} from "../src/core/config";
import {mockContext, mockSession, mockNext} from "./test-utils";

describe("guardMiddleware", () => {
    beforeEach(() => {
        // Reset config before each test
        setConfig({protect: []});
    });

    describe("no protection rules", () => {
        it("allows all requests when no rules configured", async () => {
            setConfig({protect: []});

            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin"});
            const next = mockNext();

            await runWithSessionContext({session: null}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });
    });

    describe("role-based protection", () => {
        it("allows access when user has required role", async () => {
            setConfig({
                protect: [{pattern: "/admin/**", role: "admin"}],
            });

            const session = mockSession({role: "admin"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin/users"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("redirects when user lacks required role", async () => {
            setConfig({
                loginPath: "/login",
                protect: [{pattern: "/admin/**", role: "admin"}],
            });

            const session = mockSession({role: "user"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin/users"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
                expect(response.headers.get("Location")).toBe("/login");
            });

            expect(next).not.toHaveBeenCalled();
        });

        it("redirects unauthenticated users", async () => {
            setConfig({
                protect: [{pattern: "/admin/**", role: "admin"}],
            });

            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin"});
            const next = mockNext();

            await runWithSessionContext({session: null}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
            });

            expect(next).not.toHaveBeenCalled();
        });
    });

    describe("multiple roles protection", () => {
        it("allows access when user has one of the required roles", async () => {
            setConfig({
                protect: [{pattern: "/dashboard", roles: ["user", "admin", "moderator"]}],
            });

            const session = mockSession({role: "moderator"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/dashboard"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("redirects when user has none of the required roles", async () => {
            setConfig({
                protect: [{pattern: "/dashboard", roles: ["admin", "moderator"]}],
            });

            const session = mockSession({role: "user"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/dashboard"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
            });

            expect(next).not.toHaveBeenCalled();
        });
    });

    describe("permission-based protection", () => {
        it("allows access when user has required permission", async () => {
            setConfig({
                protect: [{pattern: "/settings", permission: "settings:write"}],
            });

            const session = mockSession({permissions: ["settings:read", "settings:write"]});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/settings"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("redirects when user lacks required permission", async () => {
            setConfig({
                protect: [{pattern: "/settings", permission: "settings:write"}],
            });

            const session = mockSession({permissions: ["settings:read"]});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/settings"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
            });

            expect(next).not.toHaveBeenCalled();
        });
    });

    describe("multiple permissions protection", () => {
        it("allows access when user has all required permissions", async () => {
            setConfig({
                protect: [{pattern: "/admin/users", permissions: ["users:read", "users:write"]}],
            });

            const session = mockSession({
                permissions: ["users:read", "users:write", "users:delete"],
            });
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin/users"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("redirects when user lacks any required permission", async () => {
            setConfig({
                protect: [{pattern: "/admin/users", permissions: ["users:read", "users:write"]}],
            });

            const session = mockSession({permissions: ["users:read"]});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin/users"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
            });

            expect(next).not.toHaveBeenCalled();
        });
    });

    describe("custom allow function", () => {
        it("allows access when custom function returns true", async () => {
            setConfig({
                protect: [
                    {
                        pattern: "/premium/**",
                        allow: (session) => session?.subscription === "premium",
                    },
                ],
            });

            const session = mockSession({subscription: "premium"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/premium/content"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("redirects when custom function returns false", async () => {
            setConfig({
                protect: [
                    {
                        pattern: "/premium/**",
                        allow: (session) => session?.subscription === "premium",
                    },
                ],
            });

            const session = mockSession({subscription: "free"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/premium/content"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                ;
                expect(response.status).toBe(302);
            });

            expect(next).not.toHaveBeenCalled();
        });

        it("supports async allow functions", async () => {
            setConfig({
                protect: [
                    {
                        pattern: "/special",
                        allow: async (session) => {
                            await new Promise((resolve) => setTimeout(resolve, 10));
                            return session?.userId === "special-user";
                        },
                    },
                ],
            });

            const session = mockSession({userId: "special-user"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/special"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });
    });

    describe("custom redirect paths", () => {
        it("redirects to rule-specific path", async () => {
            setConfig({
                loginPath: "/login",
                protect: [
                    {
                        pattern: "/admin/**",
                        role: "admin",
                        redirectTo: "/unauthorized",
                    },
                ],
            });

            const session = mockSession({role: "user"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                const response = await guard(ctx as any, next as any) as Response;
                expect(response.status).toBe(302);
                expect(response.headers.get("Location")).toBe("/unauthorized");
            });
        });
    });

    describe("pattern matching", () => {
        it("only applies rules to matching paths", async () => {
            setConfig({
                protect: [{pattern: "/admin/**", role: "admin"}],
            });

            const session = mockSession({role: "user"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/public"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            // Should allow access since path doesn't match
            expect(next).toHaveBeenCalled();
        });

        it("matches exact patterns", async () => {
            setConfig({
                protect: [{pattern: "/settings", role: "admin"}],
            });

            const session = mockSession({role: "admin"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/settings"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });
    });

    describe("custom access hooks", () => {
        it("uses custom getRole hook", async () => {
            setConfig({
                protect: [{pattern: "/admin/**", role: "superadmin"}],
                access: {
                    getRole: (session) => session?.customRole as string,
                },
            });

            const session = mockSession({customRole: "superadmin"});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/admin"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("uses custom getPermissions hook", async () => {
            setConfig({
                protect: [{pattern: "/settings", permission: "custom:perm"}],
                access: {
                    getPermissions: (session) => session?.customPerms as string[],
                },
            });

            const session = mockSession({customPerms: ["custom:perm"]});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/settings"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });

        it("uses custom check hook to override all logic", async () => {
            setConfig({
                protect: [{pattern: "/special/**", role: "admin"}],
                access: {
                    check: (_, session) => {
                        // Custom logic that ignores the role requirement
                        return session?.specialAccess === true;
                    },
                },
            });

            const session = mockSession({role: "user", specialAccess: true});
            const guard = createGuardMiddleware();
            const ctx = mockContext({url: "http://localhost/special/page"});
            const next = mockNext();

            await runWithSessionContext({session}, async () => {
                await guard(ctx as any, next as any);
            });

            expect(next).toHaveBeenCalled();
        });
    });
});
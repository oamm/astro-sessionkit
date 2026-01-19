// ============================================================================
// Server API Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  getSession,
  requireSession,
  isAuthenticated,
  hasRole,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  setSession,
  clearSession,
  updateSession,
} from "../src/server";
import { runWithSessionContext } from "../src/core/context";
import { mockSession, mockContext, SESSION_KEY } from "./test-utils";

describe("server API", () => {
  describe("getSession", () => {
    it("returns session when authenticated", async () => {
      const session = mockSession({ userId: "123" });

      await runWithSessionContext({ session }, () => {
        const result = getSession();
        expect(result).toBe(session);
        expect(result?.userId).toBe("123");
      });
    });

    it("returns null when not authenticated", async () => {
      await runWithSessionContext({ session: null }, () => {
        const result = getSession();
        expect(result).toBeNull();
      });
    });

    it("returns null outside session context", () => {
      const result = getSession();
      expect(result).toBeNull();
    });
  });

  describe("requireSession", () => {
    it("returns session when authenticated", async () => {
      const session = mockSession({ userId: "123" });

      await runWithSessionContext({ session }, () => {
        const result = requireSession();
        expect(result).toBe(session);
        expect(result.userId).toBe("123");
      });
    });

    it("throws Response when not authenticated", async () => {
      await runWithSessionContext({ session: null }, () => {
        expect(() => requireSession()).toThrow(Response);

        try {
          requireSession();
        } catch (error) {
          expect(error).toBeInstanceOf(Response);
          expect((error as Response).status).toBe(401);
        }
      });
    });

    it("throws Response outside session context", () => {
      expect(() => requireSession()).toThrow(Response);
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when session exists", async () => {
      const session = mockSession();

      await runWithSessionContext({ session }, () => {
        expect(isAuthenticated()).toBe(true);
      });
    });

    it("returns false when no session", async () => {
      await runWithSessionContext({ session: null }, () => {
        expect(isAuthenticated()).toBe(false);
      });
    });

    it("returns false outside session context", () => {
      expect(isAuthenticated()).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("returns true when user has the role", async () => {
      const session = mockSession({ role: "admin" });

      await runWithSessionContext({ session }, () => {
        expect(hasRole("admin")).toBe(true);
      });
    });

    it("returns false when user has different role", async () => {
      const session = mockSession({ role: "user" });

      await runWithSessionContext({ session }, () => {
        expect(hasRole("admin")).toBe(false);
      });
    });

    it("checks additional roles array", async () => {
      const session = mockSession({
        role: "user",
        roles: ["moderator", "beta"],
      });

      await runWithSessionContext({ session }, () => {
        expect(hasRole("moderator")).toBe(true);
        expect(hasRole("beta")).toBe(true);
        expect(hasRole("admin")).toBe(false);
      });
    });

    it("returns false when not authenticated", async () => {
      await runWithSessionContext({ session: null }, () => {
        expect(hasRole("admin")).toBe(false);
      });
    });
  });

  describe("hasPermission", () => {
    it("returns true when user has the permission", async () => {
      const session = mockSession({
        permissions: ["posts:read", "posts:write"],
      });

      await runWithSessionContext({ session }, () => {
        expect(hasPermission("posts:read")).toBe(true);
        expect(hasPermission("posts:write")).toBe(true);
      });
    });

    it("returns false when user lacks the permission", async () => {
      const session = mockSession({
        permissions: ["posts:read"],
      });

      await runWithSessionContext({ session }, () => {
        expect(hasPermission("posts:write")).toBe(false);
      });
    });

    it("returns false when permissions array is undefined", async () => {
      const session = mockSession({ permissions: undefined });

      await runWithSessionContext({ session }, () => {
        expect(hasPermission("posts:read")).toBe(false);
      });
    });

    it("returns false when not authenticated", async () => {
      await runWithSessionContext({ session: null }, () => {
        expect(hasPermission("posts:read")).toBe(false);
      });
    });
  });

  describe("hasAllPermissions", () => {
    it("returns true when user has all permissions", async () => {
      const session = mockSession({
        permissions: ["posts:read", "posts:write", "posts:delete"],
      });

      await runWithSessionContext({ session }, () => {
        expect(hasAllPermissions("posts:read", "posts:write")).toBe(true);
        expect(hasAllPermissions("posts:read", "posts:write", "posts:delete")).toBe(true);
      });
    });

    it("returns false when user lacks any permission", async () => {
      const session = mockSession({
        permissions: ["posts:read", "posts:write"],
      });

      await runWithSessionContext({ session }, () => {
        expect(hasAllPermissions("posts:read", "posts:delete")).toBe(false);
      });
    });

    it("returns true when checking zero permissions", async () => {
      const session = mockSession({ permissions: [] });

      await runWithSessionContext({ session }, () => {
        expect(hasAllPermissions()).toBe(true);
      });
    });

    it("returns false when not authenticated", async () => {
      await runWithSessionContext({ session: null }, () => {
        expect(hasAllPermissions("posts:read")).toBe(false);
      });
    });
  });

  describe("hasAnyPermission", () => {
    it("returns true when user has at least one permission", async () => {
      const session = mockSession({
        permissions: ["posts:read"],
      });

      await runWithSessionContext({ session }, () => {
        expect(hasAnyPermission("posts:read", "posts:write")).toBe(true);
        expect(hasAnyPermission("posts:write", "posts:read")).toBe(true);
      });
    });

    it("returns false when user has none of the permissions", async () => {
      const session = mockSession({
        permissions: ["posts:read"],
      });

      await runWithSessionContext({ session }, () => {
        expect(hasAnyPermission("posts:write", "posts:delete")).toBe(false);
      });
    });

    it("returns false when checking zero permissions", async () => {
      const session = mockSession({ permissions: ["posts:read"] });

      await runWithSessionContext({ session }, () => {
        expect(hasAnyPermission()).toBe(false);
      });
    });

    it("returns false when not authenticated", async () => {
      await runWithSessionContext({ session: null }, () => {
        expect(hasAnyPermission("posts:read", "posts:write")).toBe(false);
      });
    });
  });

  describe("edge cases", () => {
    it("handles session with custom fields", async () => {
      const session = mockSession({
        customField: "value",
        nested: { data: "test" },
      });

      await runWithSessionContext({ session }, () => {
        const result = getSession();
        expect(result?.customField).toBe("value");
        expect(result?.nested).toEqual({ data: "test" });
      });
    });

    it("handles empty permissions array", async () => {
      const session = mockSession({ permissions: [] });

      await runWithSessionContext({ session }, () => {
        expect(hasPermission("any")).toBe(false);
        expect(hasAllPermissions()).toBe(true);
        expect(hasAnyPermission("any")).toBe(false);
      });
    });

    it("handles empty roles array", async () => {
      const session = mockSession({ role: undefined, roles: [] });

      await runWithSessionContext({ session }, () => {
        expect(hasRole("admin")).toBe(false);
      });
    });
  });
});

describe("session management", () => {
  describe("setSession", () => {
    it("sets valid session in context.session", () => {
      const context = mockContext();
      const session = mockSession({ userId: "123", role: "admin" });

      setSession(context as any, session);

      // Verify session was stored
      expect(context.session.set).toHaveBeenCalledWith(SESSION_KEY, session);
      expect(context.session._store.get(SESSION_KEY)).toEqual(session);
    });

    it("throws error for invalid session structure", () => {
      const context = mockContext();
      const invalidSession = { email: "test@example.com" }; // Missing userId

      expect(() => setSession(context as any, invalidSession as any)).toThrow(
          /Invalid session structure/
      );
    });

    it("throws error for session with empty userId", () => {
      const context = mockContext();
      const invalidSession = { userId: "" };

      expect(() => setSession(context as any, invalidSession as any)).toThrow(
          /Invalid session structure/
      );
    });

    it("accepts session with minimal valid data", () => {
      const context = mockContext();
      const session = { userId: "123" };

      expect(() => setSession(context as any, session)).not.toThrow();
      expect(context.session._store.get(SESSION_KEY)).toEqual(session);
    });

    it("accepts session with all optional fields", () => {
      const context = mockContext();
      const session = mockSession({
        userId: "123",
        email: "user@example.com",
        role: "admin",
        roles: ["admin", "user"],
        permissions: ["read", "write"],
        customField: "value",
      });

      expect(() => setSession(context as any, session)).not.toThrow();
      expect(context.session._store.get(SESSION_KEY)).toEqual(session);
    });

    it("handles missing context.session gracefully", () => {
      const context = mockContext();
      delete (context as any).session;
      const session = mockSession();

      // Should not throw, just do nothing
      expect(() => setSession(context as any, session)).not.toThrow();
    });
  });

  describe("clearSession", () => {
    it("clears session from context.session", () => {
      const session = mockSession();
      const context = mockContext({ session });

      clearSession(context as any);

      // Verify delete was called
      expect(context.session.delete).toHaveBeenCalledWith(SESSION_KEY);
      expect(context.session._store.has(SESSION_KEY)).toBe(false);
    });

    it("works when no session exists", () => {
      const context = mockContext({ session: null });

      expect(() => clearSession(context as any)).not.toThrow();
      expect(context.session.delete).toHaveBeenCalledWith(SESSION_KEY);
    });

    it("handles missing context.session gracefully", () => {
      const context = mockContext();
      delete (context as any).session;

      expect(() => clearSession(context as any)).not.toThrow();
    });
  });

  describe("updateSession", () => {
    it("updates session fields", () => {
      const session = mockSession({ userId: "123", role: "user" });
      const context = mockContext({ session });

      updateSession(context as any, { role: "admin" });

      // Verify the updated session was set
      const updatedSession = context.session._store.get(SESSION_KEY);
      expect(updatedSession).toEqual({
        ...session,
        role: "admin",
      });
      expect(context.session.set).toHaveBeenCalledWith(SESSION_KEY, expect.objectContaining({
        role: "admin"
      }));
    });

    it("updates multiple fields", () => {
      const session = mockSession({
        userId: "123",
        role: "user",
        permissions: ["read"]
      });
      const context = mockContext({ session });

      updateSession(context as any, {
        role: "admin",
        permissions: ["read", "write", "delete"],
      });

      const updatedSession = context.session._store.get(SESSION_KEY);
      expect(updatedSession).toMatchObject({
        userId: "123",
        role: "admin",
        permissions: ["read", "write", "delete"],
      });
    });

    it("throws error when no session exists", () => {
      const context = mockContext({ session: null });

      expect(() => updateSession(context as any, { role: "admin" })).toThrow(
          /Cannot update session: no session exists/
      );
    });

    it("throws error if updated session is invalid", () => {
      const session = mockSession({ userId: "123" });
      const context = mockContext({ session });

      // Try to set userId to empty string
      expect(() =>
          updateSession(context as any, { userId: "" } as any)
      ).toThrow(/Invalid session structure/);
    });

    it("preserves existing fields when updating", () => {
      const session = mockSession({
        userId: "123",
        email: "user@example.com",
        role: "user",
        customField: "value",
      });
      const context = mockContext({ session });

      updateSession(context as any, { role: "admin" });

      const updatedSession = context.session._store.get(SESSION_KEY);
      expect(updatedSession).toMatchObject({
        userId: "123",
        email: "user@example.com",
        role: "admin",
        customField: "value",
      });
    });

    it("allows adding custom fields", () => {
      const session = mockSession({ userId: "123" });
      const context = mockContext({ session });

      updateSession(context as any, {
        customField: "new value",
        nested: { data: "test" }
      } as any);

      const updatedSession = context.session._store.get(SESSION_KEY);
      expect(updatedSession).toMatchObject({
        userId: "123",
        customField: "new value",
        nested: { data: "test" },
      });
    });

    it("handles missing context.session gracefully", () => {
      const context = mockContext();
      delete (context as any).session;

      expect(() => updateSession(context as any, { role: "admin" })).toThrow(
          /Cannot update session: no session exists/
      );
    });
  });
});
import { describe, it, expect, vi } from "vitest";
import { getSession, updateSession, setSession, clearSession, regenerateSession } from "../src/server";
import { runWithContext } from "../src/core/context";
import { isValidSessionStructure } from "../src/core/validation";
import { mockContext, mockSession } from "./test-utils";

describe("Performance and Security Enhancements", () => {
  describe("Same-request consistency", () => {
    it("reflects updateSession changes in getSession immediately", async () => {
      const initialSession = mockSession({ userId: "user1", role: "user" });
      const context = mockContext({ session: initialSession });
      const store = { session: initialSession, astroContext: context as any };

      await runWithContext(store, () => {
        // Initial state
        expect(getSession()?.role).toBe("user");

        // Update session
        updateSession({ role: "admin" });

        // Should be reflected immediately in getSession() without another middleware run
        expect(getSession()?.role).toBe("admin");
        
        // Should also be set in Astro session
        expect(context.session.set).toHaveBeenCalledWith("__session__", expect.objectContaining({ role: "admin" }));
      });
    });

    it("reflects setSession changes in getSession immediately", async () => {
      const context = mockContext({ session: null });
      const store = { session: null as any, astroContext: context as any };

      await runWithContext(store, () => {
        const newSession = mockSession({ userId: "user2" });
        setSession(newSession);

        expect(getSession()?.userId).toBe("user2");
        expect(store.session).toEqual(newSession);
      });
    });

    it("reflects clearSession changes in getSession immediately", async () => {
      const initialSession = mockSession({ userId: "user1" });
      const context = mockContext({ session: initialSession });
      const store = { session: initialSession, astroContext: context as any };

      await runWithContext(store, () => {
        clearSession();

        expect(getSession()).toBeNull();
        expect(store.session).toBeNull();
        expect(context.session.delete).toHaveBeenCalledWith("__session__");
      });
    });
  });

  describe("Session Fixation Protection", () => {
    it("calls regenerate if available on context.session", async () => {
      const context = mockContext();
      context.session.regenerate = vi.fn();
      const store = { session: null as any, astroContext: context as any };

      await runWithContext(store, () => {
        regenerateSession();
        expect(context.session.regenerate).toHaveBeenCalled();
      });
    });

    it("does not throw if regenerate is missing", async () => {
      const context = mockContext();
      // context.session.regenerate is undefined by default in mockContext
      const store = { session: null as any, astroContext: context as any };

      await runWithContext(store, () => {
        expect(() => regenerateSession()).not.toThrow();
      });
    });
  });

  describe("Enhanced Validation", () => {
    it("rejects userId with control characters", () => {
      expect(isValidSessionStructure({ userId: "user\0name" })).toBe(false);
      expect(isValidSessionStructure({ userId: "user\nname" })).toBe(false);
      expect(isValidSessionStructure({ userId: "user\rname" })).toBe(false);
    });

    it("rejects role with control characters", () => {
      expect(isValidSessionStructure({ userId: "123", role: "admin\x07" })).toBe(false);
    });

    it("rejects invalid email formats (basic sanity)", () => {
      expect(isValidSessionStructure({ userId: "123", email: "not-an-email" })).toBe(false);
      expect(isValidSessionStructure({ userId: "123", email: "test@domain.com" })).toBe(true);
      expect(isValidSessionStructure({ userId: "123", email: "" })).toBe(true); // Empty allowed if present but empty? Actually check implementation.
    });

    it("handles null email/role gracefully", () => {
      expect(isValidSessionStructure({ userId: "123", email: null, role: null })).toBe(true);
    });
  });
});

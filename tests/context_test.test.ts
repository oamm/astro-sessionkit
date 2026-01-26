// ============================================================================
// Context Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import { runWithContext, getContextStore } from "../src/core/context";
import { mockSession } from "./test-utils";

describe("context", () => {
  it("stores and retrieves session context within execution scope", async () => {
    const session = mockSession({ userId: "123", role: "admin" });

    await runWithContext({ session }, async () => {
      const context = getContextStore();
      
      expect(context).toBeDefined();
      expect(context?.session).toBe(session);
      expect(context?.session?.userId).toBe("123");
      expect(context?.session?.role).toBe("admin");
    });
  });

  it("handles null session", async () => {
    await runWithContext({ session: null }, async () => {
      const context = getContextStore();
      
      expect(context).toBeDefined();
      expect(context?.session).toBeNull();
    });
  });

  it("returns undefined outside execution scope", () => {
    const context = getContextStore();
    expect(context).toBeUndefined();
  });

  it("isolates context between different executions", async () => {
    const session1 = mockSession({ userId: "user-1" });
    const session2 = mockSession({ userId: "user-2" });

    // First execution
    await runWithContext({ session: session1 }, async () => {
      const context = getContextStore();
      expect(context?.session?.userId).toBe("user-1");
    });

    // Second execution
    await runWithContext({ session: session2 }, async () => {
      const context = getContextStore();
      expect(context?.session?.userId).toBe("user-2");
    });

    // Outside both executions
    expect(getContextStore()).toBeUndefined();
  });

  it("preserves context through nested async operations", async () => {
    const session = mockSession({ userId: "nested-test" });

    await runWithContext({ session }, async () => {
      // Immediate check
      expect(getContextStore()?.session?.userId).toBe("nested-test");

      // After async operation
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(getContextStore()?.session?.userId).toBe("nested-test");

      // Nested function
      const checkInNestedFunction = () => {
        expect(getContextStore()?.session?.userId).toBe("nested-test");
      };
      checkInNestedFunction();
    });
  });

  it("returns the result from the execution function", async () => {
    const session = mockSession();

    const result = await runWithContext({ session }, () => {
      return "test-result";
    });

    expect(result).toBe("test-result");
  });
});

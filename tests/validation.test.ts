// ============================================================================
// Validation Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import {
  isValidSessionStructure,
  isValidPattern,
  isValidRedirectPath,
} from "../src/core/validation";

describe("validation", () => {
  describe("isValidSessionStructure", () => {
    it("accepts valid session", () => {
      const session = {
        userId: "123",
        email: "user@example.com",
        role: "admin",
        permissions: ["read", "write"],
      };

      expect(isValidSessionStructure(session)).toBe(true);
    });

    it("accepts minimal valid session", () => {
      const session = { userId: "123" };
      expect(isValidSessionStructure(session)).toBe(true);
    });

    it("accepts session with custom fields", () => {
      const session = {
        userId: "123",
        customField: "value",
        nested: { data: "test" },
      };

      expect(isValidSessionStructure(session)).toBe(true);
    });

    it("rejects null", () => {
      expect(isValidSessionStructure(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(isValidSessionStructure(undefined)).toBe(false);
    });

    it("rejects non-object", () => {
      expect(isValidSessionStructure("string")).toBe(false);
      expect(isValidSessionStructure(123)).toBe(false);
      expect(isValidSessionStructure(true)).toBe(false);
    });

    it("rejects session without userId", () => {
      const session = { email: "user@example.com" };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with non-string userId", () => {
      expect(isValidSessionStructure({ userId: 123 })).toBe(false);
      expect(isValidSessionStructure({ userId: null })).toBe(false);
      expect(isValidSessionStructure({ userId: {} })).toBe(false);
    });

    it("rejects session with empty userId", () => {
      expect(isValidSessionStructure({ userId: "" })).toBe(false);
      expect(isValidSessionStructure({ userId: "   " })).toBe(false);
    });

    it("rejects session with too long userId (DoS protection)", () => {
      const session = { userId: "a".repeat(256) };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("accepts session with userId at limit", () => {
      const session = { userId: "a".repeat(255) };
      expect(isValidSessionStructure(session)).toBe(true);
    });

    it("rejects session with invalid email type", () => {
      const session = { userId: "123", email: 123 };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with too long email", () => {
      const session = { userId: "123", email: "a".repeat(321) };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with invalid role type", () => {
      const session = { userId: "123", role: 123 };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with too long role", () => {
      const session = { userId: "123", role: "a".repeat(101) };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with non-array roles", () => {
      const session = { userId: "123", roles: "admin" };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with too many roles (DoS protection)", () => {
      const session = { userId: "123", roles: Array(101).fill("role") };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("accepts session with roles at limit", () => {
      const session = { userId: "123", roles: Array(100).fill("role") };
      expect(isValidSessionStructure(session)).toBe(true);
    });

    it("rejects session with invalid role items", () => {
      const session = { userId: "123", roles: ["admin", 123, "user"] };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with too long role items", () => {
      const session = { userId: "123", roles: ["a".repeat(101)] };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with non-array permissions", () => {
      const session = { userId: "123", permissions: "read" };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with too many permissions (DoS protection)", () => {
      const session = { userId: "123", permissions: Array(501).fill("perm") };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("accepts session with permissions at limit", () => {
      const session = { userId: "123", permissions: Array(500).fill("perm") };
      expect(isValidSessionStructure(session)).toBe(true);
    });

    it("rejects session with invalid permission items", () => {
      const session = { userId: "123", permissions: ["read", 123] };
      expect(isValidSessionStructure(session)).toBe(false);
    });

    it("rejects session with too long permission items", () => {
      const session = { userId: "123", permissions: ["a".repeat(201)] };
      expect(isValidSessionStructure(session)).toBe(false);
    });
  });

  describe("isValidPattern", () => {
    it("accepts valid patterns", () => {
      expect(isValidPattern("/admin")).toBe(true);
      expect(isValidPattern("/admin/*")).toBe(true);
      expect(isValidPattern("/admin/**")).toBe(true);
      expect(isValidPattern("/api/*/users")).toBe(true);
      expect(isValidPattern("/path/to/resource")).toBe(true);
    });

    it("rejects non-string patterns", () => {
      expect(isValidPattern(123 as any)).toBe(false);
      expect(isValidPattern(null as any)).toBe(false);
      expect(isValidPattern(undefined as any)).toBe(false);
    });

    it("rejects patterns not starting with /", () => {
      expect(isValidPattern("admin")).toBe(false);
      expect(isValidPattern("admin/*")).toBe(false);
      expect(isValidPattern("")).toBe(false);
    });

    it("rejects patterns that are too long (DoS protection)", () => {
      const pattern = "/" + "a".repeat(1000);
      expect(isValidPattern(pattern)).toBe(false);
    });

    it("accepts patterns at length limit", () => {
      const pattern = "/" + "a".repeat(999);
      expect(isValidPattern(pattern)).toBe(true);
    });

    it("rejects patterns with excessive consecutive wildcards (ReDoS protection)", () => {
      // 4 or more consecutive asterisks
      expect(isValidPattern("/****")).toBe(false);
      expect(isValidPattern("/" + "*".repeat(10))).toBe(false);
      expect(isValidPattern("/" + "*".repeat(20))).toBe(false);
    });

    it("accepts reasonable wildcards", () => {
      expect(isValidPattern("/*")).toBe(true);
      expect(isValidPattern("/**")).toBe(true);
      expect(isValidPattern("/***")).toBe(true); // 3 asterisks is okay
      expect(isValidPattern("/*/*/*")).toBe(true);
      expect(isValidPattern("/a/*/b/*/c")).toBe(true);
    });

    it("rejects patterns with excessive wildcard groups", () => {
      // More than 20 wildcard groups
      const pattern = "/" + "a*".repeat(21);
      expect(isValidPattern(pattern)).toBe(false);
    });

    it("accepts reasonable wildcard groups", () => {
      const pattern = "/" + "a*/".repeat(10);
      expect(isValidPattern(pattern)).toBe(true);
    });
  });

  describe("isValidRedirectPath", () => {
    it("accepts valid redirect paths", () => {
      expect(isValidRedirectPath("/login")).toBe(true);
      expect(isValidRedirectPath("/auth/login")).toBe(true);
      expect(isValidRedirectPath("/unauthorized")).toBe(true);
    });

    it("rejects non-string paths", () => {
      expect(isValidRedirectPath(123 as any)).toBe(false);
      expect(isValidRedirectPath(null as any)).toBe(false);
      expect(isValidRedirectPath(undefined as any)).toBe(false);
    });

    it("rejects paths not starting with /", () => {
      expect(isValidRedirectPath("login")).toBe(false);
      expect(isValidRedirectPath("auth/login")).toBe(false);
      expect(isValidRedirectPath("")).toBe(false);
    });

    it("rejects absolute URLs (open redirect protection)", () => {
      expect(isValidRedirectPath("http://example.com")).toBe(false);
      expect(isValidRedirectPath("https://example.com/login")).toBe(false);
      expect(isValidRedirectPath("//example.com")).toBe(false);
    });

    it("rejects paths that are too long", () => {
      const path = "/" + "a".repeat(500);
      expect(isValidRedirectPath(path)).toBe(false);
    });

    it("accepts paths at length limit", () => {
      const path = "/" + "a".repeat(499);
      expect(isValidRedirectPath(path)).toBe(true);
    });
  });
});
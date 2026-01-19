// ============================================================================
// Matcher Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import { matchesPattern } from "../src/core/matcher";

describe("matcher", () => {
  describe("exact paths", () => {
    it("matches exact paths", () => {
      expect(matchesPattern("/dashboard", "/dashboard")).toBe(true);
      expect(matchesPattern("/admin", "/admin")).toBe(true);
      expect(matchesPattern("/", "/")).toBe(true);
    });

    it("does not match different paths", () => {
      expect(matchesPattern("/dashboard", "/admin")).toBe(false);
      expect(matchesPattern("/users", "/user")).toBe(false);
    });
  });

  describe("single wildcard (*)", () => {
    it("matches one or more segments", () => {
      expect(matchesPattern("/users/*", "/users/123")).toBe(true);
      expect(matchesPattern("/users/*", "/users/123/profile")).toBe(true);
    });

    it("matches nested paths with wildcard in middle", () => {
      expect(matchesPattern("/api/*/item", "/api/v1/item")).toBe(true);
      expect(matchesPattern("/api/*/item", "/api/v1/v2/item")).toBe(true);
    });

    it("requires at least one segment for wildcard", () => {
      expect(matchesPattern("/users/*", "/users")).toBe(false);
      expect(matchesPattern("/users/*", "/users/")).toBe(false);
      expect(matchesPattern("/api/*/item", "/api/item")).toBe(false);
    });

    it("does not match different base paths", () => {
      expect(matchesPattern("/admin/*", "/user/123")).toBe(false);
      expect(matchesPattern("/posts/*", "/comments/456")).toBe(false);
    });
  });

  describe("double wildcard (**)", () => {
    it("matches any depth including zero segments", () => {
      expect(matchesPattern("/admin/**", "/admin")).toBe(true);
      expect(matchesPattern("/admin/**", "/admin/users")).toBe(true);
      expect(matchesPattern("/admin/**", "/admin/users/123")).toBe(true);
      expect(matchesPattern("/admin/**", "/admin/a/b/c/d")).toBe(true);
    });

    it("does not match different base paths", () => {
      expect(matchesPattern("/admin/**", "/users")).toBe(false);
      expect(matchesPattern("/admin/**", "/public/admin")).toBe(false);
    });
  });

  describe("complex patterns", () => {
    it("handles multiple wildcards", () => {
      expect(matchesPattern("/*/admin/*", "/app/admin/settings")).toBe(true);
      expect(matchesPattern("/*/admin/*", "/my/admin/users/123")).toBe(true);
    });

    it("handles special characters", () => {
      expect(matchesPattern("/api/v1.0/users", "/api/v1.0/users")).toBe(true);
      expect(matchesPattern("/path+with+plus", "/path+with+plus")).toBe(true);
    });

    it("is case sensitive", () => {
      expect(matchesPattern("/Admin", "/admin")).toBe(false);
      expect(matchesPattern("/admin", "/Admin")).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles trailing slashes correctly", () => {
      expect(matchesPattern("/dashboard", "/dashboard/")).toBe(false);
      expect(matchesPattern("/dashboard/", "/dashboard")).toBe(false);
    });

    it("handles empty patterns", () => {
      expect(matchesPattern("", "")).toBe(true);
      expect(matchesPattern("", "/anything")).toBe(false);
    });

    it("handles root path", () => {
      expect(matchesPattern("/", "/")).toBe(true);
      expect(matchesPattern("/", "/anything")).toBe(false);
    });
  });
});
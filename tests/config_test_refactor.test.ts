// ============================================================================
// Config Tests
// ============================================================================

import { describe, it, expect, beforeEach } from "vitest";
import { getConfig, setConfig } from "../src/core/config";

describe("config", () => {
  beforeEach(() => {
    // Reset to defaults before each test
    setConfig({});
  });

  describe("validation", () => {
    it("throws error for invalid loginPath", () => {
      expect(() => setConfig({ loginPath: "login" })).toThrow(
        /Invalid loginPath/
      );
    });

    it("throws error for invalid pattern", () => {
      expect(() =>
        setConfig({
          protect: [{ pattern: "admin/**", role: "admin" }],
        })
      ).toThrow(/Invalid pattern/);
    });

    it("throws error for pattern that's too long", () => {
      const longPattern = "/" + "a".repeat(1000);
      expect(() =>
        setConfig({
          protect: [{ pattern: longPattern, role: "admin" }],
        })
      ).toThrow(/Invalid pattern/);
    });

    it("throws error for invalid redirectTo", () => {
      expect(() =>
        setConfig({
          protect: [
            {
              pattern: "/admin/**",
              role: "admin",
              redirectTo: "unauthorized",
            },
          ],
        })
      ).toThrow(/Invalid redirectTo/);
    });

    it("accepts valid configuration", () => {
      expect(() =>
        setConfig({
          loginPath: "/login",
          protect: [
            { pattern: "/admin/**", role: "admin", redirectTo: "/unauthorized" },
          ],
        })
      ).not.toThrow();
    });
  });

  it("merges provided config with defaults", () => {
    setConfig({
      loginPath: "/auth",
      protect: [
        {
          pattern: "/secret/*",
          allow: () => true,
        },
      ],
    });

    const cfg = getConfig();

    expect(cfg.loginPath).toBe("/auth");
    expect(cfg.protect).toHaveLength(1);
    expect(cfg.protect[0].pattern).toBe("/secret/*");
    // @ts-ignore
    expect(typeof cfg.protect[0].allow).toBe("function");
  });

  it("falls back to defaults when config is empty", () => {
    setConfig({});
    
    const cfg = getConfig();
    
    expect(cfg.loginPath).toBe("/login");
    expect(cfg.protect).toEqual([]);
  });

  it("applies custom access hooks", () => {
    const customGetRole = (session: any) => session?.customRole ?? null;
    const customGetPermissions = (session: any) => session?.customPerms ?? [];

    setConfig({
      access: {
        getRole: customGetRole,
        getPermissions: customGetPermissions,
      },
    });

    const cfg = getConfig();

    expect(cfg.access.getRole).toBe(customGetRole);
    expect(cfg.access.getPermissions).toBe(customGetPermissions);
  });

  it("preserves default access extractors when not overridden", () => {
    setConfig({
      loginPath: "/custom-login",
    });

    const cfg = getConfig();

    // Default getRole
    expect(cfg.access.getRole({ role: "admin" } as any)).toBe("admin");
    expect(cfg.access.getRole(null)).toBe(null);

    // Default getPermissions
    expect(cfg.access.getPermissions({ permissions: ["read"] } as any)).toEqual(["read"]);
    expect(cfg.access.getPermissions(null)).toEqual([]);
  });

  it("handles multiple protection rules", () => {
    setConfig({
      protect: [
        { pattern: "/admin/**", role: "admin" },
        { pattern: "/dashboard", roles: ["user", "admin"] },
        { pattern: "/settings", permission: "settings:write" },
      ],
    });

    const cfg = getConfig();

    expect(cfg.protect).toHaveLength(3);
    expect(cfg.protect[0]).toMatchObject({ pattern: "/admin/**", role: "admin" });
    expect(cfg.protect[1]).toMatchObject({ pattern: "/dashboard", roles: ["user", "admin"] });
    expect(cfg.protect[2]).toMatchObject({ pattern: "/settings", permission: "settings:write" });
  });
});

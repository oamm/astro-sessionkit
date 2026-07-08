// ============================================================================
// Astro Integration Tests
// ============================================================================

import { describe, expect, it } from "vitest";
import sessionKit from "../src/integration";

describe("sessionKit integration", () => {
  it("registers session and guard middleware in the pre phase during dev", () => {
    const integration = sessionKit({
      globalProtect: true,
      loginPath: "/login",
    });
    const middleware: Array<{ entrypoint: string; order: string }> = [];

    integration.hooks["astro:config:setup"]({
      addMiddleware: (config: { entrypoint: string; order: string }) => {
        middleware.push(config);
      },
      command: "dev",
      createCodegenDir: () => {
        throw new Error("createCodegenDir should not be called during dev");
      },
    } as any);

    expect(middleware).toEqual([
      { entrypoint: "astro-sessionkit/middleware", order: "pre" },
      { entrypoint: "astro-sessionkit/guard", order: "pre" },
    ]);
  });
});

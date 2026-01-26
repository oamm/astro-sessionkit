// ============================================================================
// Session Context Configuration Tests
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { sessionMiddleware } from "../src/core/sessionMiddleware";
import { setConfig } from "../src/core/config";
import { mockContext, mockNext, mockSession } from "./test-utils";
import * as contextModule from "../src/core/context";

describe("sessionMiddleware with custom runWithContext", () => {
  it("uses the built-in runWithContext by default", async () => {
    // Reset config to defaults
    setConfig({});
    
    const spy = vi.spyOn(contextModule, "runWithContext");
    const session = mockSession();
    const context = mockContext({ session });
    const next = mockNext();

    await sessionMiddleware(context as any, next as any);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("uses the custom runWithContext from config if provided", async () => {
    const customRunner = vi.fn((_:any, fn:any) => fn());
    
    setConfig({
      runWithContext: customRunner
    });

    const session = mockSession();
    const context = mockContext({ session });
    const next = mockNext();

    await sessionMiddleware(context as any, next as any);

    expect(customRunner).toHaveBeenCalledWith(
      expect.objectContaining({ session }),
      expect.any(Function)
    );
    
    // Reset config
    setConfig({});
  });
});

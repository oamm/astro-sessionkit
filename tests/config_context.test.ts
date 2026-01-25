// ============================================================================
// Session Context Configuration Tests
// ============================================================================

import { describe, it, expect, vi } from "vitest";
import { sessionMiddleware } from "../src/core/sessionMiddleware";
import { setConfig } from "../src/core/config";
import { mockContext, mockNext, mockSession } from "./test-utils";
import * as contextModule from "../src/core/context";

describe("sessionMiddleware with custom runWithSessionContext", () => {
  it("uses the built-in runWithSessionContext by default", async () => {
    // Reset config to defaults
    setConfig({});
    
    const spy = vi.spyOn(contextModule, "runWithSessionContext");
    const session = mockSession();
    const context = mockContext({ session });
    const next = mockNext();

    await sessionMiddleware(context as any, next as any);

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("uses the custom runWithSessionContext from config if provided", async () => {
    const customRunner = vi.fn((_:any, fn:any) => fn());
    
    setConfig({
      runWithSessionContext: customRunner
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

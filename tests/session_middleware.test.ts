// ============================================================================
// Session Middleware Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import { sessionMiddleware } from "../src/core/sessionMiddleware";
import { getContextStore } from "../src/core/context";
import { mockContext, mockSession, mockNext, SESSION_KEY } from "./test-utils";

describe("sessionMiddleware", () => {
  it("sets session context from context.session.get('__session__')", async () => {
    const session = mockSession({ userId: "123", email: "test@example.com" });
    const ctx = mockContext({ session });

    const next = mockNext();
    next.mockImplementation(() => {
      // Check context inside ALS scope
      const context = getContextStore();
      expect(context).toBeDefined();
      expect(context?.session).toEqual(session);
      expect(context?.session?.userId).toBe("123");

      return new Response("ok");
    });

    await sessionMiddleware(ctx as any, next as any);

    expect(next).toHaveBeenCalled();
    // Verify session was read from the store
    expect(ctx.session.get).toHaveBeenCalledWith(SESSION_KEY);
  });

  it("handles null session (unauthenticated user)", async () => {
    const ctx = mockContext({ session: null });

    const next = mockNext();
    next.mockImplementation(() => {
      const context = getContextStore();
      expect(context).toBeDefined();
      expect(context?.session).toBeNull();

      return new Response("ok");
    });

    await sessionMiddleware(ctx as any, next as any);

    expect(next).toHaveBeenCalled();
  });

  it("validates session structure and rejects invalid sessions", async () => {
    // Invalid session - missing userId
    const invalidSession = { email: "test@example.com" };

    // Manually seed the store with invalid data
    const ctx = mockContext();
    ctx.session._store.set(SESSION_KEY, invalidSession);

    const next = mockNext();
    next.mockImplementation(() => {
      const context = getContextStore();
      expect(context).toBeDefined();
      expect(context?.session).toBeNull(); // Invalid session treated as null

      return new Response("ok");
    });

    await sessionMiddleware(ctx as any, next as any);

    expect(next).toHaveBeenCalled();
  });

  it("rejects session with malformed data (DoS protection)", async () => {
    const malformedSession = {
      userId: "123",
      permissions: Array(1000).fill("perm"), // Too many permissions
    };

    const ctx = mockContext();
    ctx.session._store.set(SESSION_KEY, malformedSession);

    const next = mockNext();
    next.mockImplementation(() => {
      const context = getContextStore();
      expect(context?.session).toBeNull(); // Malformed session rejected

      return new Response("ok");
    });

    await sessionMiddleware(ctx as any, next as any);
  });

  it("context is not available outside middleware execution", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });
    const next = mockNext();

    // Before middleware
    expect(getContextStore()).toBeUndefined();

    await sessionMiddleware(ctx as any, next as any);

    // After middleware completes
    expect(getContextStore()).toBeUndefined();
  });

  it("passes through response from next()", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });

    const expectedResponse = new Response("custom response", { status: 201 });
    const next = mockNext(expectedResponse);

    const response = await sessionMiddleware(ctx as any, next as any) as Response;

    expect(response).toBe(expectedResponse);
    expect(response.status).toBe(201);
  });

  it("processes multiple sessions independently", async () => {
    const session1 = mockSession({ userId: "user-1" });
    const session2 = mockSession({ userId: "user-2" });

    // First request
    const ctx1 = mockContext({ session: session1 });
    const next1 = mockNext();
    next1.mockImplementation(() => {
      expect(getContextStore()?.session?.userId).toBe("user-1");
      return new Response("ok");
    });

    await sessionMiddleware(ctx1 as any, next1 as any);

    // Second request (different session)
    const ctx2 = mockContext({ session: session2 });
    const next2 = mockNext();
    next2.mockImplementation(() => {
      expect(getContextStore()?.session?.userId).toBe("user-2");
      return new Response("ok");
    });

    await sessionMiddleware(ctx2 as any, next2 as any);
  });

  it("handles session with custom fields", async () => {
    const session = mockSession({
      userId: "123",
      customField: "custom-value",
      nested: { data: "test" },
    });

    const ctx = mockContext({ session });
    const next = mockNext();

    next.mockImplementation(() => {
      const context = getContextStore();
      expect(context?.session?.customField).toBe("custom-value");
      expect(context?.session?.nested).toEqual({ data: "test" });
      return new Response("ok");
    });

    await sessionMiddleware(ctx as any, next as any);
  });

  it("handles missing context.session gracefully", async () => {
    const ctx = mockContext();
    // Remove session store
    delete (ctx as any).session;

    const next = mockNext();
    next.mockImplementation(() => {
      const context = getContextStore();
      expect(context?.session).toBeNull();
      return new Response("ok");
    });

    await sessionMiddleware(ctx as any, next as any);
  });
});
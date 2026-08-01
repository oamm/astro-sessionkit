// ============================================================================
// Session Middleware Tests
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sessionMiddleware } from "../src/core/sessionMiddleware";
import { getContextStore } from "../src/core/context";
import { resetConfig, setConfig } from "../src/core/config";
import { mockContext, mockSession, mockNext, SESSION_KEY } from "./test-utils";

describe("sessionMiddleware", () => {
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    resetConfig();
  });

  afterEach(() => {
    consoleLogSpy.mockClear();
  });

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

  it("does not touch session by default", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  it("touches valid session when enabled", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });

    setConfig({ touchOnRequest: true });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session.set).toHaveBeenCalledWith(SESSION_KEY, session);
  });

  it("passes configured ttl when touching valid session", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });

    setConfig({ touchOnRequest: true, sessionTtl: 3600 });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session.set).toHaveBeenCalledWith(SESSION_KEY, session, { ttl: 3600 });
  });

  it("touches valid session using custom key when configured", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });

    setConfig({ touchOnRequest: true, touchSessionKey: "custom-session" });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session.set).toHaveBeenCalledWith("custom-session", session);
  });

  it("does not touch when session.set is unavailable", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });
    delete (ctx.session as any).set;

    setConfig({ touchOnRequest: true });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session._store.get(SESSION_KEY)).toEqual(session);
  });

  it("does not touch invalid session", async () => {
    const invalidSession = { email: "test@example.com" };
    const ctx = mockContext();
    ctx.session._store.set(SESSION_KEY, invalidSession);

    setConfig({ touchOnRequest: true });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session.set).not.toHaveBeenCalled();
  });

  it("deletes invalid stored session and sets request context session to null", async () => {
    const invalidSession = {};
    const ctx = mockContext();
    ctx.session._store.set(SESSION_KEY, invalidSession);

    const next = mockNext();
    next.mockImplementation(() => {
      expect(getContextStore()?.session).toBeNull();
      return new Response("ok");
    });

    await sessionMiddleware(ctx as any, next as any);

    expect(ctx.session.delete).toHaveBeenCalledWith(SESSION_KEY);
    expect(ctx.session._store.has(SESSION_KEY)).toBe(false);
  });

  it("destroys backing session when supported for invalid stored session", async () => {
    const ctx = mockContext();
    ctx.session._store.set(SESSION_KEY, { roles: "admin" });
    (ctx.session as any).destroy = vi.fn();

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect((ctx.session as any).destroy).toHaveBeenCalled();
  });

  it("preserves valid stored session", async () => {
    const session = mockSession();
    const ctx = mockContext({ session });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session.delete).not.toHaveBeenCalled();
    expect(ctx.session._store.get(SESSION_KEY)).toEqual(session);
  });

  it("does not touch when session is missing", async () => {
    const ctx = mockContext({ session: null });

    setConfig({ touchOnRequest: true });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(ctx.session.set).not.toHaveBeenCalled();
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

  it("logs detailed session evaluation when debug is enabled", async () => {
    const session = mockSession({ permissions: ["settings:read"] });
    const ctx = mockContext({ session });

    setConfig({ debug: true, touchOnRequest: true, sessionTtl: 3600 });

    await sessionMiddleware(ctx as any, mockNext() as any);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[SessionKit] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z] \[SessionMiddleware] Read session from Astro store$/),
      expect.objectContaining({
        key: SESSION_KEY,
        sessionStoreAvailable: true,
        rawSession: expect.objectContaining({
          keys: expect.arrayContaining(["userId", "email", "role", "roles", "permissions"]),
          permissionsCount: 1,
        }),
      })
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[SessionKit] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z] \[SessionMiddleware] Session validation result$/),
      expect.objectContaining({ valid: true })
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^\[SessionKit] \[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z] \[SessionMiddleware] Touched valid session$/),
      { key: SESSION_KEY, ttl: 3600 }
    );
  });
});

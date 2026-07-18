# Changelog

## 0.1.31 - 2026-07-18

- Adds `ttl` forwarding for `setSession()` and `updateSession()` so callers can pass Astro session expiration options.
- Adds `sessionTtl` configuration as the default TTL for SessionKit writes and `touchOnRequest` rewrites.
- Documents fixed-expiration versus sliding-expiration session behavior.
- Adds focused tests for per-call TTL, configured TTL, and TTL-aware request touching.

## 0.1.30 - 2026-07-15

- Treats only structurally valid session objects as authenticated in `getSession()`, `isAuthenticated()`, and middleware request context.
- Deletes invalid stored `__session__` values from Astro sessions and calls `destroy()` when the backing session API supports it.
- Adds targeted coverage for empty, malformed, invalid stored, and valid preserved session behavior.

## 0.1.29 - 2026-07-09

- Updates the package toolchain and runtime dependencies, including Astro 7.0.7, Vite 8.1.4, Vitest 4.1.10, `@types/node` 26.1.1, and Undici 8.7.0.

## 0.1.28 - 2026-07-09

- Adds opt-in `touchOnRequest` support so valid authenticated sessions can refresh Astro session store TTL on each request.
- Adds `touchSessionKey` to customize the Astro session key rewritten when request touching is enabled.
- Adds focused middleware tests for default behavior, valid session touching, invalid or missing sessions, custom touch keys, and missing `session.set`.
- Adds a test TypeScript config so tests can be typechecked without conflicting with the package build `rootDir`.

## 0.1.27 - 2026-07-08

- Restores SessionKit middleware registration to Astro's `pre` phase so the session context is initialized before application middleware.
- Updates middleware setup documentation to use `setSession(session, context)`, which updates the active SessionKit context during the same request.

## 0.1.26 - 2026-07-08

- Fixes Astro dev mode when SessionKit config contains custom context functions by avoiding generated runtime wrappers outside production builds.

## 0.1.25 - 2026-07-08

- Fixes production server builds by generating runtime middleware entrypoints that configure SessionKit inside Astro's bundled server runtime.
- Registers SessionKit middleware with `post` order so application middleware can populate `context.session` before SessionKit reads it.
- Adds the internal `astro-sessionkit/runtime` export used by generated middleware wrappers.
- Fixes the playground production preview by making the session cookie `secure` flag opt-in through `SESSION_COOKIE_SECURE=true`.
- Updates README and security examples to use the current `setSession(session, context?)` and `updateSession(updates, context?)` API order.

## 0.1.24 - 2026-06-28

- Adds Astro 7 to the supported peer dependency range.
- Pins the playground to Astro 7.0.3 so compatibility checks run against Astro 7 instead of a floating `latest`.
- Updates the package toolchain and runtime dependencies for the Astro 7 test matrix.
- Raises the Node.js engine requirement to `>=22.19.0` to match the upgraded Astro 7 and Undici dependency stack.

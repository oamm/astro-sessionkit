# Changelog

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

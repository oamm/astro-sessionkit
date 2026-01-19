// ============================================================================
// Guard Middleware Entry Point
// ============================================================================

import { createGuardMiddleware } from "./core/guardMiddleware";

export const onRequest = createGuardMiddleware();

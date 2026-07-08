// ============================================================================
// Runtime Configuration API
// ============================================================================

import { setConfig } from "./core/config";
import type { SessionKitConfig } from "./core/types";

/**
 * Configure SessionKit inside Astro's runtime middleware bundle.
 *
 * This is used by the integration-generated middleware wrappers so production
 * server builds do not depend on build-time process memory.
 */
export function configureSessionKit(config: SessionKitConfig): void {
  setConfig(config);
}

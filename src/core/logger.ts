import { getConfig } from "./config";

/**
 * Log message if debug mode is enabled
 */
export function debug(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug) {
    console.log(`[SessionKit] ${message}`, ...args);
  }
}

/**
 * Log error message. Always logs unless in production, but can be forced via debug flag.
 */
export function error(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug || process.env.NODE_ENV !== 'production') {
    console.error(`[SessionKit] ${message}`, ...args);
  }
}

/**
 * Log warning message. Always logs unless in production, but can be forced via debug flag.
 */
export function warn(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug || process.env.NODE_ENV !== 'production') {
    console.warn(`[SessionKit] ${message}`, ...args);
  }
}

/**
 * Log info message. Always logs unless in production, but can be forced via debug flag.
 */
export function info(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug || process.env.NODE_ENV !== 'production') {
    console.log(`[SessionKit] ${message}`, ...args);
  }
}

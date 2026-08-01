import { getConfig } from "./config";

function formatMessage(message: string): string {
  return `[SessionKit] [${new Date().toISOString()}] ${message}`;
}

/**
 * Log message if debug mode is enabled
 */
export function debug(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug) {
    console.log(formatMessage(message), ...args);
  }
}

/**
 * Log error message. Always logs unless in production, but can be forced via debug flag.
 */
export function error(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug || process.env.NODE_ENV !== 'production') {
    console.error(formatMessage(message), ...args);
  }
}

/**
 * Log warning message. Always logs unless in production, but can be forced via debug flag.
 */
export function warn(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug || process.env.NODE_ENV !== 'production') {
    console.warn(formatMessage(message), ...args);
  }
}

/**
 * Log info message. Always logs unless in production, but can be forced via debug flag.
 */
export function info(message: string, ...args: any[]): void {
  const { debug } = getConfig();
  if (debug || process.env.NODE_ENV !== 'production') {
    console.log(formatMessage(message), ...args);
  }
}

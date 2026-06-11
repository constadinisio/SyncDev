import pino from "pino";
import { loadConfig } from "./config.js";

const config = loadConfig();

/**
 * Structured JSON logger backed by pino. Levels are configurable via
 * LOG_LEVEL. In production, output is line-delimited JSON suitable for log
 * aggregation; locally you can pipe through `pino-pretty` for readability.
 */
export const logger = pino({
  level: config.logLevel,
  base: { service: "collab", env: config.nodeEnv },
  formatters: {
    level: (label) => ({ level: label }),
  },
});

/** Logs an informational message scoped to a context (subsystem). */
export function log(context: string, message: string): void {
  logger.info({ context }, message);
}

/** Logs a debug message scoped to a context. */
export function logDebug(context: string, message: string): void {
  logger.debug({ context }, message);
}

/** Logs a warning scoped to a context. */
export function logWarn(context: string, message: string): void {
  logger.warn({ context }, message);
}

/**
 * Logs an error scoped to a context. Serializes Error instances with their
 * stack; other thrown values are attached as `err`.
 */
export function logError(context: string, message: string, error?: unknown): void {
  if (error instanceof Error) {
    logger.error({ context, err: error }, message);
  } else if (error !== undefined) {
    logger.error({ context, err: error }, message);
  } else {
    logger.error({ context }, message);
  }
}

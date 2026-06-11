import * as Sentry from "@sentry/node";
import { loadConfig } from "./config.js";

/**
 * Error tracking via Sentry. Entirely inert when SENTRY_DSN is unset, so local
 * development and tests need no configuration. Initialize once at startup.
 */

const config = loadConfig();

export function initSentry(): void {
  if (!config.sentryDsn) return;
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    // Error tracking only by default; enable tracing explicitly if needed.
    tracesSampleRate: 0,
  });
}

/** Reports an exception to Sentry. No-op when Sentry is disabled. */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (!config.sentryDsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function isSentryEnabled(): boolean {
  return Boolean(config.sentryDsn);
}

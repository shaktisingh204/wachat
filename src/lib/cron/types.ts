/**
 * Shared types for cron jobs.
 *
 * Every job exports a default `async () => Promise<CronJobResult>`. The
 * `[job]` API route awaits the result and serializes it back to the caller
 * (PM2 worker, manual ping, ops dashboard).
 */

export interface CronJobResult {
  /** Total items the job examined / acted on. */
  processed: number;
  /** Per-item or per-step errors that did NOT abort the job. */
  errors: CronJobErrorEntry[];
  /** Total wall-clock time in milliseconds. */
  durationMs: number;
  /** Optional free-form details for logging/observability. */
  details?: Record<string, unknown>;
}

export interface CronJobErrorEntry {
  /** Identifier for the record / step that failed (e.g. ObjectId.toHexString()). */
  ref?: string;
  /** Human-readable message. */
  message: string;
}

export type CronJob = () => Promise<CronJobResult>;

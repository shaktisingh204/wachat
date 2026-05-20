import type { CronJobErrorEntry } from './types';

/**
 * Convert an unknown thrown value into a readable message without losing
 * stack info in the logs. Mirrors what `getErrorMessage` does elsewhere in
 * the codebase but avoids the dependency cycle into `@/lib/utils`.
 */
export function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Helper used by every job to attach a per-record failure to the result
 * without crashing the run.
 */
export function pushError(
  bucket: CronJobErrorEntry[],
  err: unknown,
  ref?: string,
): void {
  bucket.push({ ref, message: toErrorMessage(err) });
}

/**
 * Compute the next occurrence date for a recurring invoice / expense.
 *
 * `frequency` matches the strings used in the CRM (`crm_recurring_invoices.billing_frequency`).
 */
export function addRecurrence(
  base: Date,
  frequency: string,
  interval: number,
): Date {
  const next = new Date(base.getTime());
  const step = Math.max(1, Math.floor(interval || 1));
  switch ((frequency || '').toLowerCase()) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + step);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7 * step);
      break;
    case 'bi-weekly':
    case 'biweekly':
      next.setUTCDate(next.getUTCDate() + 14 * step);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + step);
      break;
    case 'quarterly':
      next.setUTCMonth(next.getUTCMonth() + 3 * step);
      break;
    case 'half-yearly':
    case 'halfyearly':
    case 'semiannually':
      next.setUTCMonth(next.getUTCMonth() + 6 * step);
      break;
    case 'yearly':
    case 'annually':
      next.setUTCFullYear(next.getUTCFullYear() + step);
      break;
    default:
      // Fall back to monthly so a misconfigured row doesn't loop forever.
      next.setUTCMonth(next.getUTCMonth() + step);
      break;
  }
  return next;
}

/**
 * Same as `addRecurrence` but for the `crm_events` / `crm_tasks` shape
 * which uses `repeat_type` of daily | weekly | monthly | yearly.
 */
export function addRepeat(
  base: Date,
  repeatType: string,
  repeatEvery: number,
): Date {
  const next = new Date(base.getTime());
  const step = Math.max(1, Math.floor(repeatEvery || 1));
  switch ((repeatType || '').toLowerCase()) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + step);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7 * step);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + step);
      break;
    case 'yearly':
      next.setUTCFullYear(next.getUTCFullYear() + step);
      break;
    default:
      next.setUTCDate(next.getUTCDate() + step);
      break;
  }
  return next;
}

/**
 * Returns `now` as a Date and the cron job log prefix for consistent
 * structured logging.
 */
export function jobStart(name: string): {
  startedAt: Date;
  log: (msg: string, extra?: Record<string, unknown>) => void;
} {
  const startedAt = new Date();
  const log = (msg: string, extra?: Record<string, unknown>): void => {
    const payload = extra
      ? ` ${JSON.stringify(extra)}`
      : '';
    // eslint-disable-next-line no-console
    console.log(`[cron:${name}] ${msg}${payload}`);
  };
  log('start', { at: startedAt.toISOString() });
  return { startedAt, log };
}

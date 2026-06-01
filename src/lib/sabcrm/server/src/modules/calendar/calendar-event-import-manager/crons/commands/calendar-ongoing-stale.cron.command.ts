import "server-only";

// PORT-NOTE: NestJS CommandRunner/Command pattern dropped — Next.js has no CLI
// runner equivalent. This module exposes a plain async trigger function that
// can be called from a Vercel Cron route or an API handler.

import {
  CALENDAR_ONGOING_STALE_CRON_PATTERN,
  runCalendarOngoingStaleCronJob,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/crons/jobs/calendar-ongoing-stale.cron.job";

// Cron pattern for scheduling via Vercel Cron (vercel.json):  0 * * * *
export const CALENDAR_ONGOING_STALE_COMMAND_CRON_PATTERN =
  CALENDAR_ONGOING_STALE_CRON_PATTERN;

/**
 * Triggers the calendar-ongoing-stale cron job.
 * Wire this into a Vercel Cron handler at /api/cron/calendar-ongoing-stale.
 */
export async function runCalendarOngoingStaleCommand(): Promise<void> {
  await runCalendarOngoingStaleCronJob();
}

import "server-only";

// PORT-NOTE: NestJS CommandRunner/Command pattern dropped — Next.js has no CLI
// runner equivalent. This module exposes a plain async trigger function that
// can be called from a Vercel Cron route or an API handler.

import {
  CALENDAR_EVENTS_IMPORT_CRON_PATTERN,
  runCalendarEventsImportCronJob,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/crons/jobs/calendar-events-import.cron.job";

// Cron pattern for scheduling via Vercel Cron (vercel.json):  */1 * * * *
export const CALENDAR_EVENTS_IMPORT_COMMAND_CRON_PATTERN =
  CALENDAR_EVENTS_IMPORT_CRON_PATTERN;

/**
 * Triggers the calendar-events-import cron job.
 * Wire this into a Vercel Cron handler at /api/cron/calendar-events-import.
 */
export async function runCalendarEventsImportCommand(): Promise<void> {
  await runCalendarEventsImportCronJob();
}

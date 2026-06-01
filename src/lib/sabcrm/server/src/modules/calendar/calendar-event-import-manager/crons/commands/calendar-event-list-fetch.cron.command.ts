import "server-only";

// PORT-NOTE: NestJS CommandRunner/Command pattern dropped — Next.js has no CLI
// runner equivalent. This module exposes a plain async trigger function that
// can be called from a Vercel Cron route or an API handler.

import { CALENDAR_EVENT_LIST_FETCH_CRON_PATTERN } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/crons/jobs/calendar-event-list-fetch.cron.job";
import { runCalendarEventListFetchCronJob } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/crons/jobs/calendar-event-list-fetch.cron.job";

// Cron pattern for scheduling via Vercel Cron (vercel.json):  */5 * * * *
export const CALENDAR_EVENT_LIST_FETCH_COMMAND_CRON_PATTERN =
  CALENDAR_EVENT_LIST_FETCH_CRON_PATTERN;

/**
 * Triggers the calendar-event-list-fetch cron job.
 * Wire this into a Vercel Cron handler at /api/cron/calendar-event-list-fetch.
 */
export async function runCalendarEventListFetchCommand(): Promise<void> {
  await runCalendarEventListFetchCronJob();
}

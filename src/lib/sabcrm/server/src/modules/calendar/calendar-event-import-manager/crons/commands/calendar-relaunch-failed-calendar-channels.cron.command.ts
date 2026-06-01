import "server-only";

// PORT-NOTE: NestJS CommandRunner/Command pattern dropped — Next.js has no CLI
// runner equivalent. This module exposes a plain async trigger function that
// can be called from a Vercel Cron route or an API handler.

import {
  CALENDAR_RELAUNCH_FAILED_CALENDAR_CHANNELS_CRON_PATTERN,
  runCalendarRelaunchFailedCalendarChannelsCronJob,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/crons/jobs/calendar-relaunch-failed-calendar-channels.cron.job";

// Cron pattern for scheduling via Vercel Cron (vercel.json):  */30 * * * *
export const CALENDAR_RELAUNCH_FAILED_CHANNELS_COMMAND_CRON_PATTERN =
  CALENDAR_RELAUNCH_FAILED_CALENDAR_CHANNELS_CRON_PATTERN;

/**
 * Triggers the calendar-relaunch-failed-calendar-channels cron job.
 * Wire this into a Vercel Cron handler at
 * /api/cron/calendar-relaunch-failed-calendar-channels.
 */
export async function runCalendarRelaunchFailedCalendarChannelsCommand(): Promise<void> {
  await runCalendarRelaunchFailedCalendarChannelsCronJob();
}

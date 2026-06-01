// server-logic: isSyncStale — pure util, no Mongo access.

import { CALENDAR_IMPORT_ONGOING_SYNC_TIMEOUT } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/constants/calendar-import-ongoing-sync-timeout.constant";

const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined;

/**
 * Returns true when the sync stage has been running for longer than the stale
 * threshold (CALENDAR_IMPORT_ONGOING_SYNC_TIMEOUT).
 * Also returns true when syncStageStartedAt is absent (never started → treat as stale).
 */
export const isSyncStale = (syncStageStartedAt?: string | null): boolean => {
  if (!isDefined(syncStageStartedAt)) {
    return true;
  }

  const syncStageStartedTime = new Date(syncStageStartedAt).getTime();

  if (isNaN(syncStageStartedTime)) {
    throw new Error("Invalid date format");
  }

  return (
    Date.now() - syncStageStartedTime > CALENDAR_IMPORT_ONGOING_SYNC_TIMEOUT
  );
};

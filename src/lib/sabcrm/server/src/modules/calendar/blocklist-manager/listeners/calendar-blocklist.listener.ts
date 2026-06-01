// PORT-NOTE: Adapted from twenty-server/src/modules/calendar/blocklist-manager/listeners/calendar-blocklist.listener.ts
// NestJS event listeners converted to plain exported functions.
// In SabNode these would be called from a background-job dispatcher or a
// database-change-stream handler.

import "server-only";

import {
  handleBlocklistItemDeleteCalendarEvents,
  type BlocklistItemDeleteCalendarEventsJobData,
} from "@/lib/sabcrm/server/src/modules/calendar/blocklist-manager/jobs/blocklist-item-delete-calendar-events.job";
import {
  handleBlocklistReimportCalendarEvents,
  type BlocklistReimportCalendarEventsJobData,
} from "@/lib/sabcrm/server/src/modules/calendar/blocklist-manager/jobs/blocklist-reimport-calendar-events.job";

// ---------------------------------------------------------------------------
// Types (mirroring twenty-shared/database-events shapes)
// ---------------------------------------------------------------------------

type ObjectRecordCreateEvent<T> = {
  recordId: string;
  properties: { after: T };
};

type ObjectRecordDeleteEvent<T> = {
  recordId: string;
  properties: { before: T };
};

type ObjectRecordUpdateEvent<T> = {
  recordId: string;
  properties: { before: T; after: T };
};

export type WorkspaceEventBatch<T> = {
  workspaceId: string;
  events: T[];
};

// ---------------------------------------------------------------------------
// Listener functions (previously @OnDatabaseBatchEvent decorated methods)
// ---------------------------------------------------------------------------

export async function onBlocklistCreated(
  payload: WorkspaceEventBatch<ObjectRecordCreateEvent<{ workspaceMemberId: string }>>,
): Promise<void> {
  const jobData: BlocklistItemDeleteCalendarEventsJobData = {
    workspaceId: payload.workspaceId,
    events: payload.events.map((e) => ({ recordId: e.recordId })),
  };
  await handleBlocklistItemDeleteCalendarEvents(jobData);
}

export async function onBlocklistDeleted(
  payload: WorkspaceEventBatch<ObjectRecordDeleteEvent<{ workspaceMemberId: string }>>,
): Promise<void> {
  const jobData: BlocklistReimportCalendarEventsJobData = {
    workspaceId: payload.workspaceId,
    events: payload.events.map((e) => ({
      properties: { before: { workspaceMemberId: e.properties.before.workspaceMemberId } },
    })),
  };
  await handleBlocklistReimportCalendarEvents(jobData);
}

export async function onBlocklistUpdated(
  payload: WorkspaceEventBatch<ObjectRecordUpdateEvent<{ workspaceMemberId: string }>>,
): Promise<void> {
  const deleteJobData: BlocklistItemDeleteCalendarEventsJobData = {
    workspaceId: payload.workspaceId,
    events: payload.events.map((e) => ({ recordId: e.recordId })),
  };
  await handleBlocklistItemDeleteCalendarEvents(deleteJobData);

  const reimportJobData: BlocklistReimportCalendarEventsJobData = {
    workspaceId: payload.workspaceId,
    events: payload.events.map((e) => ({
      properties: { before: { workspaceMemberId: e.properties.before.workspaceMemberId } },
    })),
  };
  await handleBlocklistReimportCalendarEvents(reimportJobData);
}

// ---------------------------------------------------------------------------
// Class façade
// ---------------------------------------------------------------------------

export class CalendarBlocklistListener {
  async handleCreatedEvent(
    payload: WorkspaceEventBatch<ObjectRecordCreateEvent<{ workspaceMemberId: string }>>,
  ) {
    return onBlocklistCreated(payload);
  }

  async handleDeletedEvent(
    payload: WorkspaceEventBatch<ObjectRecordDeleteEvent<{ workspaceMemberId: string }>>,
  ) {
    return onBlocklistDeleted(payload);
  }

  async handleUpdatedEvent(
    payload: WorkspaceEventBatch<ObjectRecordUpdateEvent<{ workspaceMemberId: string }>>,
  ) {
    return onBlocklistUpdated(payload);
  }
}

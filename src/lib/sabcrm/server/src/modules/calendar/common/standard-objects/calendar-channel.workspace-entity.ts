// server-logic: CalendarChannelWorkspaceEntity → CalendarChannelDoc (Mongo document type).
// Collection: sabcrm_calendar_channel

export const CalendarChannelVisibility = {
  SHARE_EVERYTHING: "SHARE_EVERYTHING",
  METADATA: "METADATA",
  NONE: "NONE",
} as const;
export type CalendarChannelVisibility =
  (typeof CalendarChannelVisibility)[keyof typeof CalendarChannelVisibility];

export const CalendarChannelSyncStatus = {
  ACTIVE: "ACTIVE",
  NOT_SYNCED: "NOT_SYNCED",
  ONGOING: "ONGOING",
  FAILED_UNKNOWN: "FAILED_UNKNOWN",
  FAILED_INSUFFICIENT_PERMISSIONS: "FAILED_INSUFFICIENT_PERMISSIONS",
} as const;
export type CalendarChannelSyncStatus =
  (typeof CalendarChannelSyncStatus)[keyof typeof CalendarChannelSyncStatus];

export const CalendarChannelSyncStage = {
  FAILED: "FAILED",
  CALENDAR_EVENT_LIST_FETCH_PENDING: "CALENDAR_EVENT_LIST_FETCH_PENDING",
  CALENDAR_EVENT_LIST_FETCH_ONGOING: "CALENDAR_EVENT_LIST_FETCH_ONGOING",
  CALENDAR_EVENTS_IMPORT_PENDING: "CALENDAR_EVENTS_IMPORT_PENDING",
  CALENDAR_EVENTS_IMPORT_ONGOING: "CALENDAR_EVENTS_IMPORT_ONGOING",
  PENDING_CONFIGURATION: "PENDING_CONFIGURATION",
} as const;
export type CalendarChannelSyncStage =
  (typeof CalendarChannelSyncStage)[keyof typeof CalendarChannelSyncStage];

export const CalendarChannelContactAutoCreationPolicy = {
  AS_ATTENDEE_AND_ORGANIZER: "AS_ATTENDEE_AND_ORGANIZER",
  AS_ORGANIZER: "AS_ORGANIZER",
  AS_ATTENDEE: "AS_ATTENDEE",
  NONE: "NONE",
} as const;
export type CalendarChannelContactAutoCreationPolicy =
  (typeof CalendarChannelContactAutoCreationPolicy)[keyof typeof CalendarChannelContactAutoCreationPolicy];

export const SEARCH_FIELDS_FOR_CALENDAR_CHANNEL = [
  { name: "handle", type: "TEXT" },
] as const;

export type CalendarChannelDoc = {
  id: string;
  workspaceId: string;
  handle: string | null;
  syncStatus: CalendarChannelSyncStatus | null;
  syncStage: CalendarChannelSyncStage;
  visibility: CalendarChannelVisibility;
  isContactAutoCreationEnabled: boolean;
  contactAutoCreationPolicy: CalendarChannelContactAutoCreationPolicy;
  isSyncEnabled: boolean;
  syncCursor: string | null;
  syncedAt: string | null;
  syncStageStartedAt: string | null;
  throttleFailureCount: number;
  connectedAccountId: string;
  // Base fields
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** @deprecated Alias kept for backwards compatibility. */
export type CalendarChannelWorkspaceEntity = CalendarChannelDoc;

// PORT-NOTE: NestJS GraphQL @ObjectType decorators removed; file is now a plain TS type.
// class-validator decorators kept as documentation only (not runtime-enforced in Next.js context).

export enum CalendarChannelSyncStatus {
  NOT_SYNCED = 'NOT_SYNCED',
  ONGOING = 'ONGOING',
  ACTIVE = 'ACTIVE',
  FAILED_INSUFFICIENT_PERMISSIONS = 'FAILED_INSUFFICIENT_PERMISSIONS',
  FAILED_UNKNOWN = 'FAILED_UNKNOWN',
}

export enum CalendarChannelSyncStage {
  PENDING_CONFIGURATION = 'PENDING_CONFIGURATION',
  CALENDAR_EVENT_LIST_FETCH_PENDING = 'CALENDAR_EVENT_LIST_FETCH_PENDING',
  CALENDAR_EVENT_LIST_FETCH_SCHEDULED = 'CALENDAR_EVENT_LIST_FETCH_SCHEDULED',
  CALENDAR_EVENT_LIST_FETCH_ONGOING = 'CALENDAR_EVENT_LIST_FETCH_ONGOING',
  CALENDAR_EVENTS_IMPORT_PENDING = 'CALENDAR_EVENTS_IMPORT_PENDING',
  CALENDAR_EVENTS_IMPORT_SCHEDULED = 'CALENDAR_EVENTS_IMPORT_SCHEDULED',
  CALENDAR_EVENTS_IMPORT_ONGOING = 'CALENDAR_EVENTS_IMPORT_ONGOING',
  FAILED = 'FAILED',
}

export enum CalendarChannelVisibility {
  METADATA = 'METADATA',
  SHARE_EVERYTHING = 'SHARE_EVERYTHING',
}

export enum CalendarChannelContactAutoCreationPolicy {
  AS_PARTICIPANT_AND_ORGANIZER = 'AS_PARTICIPANT_AND_ORGANIZER',
  AS_PARTICIPANT = 'AS_PARTICIPANT',
  AS_ORGANIZER = 'AS_ORGANIZER',
  NONE = 'NONE',
}

export type CalendarChannelDTO = {
  id: string;
  handle: string;
  syncStatus: CalendarChannelSyncStatus;
  syncStage: CalendarChannelSyncStage;
  visibility: CalendarChannelVisibility;
  isContactAutoCreationEnabled: boolean;
  contactAutoCreationPolicy: CalendarChannelContactAutoCreationPolicy;
  isSyncEnabled: boolean;
  /** Hidden from public API */
  syncCursor: string | null;
  syncedAt: Date | null;
  syncStageStartedAt: Date | null;
  throttleFailureCount: number;
  connectedAccountId: string;
  /** Hidden from public API */
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
};

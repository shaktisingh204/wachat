// server-logic: CalendarEventParticipantWorkspaceEntity → CalendarEventParticipantDoc
// Collection: sabcrm_calendar_event_participant

export const SEARCH_FIELDS_FOR_CALENDAR_EVENT_PARTICIPANT = [
  { name: "handle", type: "TEXT" },
] as const;

export const CalendarEventParticipantResponseStatus = {
  NEEDS_ACTION: "NEEDS_ACTION",
  DECLINED: "DECLINED",
  TENTATIVE: "TENTATIVE",
  ACCEPTED: "ACCEPTED",
} as const;
export type CalendarEventParticipantResponseStatus =
  (typeof CalendarEventParticipantResponseStatus)[keyof typeof CalendarEventParticipantResponseStatus];

export type CalendarEventParticipantDoc = {
  id: string;
  workspaceId: string;
  handle: string | null;
  displayName: string | null;
  isOrganizer: boolean;
  responseStatus: string;
  calendarEventId: string;
  // Relation id refs
  personId: string | null;
  workspaceMemberId: string | null;
  // Base fields
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** @deprecated Alias kept for backwards compatibility. */
export type CalendarEventParticipantWorkspaceEntity =
  CalendarEventParticipantDoc;

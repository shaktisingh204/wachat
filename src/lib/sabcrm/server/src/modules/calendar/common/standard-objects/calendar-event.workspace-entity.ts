// server-logic: CalendarEventWorkspaceEntity → CalendarEventDoc (Mongo document type).
// Collection: sabcrm_calendar_event

export type LinksMetadata = {
  primaryLinkLabel: string;
  primaryLinkUrl: string;
  secondaryLinks: { label: string; url: string }[];
};

export const SEARCH_FIELDS_FOR_CALENDAR_EVENT = [
  { name: "title", type: "TEXT" },
] as const;

export type CalendarEventDoc = {
  /** Internal Mongo _id is not exposed; use `id` (UUID string) as the business key. */
  id: string;
  workspaceId: string;
  title: string | null;
  isCanceled: boolean;
  isFullDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  externalCreatedAt: string | null;
  externalUpdatedAt: string | null;
  description: string | null;
  location: string | null;
  iCalUid: string | null;
  conferenceSolution: string | null;
  conferenceLink: LinksMetadata;
  // Relation metadata (ids only; actual documents fetched separately)
  calendarChannelEventAssociationIds?: string[];
  calendarEventParticipantIds?: string[];
  // Base fields
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** @deprecated Alias kept for backwards compatibility with ported files that reference the entity name. */
export type CalendarEventWorkspaceEntity = CalendarEventDoc;

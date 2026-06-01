// server-logic: CalendarChannelEventAssociationWorkspaceEntity → CalendarChannelEventAssociationDoc
// Collection: sabcrm_calendar_channel_event_association

export const SEARCH_FIELDS_FOR_CALENDAR_CHANNEL_EVENT_ASSOCIATION = [
  { name: "eventExternalId", type: "TEXT" },
] as const;

export type CalendarChannelEventAssociationDoc = {
  id: string;
  workspaceId: string;
  eventExternalId: string | null;
  recurringEventExternalId: string | null;
  calendarChannelId: string;
  calendarEventId: string;
  // Base fields
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

/** @deprecated Alias kept for backwards compatibility with ported files that reference the entity name. */
export type CalendarChannelEventAssociationWorkspaceEntity =
  CalendarChannelEventAssociationDoc;

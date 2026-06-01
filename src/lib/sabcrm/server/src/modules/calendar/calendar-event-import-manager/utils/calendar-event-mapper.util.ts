// server-logic: mapCalendarEventsByICalUID — pure util, no Mongo access.

import type { CalendarEventDoc } from "@/lib/sabcrm/server/src/modules/calendar/common/standard-objects/calendar-event.workspace-entity";

/**
 * Builds a Map of iCalUid → calendarEvent.id from an array of existing events.
 */
export const mapCalendarEventsByICalUID = (
  existingCalendarEvents: Pick<CalendarEventDoc, "id" | "iCalUid">[],
): Map<string, string> => {
  return new Map<string, string>(
    existingCalendarEvents.map((calendarEvent) => [
      calendarEvent.iCalUid ?? "",
      calendarEvent.id,
    ]),
  );
};

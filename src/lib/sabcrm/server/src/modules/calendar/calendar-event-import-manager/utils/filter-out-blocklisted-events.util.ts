// server-logic: filterOutBlocklistedEvents — pure util.

import type { FetchedCalendarEvent } from "@/lib/sabcrm/server/src/modules/calendar/common/types/fetched-calendar-event";

/**
 * Checks whether an email address appears on the blocklist.
 * Domain entries start with '@' (e.g. "@spam.com") and match the full domain or subdomains.
 */
const isEmailBlocklisted = (
  channelHandles: string[],
  email: string | null | undefined,
  blocklist: string[],
): boolean => {
  if (!email || channelHandles.includes(email)) {
    return false;
  }

  return blocklist.some((item) => {
    if (item.startsWith("@")) {
      const domain = email.split("@")[1];
      return domain === item.slice(1) || domain.endsWith(`.${item.slice(1)}`);
    }
    return email === item;
  });
};

export const filterOutBlocklistedEvents = (
  calendarChannelHandles: string[],
  events: FetchedCalendarEvent[],
  blocklist: string[],
): FetchedCalendarEvent[] => {
  return events.filter((event) => {
    if (!event.participants) {
      return true;
    }

    return event.participants.every(
      (attendee) =>
        !isEmailBlocklisted(calendarChannelHandles, attendee.handle, blocklist),
    );
  });
};

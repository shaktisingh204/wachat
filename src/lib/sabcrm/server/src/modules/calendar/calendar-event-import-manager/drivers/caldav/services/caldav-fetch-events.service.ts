import "server-only";

// PORT-NOTE: NestJS @Injectable service → plain exported functions.
// No DI container; all dependencies imported directly.

import {
  type DAVCalendar,
  type DAVClient,
  type DAVResponse,
  DAVNamespaceShort,
} from "tsdav";

import { type CalDavSyncCursor } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/types/caldav-sync-cursor";
import { buildCancelledCalDavEvent } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/utils/build-cancelled-event.util";
import { extractICalData } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/utils/extract-ical-data.util";
import { isEventInTimeRange } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/utils/is-event-in-time-range.util";
import { isInvalidSyncTokenResponse } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/utils/is-invalid-sync-token-response.util";
import { isValidCalDavHref } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/utils/is-valid-caldav-href.util";
import { parseICalEvents } from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/utils/parse-ical-event.util";
import { type FetchedCalendarEvent } from "@/lib/sabcrm/server/src/modules/calendar/common/types/fetched-calendar-event";

export type CalendarSyncResult = {
  calendarUrl: string;
  events: FetchedCalendarEvent[];
  newSyncToken?: string;
  newCtag?: string;
  newEtags?: Record<string, string>;
};

export type FetchEventsOptions = {
  startDate: Date;
  endDate: Date;
  syncCursor?: CalDavSyncCursor;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listEventCalendars(
  client: DAVClient,
): Promise<DAVCalendar[]> {
  const calendars = await client.fetchCalendars();

  return calendars.filter((calendar) =>
    calendar.components?.includes("VEVENT"),
  );
}

export async function fetchEvents(
  client: DAVClient,
  options: FetchEventsOptions,
): Promise<{ events: FetchedCalendarEvent[]; syncCursor: CalDavSyncCursor }> {
  const calendars = await listEventCalendars(client);

  const results = await Promise.all(
    calendars.map((calendar) => syncCalendar(client, calendar, options)),
  );

  return {
    events: results.flatMap((result) => result.events),
    syncCursor: mergeSyncCursor(results),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function syncCalendar(
  client: DAVClient,
  calendar: DAVCalendar,
  options: FetchEventsOptions,
): Promise<CalendarSyncResult> {
  const supportsSyncCollection =
    calendar.reports?.includes("syncCollection") ?? false;

  try {
    return supportsSyncCollection
      ? await fetchEventsViaSyncCollection(client, calendar, options)
      : await fetchEventsViaCtagEtag(client, calendar, options);
  } catch (error) {
    console.error(
      `[CalDavFetchEventsService] Per-calendar sync failed for ${calendar.url}`,
      error,
    );

    return {
      calendarUrl: calendar.url,
      events: [],
      newSyncToken: options.syncCursor?.syncTokens[calendar.url],
      newCtag: options.syncCursor?.ctags?.[calendar.url],
      newEtags: options.syncCursor?.etags?.[calendar.url],
    };
  }
}

async function fetchEventsViaSyncCollection(
  client: DAVClient,
  calendar: DAVCalendar,
  options: FetchEventsOptions,
): Promise<CalendarSyncResult> {
  const previousSyncToken = options.syncCursor?.syncTokens[calendar.url];

  const syncResult = await runSyncCollection(
    client,
    calendar.url,
    previousSyncToken,
  );

  const memberResponses = syncResult.filter(
    (entry): entry is DAVResponse & { href: string } =>
      typeof entry.href === "string" &&
      entry.href.length > 0 &&
      isValidCalDavHref(entry.href),
  );

  const changedHrefs = memberResponses
    .filter((entry) => entry.status !== 404)
    .map((entry) => entry.href);
  const cancelledHrefs = memberResponses
    .filter((entry) => entry.status === 404)
    .map((entry) => entry.href);

  const fetchedEvents = await fetchAndParseEvents(
    client,
    calendar.url,
    changedHrefs,
    options,
  );

  const rawSyncToken = (syncResult[0]?.raw as Record<string, unknown> | undefined)
    ?.multistatus;
  const newSyncToken =
    typeof rawSyncToken === "string" && rawSyncToken.length > 0
      ? rawSyncToken
      : previousSyncToken;

  return {
    calendarUrl: calendar.url,
    events: [...fetchedEvents, ...cancelledHrefs.map(buildCancelledCalDavEvent)],
    newSyncToken,
  };
}

async function runSyncCollection(
  client: DAVClient,
  url: string,
  previousSyncToken: string | undefined,
): Promise<DAVResponse[]> {
  const send = (token: string | undefined) =>
    client.syncCollection({
      url,
      props: {
        [`${DAVNamespaceShort.DAV}:getetag`]: {},
        [`${DAVNamespaceShort.CALDAV}:calendar-data`]: {},
      },
      syncLevel: 1,
      ...(typeof token === "string" && token.length > 0
        ? { syncToken: token }
        : {}),
    });

  const result = await send(previousSyncToken);

  if (
    typeof previousSyncToken === "string" &&
    previousSyncToken.length > 0 &&
    isInvalidSyncTokenResponse(result)
  ) {
    console.warn(
      `[CalDavFetchEventsService] Sync-token invalidated for ${url}; falling back to full re-sync`,
    );

    return send(undefined);
  }

  return result;
}

async function fetchEventsViaCtagEtag(
  client: DAVClient,
  calendar: DAVCalendar,
  options: FetchEventsOptions,
): Promise<CalendarSyncResult> {
  const storedEtags = options.syncCursor?.etags?.[calendar.url] ?? {};
  const newCtag =
    calendar.ctag != null ? String(calendar.ctag) : undefined;
  const storedCtag = options.syncCursor?.ctags?.[calendar.url];

  if (newCtag != null && storedCtag != null && newCtag === storedCtag) {
    return {
      calendarUrl: calendar.url,
      events: [],
      newCtag,
      newEtags: storedEtags,
    };
  }

  const currentEtags = await fetchEtagsByHref(client, calendar.url);

  const changedHrefs = Object.keys(currentEtags).filter(
    (href) => storedEtags[href] !== currentEtags[href],
  );
  const cancelledHrefs = Object.keys(storedEtags).filter(
    (href) => !(href in currentEtags),
  );

  const fetchedEvents = await fetchAndParseEvents(
    client,
    calendar.url,
    changedHrefs,
    options,
  );

  return {
    calendarUrl: calendar.url,
    events: [...fetchedEvents, ...cancelledHrefs.map(buildCancelledCalDavEvent)],
    newCtag,
    newEtags: currentEtags,
  };
}

function mergeSyncCursor(results: CalendarSyncResult[]): CalDavSyncCursor {
  const syncTokens: Record<string, string> = {};
  const ctags: Record<string, string> = {};
  const etags: Record<string, Record<string, string>> = {};

  for (const result of results) {
    if (result.newSyncToken)
      syncTokens[result.calendarUrl] = result.newSyncToken;
    if (result.newCtag) ctags[result.calendarUrl] = result.newCtag;
    if (result.newEtags) etags[result.calendarUrl] = result.newEtags;
  }

  return {
    syncTokens,
    ctags: Object.keys(ctags).length > 0 ? ctags : undefined,
    etags: Object.keys(etags).length > 0 ? etags : undefined,
  };
}

async function fetchEtagsByHref(
  client: DAVClient,
  calendarUrl: string,
): Promise<Record<string, string>> {
  const responses = await client.propfind({
    url: calendarUrl,
    props: { [`${DAVNamespaceShort.DAV}:getetag`]: {} },
    depth: "1",
  });

  return responses.reduce<Record<string, string>>((map, response) => {
    const href = response.href;
    const etag = response.props?.getetag;

    if (
      typeof href !== "string" ||
      href.length === 0 ||
      typeof etag !== "string" ||
      etag.length === 0 ||
      !isValidCalDavHref(href)
    ) {
      return map;
    }

    map[href] = etag;

    return map;
  }, {});
}

async function fetchAndParseEvents(
  client: DAVClient,
  calendarUrl: string,
  objectUrls: string[],
  options: { startDate: Date; endDate: Date },
): Promise<FetchedCalendarEvent[]> {
  if (objectUrls.length === 0) return [];

  const calendarObjects = await client.calendarMultiGet({
    url: calendarUrl,
    props: {
      [`${DAVNamespaceShort.DAV}:getetag`]: {},
      [`${DAVNamespaceShort.CALDAV}:calendar-data`]: {},
    },
    objectUrls,
    depth: "1",
  });

  return calendarObjects.flatMap((calendarObject) => {
    const iCalData = extractICalData(
      calendarObject.props?.calendarData as
        | string
        | Record<string, unknown>
        | null
        | undefined,
    );

    if (!iCalData) return [];

    return parseICalEvents(iCalData, calendarObject.href ?? "").filter(
      (event) =>
        isEventInTimeRange(event, options.startDate, options.endDate),
    );
  });
}

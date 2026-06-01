import 'server-only';

import { type Event } from '@microsoft/microsoft-graph-types';

import { formatMicrosoftCalendarEvents } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/microsoft-calendar/utils/format-microsoft-calendar-event.util';
import { parseMicrosoftCalendarError } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/microsoft-calendar/utils/parse-microsoft-calendar-error.util';
import { type FetchedCalendarEvent } from '@/lib/sabcrm/server/src/modules/calendar/common/types/fetched-calendar-event';

// PORT-NOTE: MicrosoftOAuth2ClientProvider and ConnectedAccountEntity are kept as
// lightweight structural types — OAuth client retrieval must be wired through
// SabNode's connected-account layer.

export type ConnectedAccountRef = {
  provider: string;
  id: string;
};

type MicrosoftGraphClient = {
  api: (path: string) => { get: () => Promise<Event> };
};

export async function microsoftCalendarImportEvents(
  connectedAccount: ConnectedAccountRef,
  getMicrosoftClient: (id: string) => Promise<MicrosoftGraphClient>,
  changedEventIds: string[],
): Promise<FetchedCalendarEvent[]> {
  try {
    const microsoftClient = await getMicrosoftClient(connectedAccount.id);

    const events: Event[] = [];

    for (const changedEventId of changedEventIds) {
      const event = await microsoftClient
        .api(`/me/calendar/events/${changedEventId}`)
        .get();

      events.push(event);
    }

    return formatMicrosoftCalendarEvents(events);
  } catch (error) {
    throw parseMicrosoftCalendarError(error as { statusCode?: number; message: string });
  }
}

// Class-based wrapper for callers that prefer the original API shape.
export class MicrosoftCalendarImportEventsService {
  constructor(
    private readonly getMicrosoftClient: (id: string) => Promise<MicrosoftGraphClient>,
  ) {}

  public async getCalendarEvents(
    connectedAccount: ConnectedAccountRef,
    changedEventIds: string[],
  ): Promise<FetchedCalendarEvent[]> {
    return microsoftCalendarImportEvents(
      connectedAccount,
      this.getMicrosoftClient,
      changedEventIds,
    );
  }
}

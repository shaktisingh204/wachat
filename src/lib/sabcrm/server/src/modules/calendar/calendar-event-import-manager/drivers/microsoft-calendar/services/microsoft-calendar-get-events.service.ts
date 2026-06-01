import 'server-only';

import {
  type PageCollection,
  PageIterator,
  type PageIteratorCallback,
} from '@microsoft/microsoft-graph-client';

import { parseMicrosoftCalendarError } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/microsoft-calendar/utils/parse-microsoft-calendar-error.util';
import { type GetCalendarEventsResponse } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/services/calendar-get-events.service';

// PORT-NOTE: MicrosoftOAuth2ClientProvider and ConnectedAccountEntity are kept as
// lightweight structural types — OAuth client retrieval must be wired through
// SabNode's connected-account layer.

export type ConnectedAccountRef = {
  provider: string;
  id: string;
};

// PORT-NOTE: getMicrosoftClient must be supplied by the call-site (no NestJS DI).
// Pass a function that accepts the connectedAccountId and returns a Microsoft Graph client.
export async function microsoftCalendarGetEvents(
  connectedAccount: ConnectedAccountRef,
  getMicrosoftClient: (
    id: string,
  ) => Promise<{ api: (path: string) => { version: (v: string) => { get: () => Promise<PageCollection> } } }>,
  syncCursor?: string,
): Promise<GetCalendarEventsResponse> {
  try {
    const microsoftClient = await getMicrosoftClient(connectedAccount.id);
    const eventIds: string[] = [];

    const response: PageCollection = await microsoftClient
      .api(syncCursor || '/me/calendar/events/delta')
      .version('beta')
      .get();

    const callback: PageIteratorCallback = (data) => {
      eventIds.push(data.id);
      return true;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageIterator = new PageIterator(microsoftClient as any, response, callback);

    await pageIterator.iterate();

    return {
      fullEvents: false,
      calendarEventIds: eventIds,
      nextSyncCursor: pageIterator.getDeltaLink() || '',
    };
  } catch (error) {
    throw parseMicrosoftCalendarError(error as { statusCode?: number; message: string });
  }
}

// Class-based wrapper for callers that prefer the original API shape.
export class MicrosoftCalendarGetEventsService {
  constructor(
    private readonly getMicrosoftClient: (
      id: string,
    ) => Promise<{ api: (path: string) => { version: (v: string) => { get: () => Promise<PageCollection> } } }>,
  ) {}

  public async getCalendarEvents(
    connectedAccount: ConnectedAccountRef,
    syncCursor?: string,
  ): Promise<GetCalendarEventsResponse> {
    return microsoftCalendarGetEvents(
      connectedAccount,
      this.getMicrosoftClient,
      syncCursor,
    );
  }
}

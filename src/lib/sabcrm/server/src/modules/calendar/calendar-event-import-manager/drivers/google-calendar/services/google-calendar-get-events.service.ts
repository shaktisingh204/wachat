import 'server-only';

import { type GaxiosError } from 'gaxios';
import { google, type calendar_v3 as calendarV3 } from 'googleapis';

import { formatGoogleCalendarEvents } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/google-calendar/utils/format-google-calendar-event.util';
import { parseGaxiosError } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/google-calendar/utils/parse-gaxios-error.util';
import { parseGoogleCalendarError } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/google-calendar/utils/parse-google-calendar-error.util';
import { type GetCalendarEventsResponse } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/services/calendar-get-events.service';

// PORT-NOTE: GoogleOAuth2ClientProvider and ConnectedAccountEntity are kept as
// lightweight type references — actual OAuth token retrieval must be wired
// through SabNode's connected-account layer.

export type ConnectedAccountRef = {
  provider: string;
  id: string;
};

export type GoogleOAuth2Client = ReturnType<typeof google.auth.OAuth2.prototype.constructor extends new (...args: never[]) => infer R ? () => R : never>;

// PORT-NOTE: getGoogleOAuth2Client must be supplied by the call-site (no NestJS DI).
// Pass a function that accepts the connectedAccountId and returns an authenticated OAuth2 client.
export async function googleCalendarGetEvents(
  connectedAccount: ConnectedAccountRef,
  getOAuth2Client: (id: string) => Promise<Parameters<typeof google.calendar>[0]['auth']>,
  syncCursor?: string,
): Promise<GetCalendarEventsResponse> {
  const oAuth2Client = await getOAuth2Client(connectedAccount.id);

  const googleCalendarClient = google.calendar({
    version: 'v3',
    auth: oAuth2Client,
  });

  let nextSyncToken: string | null | undefined;
  let nextPageToken: string | undefined;
  const events: calendarV3.Schema$Event[] = [];

  let hasMoreEvents = true;

  while (hasMoreEvents) {
    const googleCalendarEvents = await googleCalendarClient.events
      .list({
        calendarId: 'primary',
        maxResults: 500,
        singleEvents: true,
        syncToken: syncCursor,
        pageToken: nextPageToken,
        showDeleted: true,
      })
      .catch(async (error: GaxiosError) => {
        handleGoogleCalendarError(error);

        return {
          data: {
            items: [],
            nextSyncToken: undefined,
            nextPageToken: undefined,
          },
        };
      });

    nextSyncToken = googleCalendarEvents.data.nextSyncToken;
    nextPageToken = googleCalendarEvents.data.nextPageToken || undefined;

    const { items } = googleCalendarEvents.data;

    if (!items || items.length === 0) {
      break;
    }

    events.push(...items);

    if (!nextPageToken) {
      hasMoreEvents = false;
    }
  }

  return {
    fullEvents: true,
    calendarEvents: formatGoogleCalendarEvents(events),
    nextSyncCursor: nextSyncToken || '',
  };
}

function handleGoogleCalendarError(error: GaxiosError): void {
  if (
    error.code &&
    [
      'ECONNRESET',
      'ENOTFOUND',
      'ECONNABORTED',
      'ETIMEDOUT',
      'ERR_NETWORK',
    ].includes(error.code)
  ) {
    throw parseGaxiosError(error);
  }
  if (error.response?.status !== 410) {
    const googleCalendarError = {
      code: error.response?.status,
      reason:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error.response?.data as any)?.error?.errors?.[0].reason ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error.response?.data as any)?.error ||
        '',
      message:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error.response?.data as any)?.error?.errors?.[0].message ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (error.response?.data as any)?.error_description ||
        '',
    };

    throw parseGoogleCalendarError(googleCalendarError);
  }
}

// Class-based wrapper for callers that prefer the original API shape.
export class GoogleCalendarGetEventsService {
  constructor(
    private readonly getOAuth2Client: (
      id: string,
    ) => Promise<Parameters<typeof google.calendar>[0]['auth']>,
  ) {}

  public async getCalendarEvents(
    connectedAccount: ConnectedAccountRef,
    syncCursor?: string,
  ): Promise<GetCalendarEventsResponse> {
    return googleCalendarGetEvents(
      connectedAccount,
      this.getOAuth2Client,
      syncCursor,
    );
  }
}

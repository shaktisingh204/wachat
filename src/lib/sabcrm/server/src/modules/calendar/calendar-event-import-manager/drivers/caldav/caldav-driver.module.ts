// module-wiring: NestJS CalDavDriverModule → SabNode registry
// Re-exports the ported pieces that this NestJS module wired together.
//
// NestJS module imports that have no Next.js equivalent:
//   SecureHttpClientModule  → inline SSRF-safe fetch in caldav-client.service
//   TwentyConfigModule      → process.env / Next.js env vars
//   ConnectedAccountTokenEncryptionModule → caldav-client.provider handles decryption
//   TypeOrmModule<ConnectedAccountEntity> → MongoDB collection in caldav-client.provider

export {
  getCalDavClient,
  type CalDavConnectionParams,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/services/caldav-client.service";

export {
  getCalDavClientForConnectedAccount,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/providers/caldav-client.provider";

export {
  listEventCalendars,
  fetchEvents,
  type CalendarSyncResult,
  type FetchEventsOptions,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/services/caldav-fetch-events.service";

export {
  getCalendarEvents,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/caldav/services/caldav-get-events.service";

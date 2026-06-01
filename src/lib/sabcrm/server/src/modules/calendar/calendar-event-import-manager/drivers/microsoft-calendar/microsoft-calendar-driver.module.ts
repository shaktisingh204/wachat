// PORT-NOTE: NestJS module wiring — no equivalent in Next.js.
// This registry re-exports the services that the MicrosoftCalendarDriverModule provided.
// In SabNode, consumers import these services directly; no DI container is needed.

export { MicrosoftCalendarGetEventsService } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/microsoft-calendar/services/microsoft-calendar-get-events.service';
export { MicrosoftCalendarImportEventsService } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/microsoft-calendar/services/microsoft-calendar-import-events.service';

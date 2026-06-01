// PORT-NOTE: NestJS module wiring — no equivalent in Next.js.
// This registry re-exports the services that the GoogleCalendarDriverModule provided.
// In SabNode, consumers import these services directly; no DI container is needed.

export { GoogleCalendarGetEventsService } from '@/lib/sabcrm/server/src/modules/calendar/calendar-event-import-manager/drivers/google-calendar/services/google-calendar-get-events.service';

// module-wiring: CalendarEventParticipantManagerModule → SabNode registry
// NestJS DI has no Next.js equivalent — this re-exports the ported pieces.

// Core service
export {
  upsertAndDeleteCalendarEventParticipants,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/services/calendar-event-participant.service";

// Job
export type {
  CalendarEventParticipantMatchParticipantJobData,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/jobs/calendar-event-participant-match-participant.job";
export {
  handleCalendarEventParticipantMatchParticipantJob,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/jobs/calendar-event-participant-match-participant.job";

// Listeners
export {
  handlePersonCreatedForCalendarParticipants,
  handlePersonUpdatedForCalendarParticipants,
  handlePersonDestroyedForCalendarParticipants,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/listeners/calendar-event-participant-person.listener";

export {
  handleWorkspaceMemberCreatedForCalendarParticipants,
  handleWorkspaceMemberUpdatedForCalendarParticipants,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/listeners/calendar-event-participant-workspace-member.listener";

export {
  handleCalendarEventParticipantMatchedEvent,
} from "@/lib/sabcrm/server/src/modules/calendar/calendar-event-participant-manager/listeners/calendar-event-participant.listener";

// PORT-NOTE: Original module also wired:
//   - ContactCreationManagerModule  (src/lib/sabcrm/server/src/modules/contact-creation-manager/)
//   - MatchParticipantModule         (src/lib/sabcrm/server/src/modules/match-participant/)
//   - WorkspaceCacheModule           (engine layer, no Next equivalent)
//   - FeatureFlagService             (engine layer)

// PORT-NOTE: NestJS @Module wiring has no Next.js equivalent.
// This registry re-exports the ported pieces that the original module wired together,
// preserving the same public surface for cross-module imports.

export { CalendarChannelMetadataService } from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/calendar-channel-metadata.service';
export {
  CalendarChannelException,
  CalendarChannelExceptionCode,
} from '@/lib/sabcrm/server/src/engine/metadata-modules/calendar-channel/calendar-channel.exception';
// PORT-NOTE: CalendarChannelResolver (GraphQL) and CalendarChannelGraphqlApiExceptionInterceptor
// are NestJS-specific; they will be ported separately as server actions / API route handlers
// when resolver/action batch files arrive. ConnectedAccountMetadataModule and
// PermissionsModule are registered via their own batch mappings.

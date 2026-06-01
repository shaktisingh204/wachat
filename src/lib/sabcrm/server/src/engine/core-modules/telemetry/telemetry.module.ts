// PORT-NOTE: NestJS module → SabNode registry/index.
// TelemetryModule wired: TelemetryService (exported).
// No DI container in Next.js; re-export the ported service.

export { publishTelemetry } from '@/lib/sabcrm/server/src/engine/core-modules/telemetry/telemetry.service';

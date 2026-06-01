import 'server-only';

// PORT-NOTE: NestJS @Injectable service → plain exported functions.
// NestJS DI (TwentyConfigService, SecureHttpClientService) removed.
// Config is read from process.env directly.
// HTTP calls use native fetch (no axios/http-client wrapper needed in Next.js).

import { type TelemetryEventType } from '@/lib/sabcrm/server/src/engine/core-modules/telemetry/telemetry-event.type';

const USER_SIGNUP_EVENT_NAME = 'user.signup' as const;

type TelemetrySignUpEvent = {
  action: typeof USER_SIGNUP_EVENT_NAME;
  events: TelemetryEventType[];
};

type TelemetryEventPayload = TelemetrySignUpEvent;

const TELEMETRY_BASE_URL = 'https://twenty-telemetry.com/api/v2';

/**
 * Publish a telemetry event batch to the Twenty telemetry endpoint.
 *
 * Respects the `TELEMETRY_ENABLED` env var (defaults off).
 * Never throws — failures are swallowed and reported via the return value.
 */
export async function publishTelemetry(
  payload: TelemetryEventPayload,
): Promise<{ success: boolean }> {
  if (process.env.TELEMETRY_ENABLED !== 'true') {
    return { success: true };
  }

  try {
    await Promise.all(
      payload.events.map((event) =>
        fetch(`${TELEMETRY_BASE_URL}/selfHostingEvent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: payload.action, ...event }),
        }),
      ),
    );
  } catch {
    return { success: false };
  }

  return { success: true };
}

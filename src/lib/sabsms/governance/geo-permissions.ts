/**
 * SabSMS v3.4 — geo permissions.
 *
 * A structured country allow/deny gate (the "SMS Geo Permissions" feature
 * Twilio/Plivo/AWS ship). Plugged into the channel pre-flight: a blocked
 * country is rejected BEFORE any provider charge, and — because it lives
 * in the one pre-flight gate — it applies across SMS/WhatsApp/voice alike.
 *
 * `evaluateGeo` is pure (unit-tested with no IO). The default config
 * loader reads `sabsms_settings.geoPermissions` and is dynamic-imported so
 * this module stays light for tests.
 */

import type { SabsmsGeoPermissions } from '../types';

export type GeoVerdict = { allow: true } | { allow: false; reason: string };

/**
 * Decide whether a confidently-resolved destination country is permitted.
 *
 * NOTE: callers must skip this check when the country is unresolved
 * (`countryFromE164` returned ''), because we can't make a defensible
 * decision and the engine resolves the true country at send time anyway.
 */
export function evaluateGeo(
  country: string,
  config: SabsmsGeoPermissions,
): GeoVerdict {
  const cc = country.toUpperCase();
  const listed = config.countries.some((c) => c.toUpperCase() === cc);

  switch (config.mode) {
    case 'allow_all':
      return { allow: true };
    case 'allowlist':
      return listed ? { allow: true } : { allow: false, reason: 'geo_not_allowed' };
    case 'denylist':
      return listed ? { allow: false, reason: 'geo_blocked' } : { allow: true };
    default:
      // Unknown mode — fail open rather than silently dropping traffic.
      return { allow: true };
  }
}

/** Load a workspace's geo config, or `undefined` (→ allow all). */
export async function loadGeoConfig(
  workspaceId: string,
): Promise<SabsmsGeoPermissions | undefined> {
  const { getSabsmsCollections } = await import('../db/collections');
  const { cols } = await getSabsmsCollections();
  const settings = await cols.settings.findOne({ workspaceId });
  return settings?.geoPermissions;
}

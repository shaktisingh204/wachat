/**
 * SabSMS developer-key scopes — CLIENT-SAFE module (no Node APIs).
 *
 * Split out of `./core` so client components (api-keys page, docs
 * pages) can import the scope catalogue without dragging `node:crypto`
 * into the browser bundle. `./core` re-exports everything here.
 */

export const SABSMS_API_SCOPES = [
  'messages:send',
  'messages:read',
  'otp',
  'webhooks:manage',
  'analytics:read',
] as const;

export type SabsmsApiScope = (typeof SABSMS_API_SCOPES)[number];

export function isSabsmsApiScope(s: string): s is SabsmsApiScope {
  return (SABSMS_API_SCOPES as readonly string[]).includes(s);
}

/** True when `granted` satisfies `required` (no wildcard — explicit only). */
export function hasScope(granted: readonly string[], required: SabsmsApiScope): boolean {
  return granted.includes(required);
}

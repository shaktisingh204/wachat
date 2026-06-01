/**
 * SabCRM engine configuration + shared constants.
 *
 * SabCRM runs the vendored Twenty stack as a standalone engine
 * (`services/sabcrm/`): a NestJS API + BullMQ worker that also serves the
 * built front SPA. The Next.js app talks to it over HTTP for server-side
 * concerns (SSO handoff, health) and embeds its SPA in the browser.
 *
 * Mirrors the SabWa engine pattern (`src/lib/sabwa/constants.ts`).
 */

export interface SabcrmEngineConfig {
  /** Server-side base URL for the Twenty engine API (NestJS). */
  engineUrl: string;
  /** Shared bearer token for privileged Next ↔ engine calls. */
  engineToken: string;
  /** Browser-facing URL of the Twenty SPA (embedded via iframe). */
  publicUrl: string;
}

/** Default ports — remapped off :3000 so they never collide with Next dev. */
export const SABCRM_DEFAULT_ENGINE_PORT = 4300;

/**
 * Resolve the SabCRM engine connection config from environment.
 * Server-side only — relies on non-public env vars (except publicUrl).
 */
export function getSabcrmEngineConfig(): SabcrmEngineConfig {
  const engineUrl =
    process.env.SABCRM_ENGINE_URL ?? `http://127.0.0.1:${SABCRM_DEFAULT_ENGINE_PORT}`;
  const engineToken = process.env.SABCRM_ENGINE_TOKEN ?? '';
  const publicUrl =
    process.env.NEXT_PUBLIC_SABCRM_URL ??
    `http://localhost:${SABCRM_DEFAULT_ENGINE_PORT}`;

  return { engineUrl, engineToken, publicUrl };
}

/**
 * Browser-safe public URL of the SabCRM SPA. Safe to call in client
 * components — reads only the `NEXT_PUBLIC_` variable.
 */
export function getSabcrmPublicUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SABCRM_URL ??
    `http://localhost:${SABCRM_DEFAULT_ENGINE_PORT}`
  );
}

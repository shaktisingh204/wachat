/**
 * SabFlow feature flags — inlined at build time from `NEXT_PUBLIC_*` env vars.
 *
 * All three flags are `NEXT_PUBLIC_*` so they are available on both server
 * and client. The values collapse to boolean literals after tree-shaking,
 * meaning the disabled branch of any `if (SABFLOW_COLLAB_ENABLED)` guard is
 * completely removed from the final bundle.
 *
 * Usage:
 *   import { SABFLOW_COLLAB_ENABLED } from '@/lib/sabflow/features';
 *   if (SABFLOW_COLLAB_ENABLED) { ... }
 *
 * Env vars are documented in `.env.example` under the
 * "SabFlow — feature flags (Phase C.8)" section.
 */

/** Multiplayer presence layer: avatar stack, remote cursors, typing indicators. */
export const SABFLOW_COLLAB_ENABLED =
  process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_SABFLOW_COLLAB_ENABLED === 'TRUE';

/** Execution playback / step-replay UI. */
export const SABFLOW_PLAYBACK_ENABLED =
  process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED === 'true' ||
  process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED === '1' ||
  process.env.NEXT_PUBLIC_SABFLOW_PLAYBACK_ENABLED === 'TRUE';

/** Block marketplace tab in the sidebar. On by default — set to 'false' to hide. */
export const SABFLOW_MARKETPLACE_ENABLED =
  process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED !== 'false' &&
  process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED !== '0' &&
  process.env.NEXT_PUBLIC_SABFLOW_MARKETPLACE_ENABLED !== 'FALSE';

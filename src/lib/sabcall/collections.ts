import 'server-only';

/**
 * SabCall Mongo collection names — the single source of truth shared by the
 * server actions (`sabcall.actions.ts`) and the project/setup actions.
 *
 * Every collection is scoped by `workspaceId` (the selected `kind:'call'`
 * project `_id`). The Rust `sabcall-*` crates mirror these same collection
 * names so the future engine path reads the same data.
 */
export const SABCALL_COLLECTIONS = {
  dids: 'sabcall_dids',
  calls: 'sabcall_calls',
  ivrs: 'sabcall_ivrs',
  queues: 'sabcall_queues',
  voicemail: 'sabcall_voicemail',
  agentsPresence: 'sabcall_agents_presence',
} as const;

export type SabcallCollection =
  (typeof SABCALL_COLLECTIONS)[keyof typeof SABCALL_COLLECTIONS];

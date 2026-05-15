// @ts-check
/**
 * RPC: `setPresence`
 *
 * Update presence (typing / recording / available / unavailable / paused)
 * either globally for the account or scoped to a specific chat JID.
 *
 * params: { sessionId, jid, kind: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused' }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

const VALID = new Set(['available', 'unavailable', 'composing', 'recording', 'paused']);

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, jid, kind } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (!jid || typeof jid !== 'string') throw new Error('jid is required');
  if (typeof kind !== 'string' || !VALID.has(kind)) {
    throw new Error(`kind must be one of: ${[...VALID].join(', ')}`);
  }
  return sm.setPresence(sessionId, jid, kind);
}

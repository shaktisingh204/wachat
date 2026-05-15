// @ts-check
/**
 * RPC: `addParticipants`
 *
 * params: { sessionId, groupJid, jids: string[] }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, groupJid, jids } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (!groupJid || typeof groupJid !== 'string') throw new Error('groupJid is required');
  if (!Array.isArray(jids) || jids.length === 0) {
    throw new Error('jids must be a non-empty array');
  }
  return sm.groupParticipantsUpdate(sessionId, groupJid, jids, 'add');
}

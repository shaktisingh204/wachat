// @ts-check
/**
 * RPC: `getInviteCode`
 *
 * params: { sessionId, groupJid }
 * returns: { code }   (suffix appended to https://chat.whatsapp.com/)
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, groupJid } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (!groupJid || typeof groupJid !== 'string') throw new Error('groupJid is required');
  return sm.groupInviteCode(sessionId, groupJid);
}

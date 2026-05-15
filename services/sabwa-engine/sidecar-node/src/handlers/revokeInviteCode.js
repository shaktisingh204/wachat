// @ts-check
/**
 * RPC: `revokeInviteCode`
 *
 * Rotates the group invite link. Returns the new code.
 *
 * params: { sessionId, groupJid }
 * returns: { code }
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
  return sm.groupRevokeInvite(sessionId, groupJid);
}

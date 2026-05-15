// @ts-check
/**
 * RPC: `markRead`
 *
 * Mark a chat as read on the user's WhatsApp account.
 *
 * params: { sessionId: string, chatJid: string }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, chatJid } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (!chatJid || typeof chatJid !== 'string') throw new Error('chatJid is required');
  return sm.markRead(sessionId, chatJid);
}

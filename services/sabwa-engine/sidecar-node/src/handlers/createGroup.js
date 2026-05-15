// @ts-check
/**
 * RPC: `createGroup`
 *
 * Create a new WhatsApp group.
 *
 * params: { sessionId: string, subject: string, participants: string[] }
 * returns: { groupJid, meta }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, subject, participants } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (!subject || typeof subject !== 'string') throw new Error('subject is required');
  if (!Array.isArray(participants) || participants.length === 0) {
    throw new Error('participants must be a non-empty array of JIDs');
  }
  return sm.createGroup(sessionId, subject, participants);
}

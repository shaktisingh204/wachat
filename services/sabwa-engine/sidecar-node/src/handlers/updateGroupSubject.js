// @ts-check
/**
 * RPC: `updateGroupSubject`
 *
 * params: { sessionId, groupJid, subject }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, groupJid, subject } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (!groupJid || typeof groupJid !== 'string') throw new Error('groupJid is required');
  if (!subject || typeof subject !== 'string') throw new Error('subject is required');
  return sm.groupUpdateSubject(sessionId, groupJid, subject);
}

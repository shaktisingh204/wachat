// @ts-check
/**
 * RPC: `getStatus`
 *
 * Synchronous-style status read used by the parent to verify whether a
 * session is currently held in memory and what its connection state is.
 *
 * params: { sessionId: string }
 * returns: { status: 'unknown' | 'pending' | 'connected' | 'logged_out' | 'banned' | 'error', pairMethod?, lastError? }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  return sm.getStatus(sessionId);
}

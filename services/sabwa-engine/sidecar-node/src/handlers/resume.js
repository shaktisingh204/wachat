// @ts-check
/**
 * RPC: `resume`
 *
 * Bring a previously-paired session back online. The parent passes the
 * base64 `authState` snapshot it received in the earlier `connected`
 * event; the sidecar rehydrates it to disk and starts the socket.
 *
 * params: { sessionId: string, authState?: base64 }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, authState } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  return sm.resume(sessionId, { authState });
}

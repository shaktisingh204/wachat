// @ts-check
/**
 * RPC: `logout`
 *
 * Close the Baileys socket, send a `logout` to WhatsApp, and wipe the
 * per-session auth state from disk. Emits a final `status` event with
 * `logged_out`.
 *
 * params: { sessionId: string }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  return sm.logout(sessionId);
}

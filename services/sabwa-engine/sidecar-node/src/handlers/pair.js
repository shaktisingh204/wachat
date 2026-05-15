// @ts-check
/**
 * RPC: `pair`
 *
 * Start a new Baileys pairing flow. Two modes:
 *   - `qr`   — emits `qr` events on stdout; user scans in WhatsApp.
 *   - `code` — emits a single `pair_code` event with an 8-char code.
 *
 * params:
 *   { sessionId: string, method: 'qr' | 'code', phoneE164?: string,
 *     authState?: base64 }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, method, phoneE164, authState } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (method !== 'qr' && method !== 'code') throw new Error("method must be 'qr' or 'code'");
  return sm.pair(sessionId, { method, phoneE164, authState });
}

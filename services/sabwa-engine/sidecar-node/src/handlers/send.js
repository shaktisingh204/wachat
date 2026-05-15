// @ts-check
/**
 * RPC: `send`
 *
 * Send a single message. Payload shape mirrors `sabwa_messages` rows.
 *
 * params: { sessionId: string, chatJid: string, payload: { type, ... } }
 *
 * Supported `payload.type` values:
 *   text | image | video | audio | voice | document | sticker | location |
 *   contact | react
 *
 * For media types either `payload.data` (base64) or `payload.url` must be
 * supplied. For `react`, `payload.targetKey` is the Baileys WAMessageKey
 * of the message being reacted to.
 *
 * Returns: { messageId, serverTs }
 */

/** @typedef {import('../session-manager.js').SessionManager} SessionManager */

/**
 * @param {SessionManager} sm
 * @param {any} params
 */
export async function handle(sm, params) {
  const { sessionId, chatJid, payload } = params ?? {};
  if (!sessionId || typeof sessionId !== 'string') throw new Error('sessionId is required');
  if (!chatJid || typeof chatJid !== 'string') throw new Error('chatJid is required');
  if (!payload || typeof payload !== 'object') throw new Error('payload is required');
  return sm.send(sessionId, { chatJid, payload });
}

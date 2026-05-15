// @ts-check
/**
 * SessionManager — owns a Map<sessionId, BaileysSocket>.
 *
 * Each session is an independent Baileys multi-device socket. The manager:
 *   - Boots the socket (`pair` / `resume`).
 *   - Wires Baileys event listeners to the sidecar's `writeEvent` channel
 *     so the Rust parent (which mirrors `SabwaEvent`) receives a stable
 *     event stream.
 *   - Auto-reconnects with exponential backoff on `connection close` unless
 *     the disconnect reason was `loggedOut`.
 *   - Persists auth state to disk using Baileys' multi-file helper (per-
 *     session subdir under `auth-state/`).
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';

import { writeEvent } from './protocol.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_ROOT = path.resolve(__dirname, '..', 'auth-state');

/**
 * Map a Baileys `presence` string to the limited vocabulary the Rust side
 * understands (see `services/sabwa-engine/src/realtime/events.rs`).
 *
 * @param {string} p
 * @returns {string}
 */
function normalisePresence(p) {
  switch (p) {
    case 'available':
    case 'unavailable':
    case 'composing':
    case 'recording':
    case 'paused':
      return p;
    default:
      return 'available';
  }
}

/**
 * Re-encode an arbitrary value as a base64 JSON blob so the Rust parent
 * can opaquely persist it.
 *
 * @param {unknown} value
 * @returns {string}
 */
function toBase64Json(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

/** Snapshot the on-disk multi-file auth state into a single base64 blob. */
function snapshotAuthDir(dir) {
  /** @type {Record<string, string>} */
  const files = {};
  try {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      try {
        files[name] = readFileSync(full, 'utf8');
      } catch {
        // skip unreadable entries (likely a stale lock file)
      }
    }
  } catch {
    // dir might not exist yet — return an empty snapshot
  }
  return toBase64Json(files);
}

/**
 * Public API exposed to RPC handlers.
 */
export class SessionManager {
  constructor({ logger } = {}) {
    /** @type {Map<string, SessionEntry>} */
    this.sessions = new Map();
    this.logger = logger ?? console;
    mkdirSync(AUTH_ROOT, { recursive: true });
  }

  /**
   * @param {string} sessionId
   * @returns {SessionEntry}
   */
  _require(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) {
      throw new Error(`unknown session: ${sessionId}`);
    }
    return entry;
  }

  /** Return current connection state without touching the socket. */
  getStatus(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (!entry) return { status: 'unknown' };
    return {
      status: entry.status,
      pairMethod: entry.pairMethod,
      lastError: entry.lastError ?? null,
    };
  }

  /**
   * Start a brand-new pairing flow. If `authState` is provided it is
   * treated as a base64 JSON snapshot from a previous `connected` event
   * (so callers can implement headless resume via the same entry point).
   *
   * @param {string} sessionId
   * @param {{ method: 'qr' | 'code', phoneE164?: string, authState?: string }} params
   */
  async pair(sessionId, { method, phoneE164, authState }) {
    if (this.sessions.has(sessionId)) {
      throw new Error(`session already exists: ${sessionId}`);
    }
    if (method === 'code' && !phoneE164) {
      throw new Error("'code' pair method requires phoneE164");
    }
    const dir = path.join(AUTH_ROOT, sessionId);
    mkdirSync(dir, { recursive: true });
    if (authState) {
      this._hydrateAuthDir(dir, authState);
    }
    const entry = await this._spawnSocket(sessionId, { dir, method, phoneE164 });
    return { sessionId, status: entry.status };
  }

  /**
   * Resume an existing session. If an `authState` blob is supplied it is
   * rehydrated to disk first; otherwise the existing per-session subdir
   * is reused.
   *
   * @param {string} sessionId
   * @param {{ authState?: string }} params
   */
  async resume(sessionId, { authState } = {}) {
    if (this.sessions.has(sessionId)) {
      return { sessionId, status: this.sessions.get(sessionId).status };
    }
    const dir = path.join(AUTH_ROOT, sessionId);
    mkdirSync(dir, { recursive: true });
    if (authState) {
      this._hydrateAuthDir(dir, authState);
    }
    const entry = await this._spawnSocket(sessionId, { dir, method: 'qr', phoneE164: null });
    return { sessionId, status: entry.status };
  }

  /**
   * @param {string} dir
   * @param {string} authStateB64
   */
  _hydrateAuthDir(dir, authStateB64) {
    try {
      const raw = Buffer.from(authStateB64, 'base64').toString('utf8');
      const files = JSON.parse(raw);
      if (files && typeof files === 'object') {
        for (const [name, contents] of Object.entries(files)) {
          writeFileSync(path.join(dir, name), /** @type {string} */ (contents));
        }
      }
    } catch (err) {
      this.logger.warn?.({ err }, 'failed to hydrate auth state, starting fresh');
    }
  }

  /**
   * Internal: spin up a Baileys socket and wire all event listeners.
   *
   * @param {string} sessionId
   * @param {{ dir: string, method: 'qr' | 'code', phoneE164: string | null }} opts
   * @returns {Promise<SessionEntry>}
   */
  async _spawnSocket(sessionId, { dir, method, phoneE164 }) {
    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: undefined }));

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.appropriate('SabWa'),
      printQRInTerminal: false,
      version,
      logger: silentBaileysLogger(),
    });

    /** @type {SessionEntry} */
    const entry = {
      sock,
      status: 'pending',
      pairMethod: method,
      phoneE164: phoneE164 ?? null,
      dir,
      saveCreds,
      reconnectAttempts: 0,
      reconnectTimer: null,
      lastError: null,
      pairCodeRequested: false,
    };
    this.sessions.set(sessionId, entry);

    this._wireEvents(sessionId, entry);
    return entry;
  }

  /**
   * Wire every Baileys event of interest to a `writeEvent` call.
   *
   * @param {string} sessionId
   * @param {SessionEntry} entry
   */
  _wireEvents(sessionId, entry) {
    const sock = entry.sock;

    sock.ev.on('creds.update', () => {
      entry.saveCreds().catch((err) => {
        this.logger.warn?.({ err }, 'saveCreds failed');
      });
    });

    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        writeEvent({
          event: 'qr',
          sessionId,
          payload: { qr, ts: Date.now() },
        });
        // If the caller asked for a pair code, request it once the socket
        // is far enough along to accept it.
        if (entry.pairMethod === 'code' && entry.phoneE164 && !entry.pairCodeRequested) {
          entry.pairCodeRequested = true;
          try {
            const code = await sock.requestPairingCode(entry.phoneE164);
            const formatted = formatPairCode(code);
            writeEvent({
              event: 'pair_code',
              sessionId,
              payload: { code: formatted, ts: Date.now() },
            });
          } catch (err) {
            this.logger.warn?.({ err }, 'requestPairingCode failed');
            entry.pairCodeRequested = false;
          }
        }
      }

      if (connection === 'open') {
        entry.status = 'connected';
        entry.reconnectAttempts = 0;
        entry.lastError = null;
        writeEvent({
          event: 'status',
          sessionId,
          payload: { status: 'connected', ts: Date.now() },
        });
        // Snapshot creds for the parent to persist.
        writeEvent({
          event: 'connected',
          sessionId,
          payload: {
            authState: snapshotAuthDir(entry.dir),
            phoneE164: sock.user?.id?.split(':')[0] ?? entry.phoneE164,
            pushName: sock.user?.name ?? null,
            ts: Date.now(),
          },
        });
      }

      if (connection === 'close') {
        const statusCode =
          /** @type {{ output?: { statusCode?: number } }} */ (lastDisconnect?.error)?.output
            ?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        entry.lastError = lastDisconnect?.error
          ? String(/** @type {Error} */ (lastDisconnect.error).message ?? lastDisconnect.error)
          : null;

        if (loggedOut) {
          entry.status = 'logged_out';
          writeEvent({
            event: 'status',
            sessionId,
            payload: { status: 'logged_out', ts: Date.now() },
          });
          this.sessions.delete(sessionId);
          try {
            rmSync(entry.dir, { recursive: true, force: true });
          } catch {
            // ignore
          }
        } else {
          entry.status = 'pending';
          writeEvent({
            event: 'status',
            sessionId,
            payload: {
              status: 'pending',
              detail: entry.lastError ?? 'disconnected',
              ts: Date.now(),
            },
          });
          this._scheduleReconnect(sessionId, entry);
        }
      }
    });

    sock.ev.on('messages.upsert', (u) => {
      for (const m of u.messages ?? []) {
        writeEvent({
          event: 'messages.upsert',
          sessionId,
          payload: { type: u.type, message: m },
        });
      }
    });

    sock.ev.on('messages.update', (updates) => {
      for (const upd of updates ?? []) {
        writeEvent({
          event: 'messages.update',
          sessionId,
          payload: upd,
        });
      }
    });

    sock.ev.on('message-receipt.update', (updates) => {
      for (const upd of updates ?? []) {
        writeEvent({
          event: 'message_receipt.update',
          sessionId,
          payload: upd,
        });
      }
    });

    sock.ev.on('chats.upsert', (chats) => {
      for (const chat of chats ?? []) {
        writeEvent({ event: 'chats.upsert', sessionId, payload: chat });
      }
    });

    sock.ev.on('chats.update', (chats) => {
      for (const chat of chats ?? []) {
        writeEvent({ event: 'chats.update', sessionId, payload: chat });
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts ?? []) {
        writeEvent({ event: 'contacts.upsert', sessionId, payload: c });
      }
    });

    sock.ev.on('contacts.update', (contacts) => {
      for (const c of contacts ?? []) {
        writeEvent({ event: 'contacts.update', sessionId, payload: c });
      }
    });

    sock.ev.on('groups.upsert', (groups) => {
      for (const g of groups ?? []) {
        writeEvent({ event: 'groups.upsert', sessionId, payload: g });
      }
    });

    sock.ev.on('groups.update', (groups) => {
      for (const g of groups ?? []) {
        writeEvent({ event: 'groups.update', sessionId, payload: g });
      }
    });

    sock.ev.on('group-participants.update', (u) => {
      writeEvent({ event: 'group_participants.update', sessionId, payload: u });
    });

    sock.ev.on('presence.update', (u) => {
      const id = u.id;
      const presences = u.presences ?? {};
      for (const [participant, info] of Object.entries(presences)) {
        const lastKnown = info?.lastKnownPresence ?? 'available';
        writeEvent({
          event: 'presence.update',
          sessionId,
          payload: {
            chat_jid: id,
            participant,
            presence: normalisePresence(lastKnown),
            ts: Date.now(),
          },
        });
      }
    });
  }

  /**
   * Exponential backoff (1s, 2s, 4s, … capped at 60s).
   *
   * @param {string} sessionId
   * @param {SessionEntry} entry
   */
  _scheduleReconnect(sessionId, entry) {
    if (entry.reconnectTimer) clearTimeout(entry.reconnectTimer);
    const attempt = ++entry.reconnectAttempts;
    const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempt - 1, 6));
    entry.reconnectTimer = setTimeout(async () => {
      entry.reconnectTimer = null;
      // Rebuild the socket against the same auth dir.
      try {
        this.sessions.delete(sessionId);
        await this._spawnSocket(sessionId, {
          dir: entry.dir,
          method: 'qr',
          phoneE164: entry.phoneE164,
        });
      } catch (err) {
        this.logger.warn?.({ err }, 'reconnect failed');
        // Will retry on the next close event.
      }
    }, delayMs);
  }

  /**
   * Build a Baileys message content object from the loosely-typed payload
   * received from the Rust parent.
   *
   * @param {Record<string, unknown>} payload
   */
  _buildContent(payload) {
    const t = String(payload.type ?? payload.kind ?? 'text');
    switch (t) {
      case 'text':
        return { text: String(payload.body ?? payload.text ?? '') };
      case 'image':
        return {
          image: bufferOrUrl(payload),
          caption: optString(payload.caption),
          mimetype: optString(payload.mimetype),
        };
      case 'video':
        return {
          video: bufferOrUrl(payload),
          caption: optString(payload.caption),
          mimetype: optString(payload.mimetype),
          gifPlayback: Boolean(payload.gifPlayback),
        };
      case 'audio':
        return {
          audio: bufferOrUrl(payload),
          mimetype: optString(payload.mimetype) ?? 'audio/mp4',
          ptt: false,
        };
      case 'voice':
        return {
          audio: bufferOrUrl(payload),
          mimetype: optString(payload.mimetype) ?? 'audio/ogg; codecs=opus',
          ptt: true,
        };
      case 'document':
        return {
          document: bufferOrUrl(payload),
          mimetype: optString(payload.mimetype),
          fileName: optString(payload.fileName) ?? 'file',
          caption: optString(payload.caption),
        };
      case 'sticker':
        return { sticker: bufferOrUrl(payload) };
      case 'location':
        return {
          location: {
            degreesLatitude: Number(payload.latitude),
            degreesLongitude: Number(payload.longitude),
            name: optString(payload.name),
            address: optString(payload.address),
          },
        };
      case 'contact':
        return {
          contacts: {
            displayName: String(payload.displayName ?? 'Contact'),
            contacts: Array.isArray(payload.vcards)
              ? payload.vcards.map((v) => ({ vcard: String(v) }))
              : [{ vcard: String(payload.vcard ?? '') }],
          },
        };
      case 'react':
        return {
          react: {
            text: String(payload.emoji ?? ''),
            key: /** @type {object} */ (payload.targetKey),
          },
        };
      default:
        throw new Error(`unsupported payload type: ${t}`);
    }
  }

  /**
   * @param {string} sessionId
   * @param {{ chatJid: string, payload: Record<string, unknown> }} params
   */
  async send(sessionId, { chatJid, payload }) {
    const entry = this._require(sessionId);
    const content = this._buildContent(payload);
    const options = {};
    if (payload && payload.quotedMessage && typeof payload.quotedMessage === 'object') {
      // Baileys accepts a quoted WAMessage directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      /** @type {any} */ (options).quoted = payload.quotedMessage;
    }
    const result = await entry.sock.sendMessage(chatJid, content, options);
    return {
      messageId: result?.key?.id ?? null,
      serverTs: result?.messageTimestamp
        ? Number(result.messageTimestamp) * 1000
        : Date.now(),
    };
  }

  /**
   * @param {string} sessionId
   * @param {string} chatJid
   */
  async markRead(sessionId, chatJid) {
    const entry = this._require(sessionId);
    // Baileys exposes `readMessages` / `chatModify` — we surface a thin
    // wrapper that simply marks the chat as read.
    await entry.sock.chatModify({ markRead: true, lastMessages: [] }, chatJid).catch(() => {});
    return { ok: true };
  }

  /**
   * @param {string} sessionId
   */
  async logout(sessionId) {
    const entry = this._require(sessionId);
    try {
      await entry.sock.logout();
    } finally {
      this.sessions.delete(sessionId);
      try {
        rmSync(entry.dir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
    return { ok: true };
  }

  /**
   * @param {string} sessionId
   * @param {string} jid
   * @param {string} kind — `available` | `unavailable` | `composing` | `recording` | `paused`
   */
  async setPresence(sessionId, jid, kind) {
    const entry = this._require(sessionId);
    await entry.sock.sendPresenceUpdate(/** @type {any} */ (kind), jid);
    return { ok: true };
  }

  async createGroup(sessionId, subject, participants) {
    const entry = this._require(sessionId);
    const meta = await entry.sock.groupCreate(subject, participants);
    return { groupJid: meta?.id ?? null, meta };
  }

  /**
   * @param {string} sessionId
   * @param {string} groupJid
   * @param {string[]} jids
   * @param {'add' | 'remove' | 'promote' | 'demote'} op
   */
  async groupParticipantsUpdate(sessionId, groupJid, jids, op) {
    const entry = this._require(sessionId);
    const res = await entry.sock.groupParticipantsUpdate(groupJid, jids, op);
    return { result: res };
  }

  async groupUpdateSubject(sessionId, groupJid, subject) {
    const entry = this._require(sessionId);
    await entry.sock.groupUpdateSubject(groupJid, subject);
    return { ok: true };
  }

  async groupInviteCode(sessionId, groupJid) {
    const entry = this._require(sessionId);
    const code = await entry.sock.groupInviteCode(groupJid);
    return { code };
  }

  async groupRevokeInvite(sessionId, groupJid) {
    const entry = this._require(sessionId);
    const code = await entry.sock.groupRevokeInvite(groupJid);
    return { code };
  }
}

/**
 * @typedef {object} SessionEntry
 * @property {import('@whiskeysockets/baileys').WASocket} sock
 * @property {'pending' | 'connected' | 'logged_out' | 'banned' | 'error'} status
 * @property {'qr' | 'code'} pairMethod
 * @property {string | null} phoneE164
 * @property {string} dir
 * @property {() => Promise<void>} saveCreds
 * @property {number} reconnectAttempts
 * @property {NodeJS.Timeout | null} reconnectTimer
 * @property {string | null} lastError
 * @property {boolean} pairCodeRequested
 */

/**
 * Pair codes returned from Baileys are 8 raw chars. The UI displays them
 * as `XXXX-XXXX`.
 *
 * @param {string} raw
 */
function formatPairCode(raw) {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return clean;
}

/**
 * Translate a `{ data?: base64, url?: string }` shape into the format
 * Baileys expects (Buffer | { url }).
 *
 * @param {Record<string, unknown>} payload
 */
function bufferOrUrl(payload) {
  if (typeof payload.data === 'string') {
    return Buffer.from(payload.data, 'base64');
  }
  if (typeof payload.url === 'string') {
    return { url: payload.url };
  }
  throw new Error("media payload requires either 'data' (base64) or 'url'");
}

/**
 * @param {unknown} v
 * @returns {string | undefined}
 */
function optString(v) {
  return typeof v === 'string' ? v : undefined;
}

/**
 * Returns a no-op pino-style logger so Baileys doesn't spam stdout.
 * Baileys checks for the `.child` method, so we provide one.
 */
function silentBaileysLogger() {
  /** @type {any} */
  const log = {
    fatal: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    level: 'silent',
  };
  log.child = () => log;
  return log;
}

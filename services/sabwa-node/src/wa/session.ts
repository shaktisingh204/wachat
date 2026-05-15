/**
 * Live Baileys WhatsApp socket lifecycle.
 *
 * `BaileysSession` owns one `WASocket`, wires every event of interest to:
 *   1. Redis pub/sub on channel `sabwa:<sessionId>:events` so the realtime
 *      layer can stream updates to the browser (same channel name the Rust
 *      engine used — see `realtime::events::channel`).
 *   2. The matching `sabwa_*` Mongo collection (sessions / chats /
 *      messages / contacts / groups) so the inbox survives reloads.
 *
 * Pairing
 * -------
 * `start()` boots the socket. `getQr()` returns the most recent QR string
 * Baileys emitted; `getPairCode(phoneE164)` performs the pair-code flow
 * (called once after the first `qr` event so the socket is far enough
 * along to accept `requestPairingCode`). Both artifacts are also mirrored
 * onto the per-session Redis channel so the SSE bridge can fan them out.
 *
 * Reconnection
 * ------------
 * On `connection: 'close'` we look at the disconnect reason. If it's
 * `loggedOut` we treat the session as dead: emit `status=logged_out`,
 * flip the row's status, and stop. For anything else we re-spawn the
 * socket with exponential backoff (1s … cap 60s), preserving the
 * persisted auth state in Mongo.
 *
 * Compatibility shape
 * -------------------
 * `BaileysSession` instances are also a structural superset of the
 * lightweight `BaileysSession` interface declared in `state.ts` (the
 * placeholder used by `state.sessions`) — they expose `sessionId`,
 * `projectId`, `sock`, `status`, `startedAt` — so worker code that
 * accepts that interface keeps compiling. The richer methods (start /
 * stop / getQr / getPairCode / getStatus / sendMessage / logout) live
 * on the class only.
 */

import {
  type AnyMessageContent,
  type BaileysEventMap,
  Browsers,
  BufferJSON,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeWASocket,
  type MiscMessageGenerationOptions,
  type WAMessage,
  type WASocket,
} from '@whiskeysockets/baileys';
import type { Boom } from '@hapi/boom';
import { ObjectId, type Db } from 'mongodb';
import type { Logger } from '../log.js';
import type { RedisHandles } from '../db/redis.js';
import { useMongoAuthState, encryptAuthState } from './auth-state.js';
import { ChatsRepo } from '../db/chats.js';
import { MessagesRepo } from '../db/messages.js';
import type { SabwaMessageType } from '../db/types-shim.js';
import {
  deleteSession as dbDeleteSession,
  updateAuthState as dbUpdateAuthState,
  updateIdentity as dbUpdateIdentity,
  updateStatus as dbUpdateStatus,
} from '../db/sessions.js';

/**
 * Crack a raw Baileys `WAMessage.message` payload into the canonical
 * `(type, body, caption)` triple the `sabwa_messages` collection stores.
 * Best-effort — exotic content types collapse to `'system'`.
 */
function extractInboundMessageShape(msg: Record<string, unknown>): {
  type: SabwaMessageType;
  body?: string;
  caption?: string;
} {
  const m = (msg.message ?? msg) as Record<string, unknown> | null;
  if (!m) return { type: 'system' };
  if (typeof m.conversation === 'string') {
    return { type: 'text', body: m.conversation };
  }
  const ext = m.extendedTextMessage as { text?: unknown } | undefined;
  if (ext && typeof ext.text === 'string') {
    return { type: 'text', body: ext.text };
  }
  const img = m.imageMessage as { caption?: unknown } | undefined;
  if (img) {
    return { type: 'image', caption: typeof img.caption === 'string' ? img.caption : undefined };
  }
  const vid = m.videoMessage as { caption?: unknown } | undefined;
  if (vid) {
    return { type: 'video', caption: typeof vid.caption === 'string' ? vid.caption : undefined };
  }
  const aud = m.audioMessage as { ptt?: unknown } | undefined;
  if (aud) return { type: aud.ptt === true ? 'voice' : 'audio' };
  if (m.documentMessage) {
    const doc = m.documentMessage as { caption?: unknown };
    return {
      type: 'document',
      caption: typeof doc.caption === 'string' ? doc.caption : undefined,
    };
  }
  if (m.stickerMessage) return { type: 'sticker' };
  if (m.locationMessage) return { type: 'location' };
  if (m.contactMessage || m.contactsArrayMessage) return { type: 'contact' };
  if (m.pollCreationMessage) return { type: 'poll' };
  if (m.reactionMessage) return { type: 'reaction' };
  return { type: 'system' };
}

/** Status vocabulary for `BaileysSession.status`. */
export type SessionStatus =
  | 'pending'
  | 'connecting'
  | 'qr'
  | 'pairing'
  | 'connected'
  | 'disconnected'
  | 'logged_out'
  | 'banned'
  | 'error';

export type PairMethod = 'qr' | 'code';

export interface BaileysSessionOptions {
  sessionId: string;
  projectId: string;
  pairMethod: PairMethod;
  phoneE164?: string;
  db: Db;
  redis: RedisHandles;
  authStateKey: Buffer;
  log: Logger;
}

/** Build the Redis pub/sub channel name for a session. Matches the Rust engine. */
export function eventChannel(sessionId: string): string {
  return `sabwa:${sessionId}:events`;
}

/** Pino-shaped silent logger so Baileys doesn't spam stdout. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function silentLogger(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const l: any = {
    fatal: () => {},
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
    trace: () => {},
    level: 'silent',
  };
  l.child = () => l;
  return l;
}

/** Strip `@host` / `:device` and prepend `+` — matches the Rust normaliser. */
function normalizePhoneE164(raw: string): string | undefined {
  const head = raw.trim().split('@')[0]?.split(':')[0] ?? '';
  const digits = head.replace(/[^0-9]/g, '');
  if (digits.length === 0) return undefined;
  return `+${digits}`;
}

function normalizePresence(p: string | undefined): string {
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

/** Format Baileys' raw 8-char pair code as `XXXX-XXXX`. */
function formatPairCode(raw: string): string {
  const clean = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length === 8) return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  return clean;
}

export class BaileysSession {
  readonly sessionId: string;
  readonly projectId: string;
  readonly pairMethod: PairMethod;
  readonly startedAt: Date;
  private phoneE164: string | undefined;

  private readonly db: Db;
  private readonly redis: RedisHandles;
  private readonly authStateKey: Buffer;
  private readonly log: Logger;

  /** Public for compatibility with the lightweight `BaileysSession` interface. */
  sock: WASocket | undefined;
  status: SessionStatus = 'pending';
  private saveCreds: (() => Promise<void>) | undefined;
  private lastQr: string | undefined;
  private lastPairCode: string | undefined;
  private lastConnectedAt: Date | undefined;
  private lastError: string | undefined;

  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pairCodeRequested = false;
  private stopped = false;

  /** Per-jid last profile-pic fetch timestamp (ms). Throttles refetches. */
  private readonly profilePicFetchedAt = new Map<string, number>();

  constructor(opts: BaileysSessionOptions) {
    this.sessionId = opts.sessionId;
    this.projectId = opts.projectId;
    this.pairMethod = opts.pairMethod;
    this.phoneE164 = opts.phoneE164;
    this.db = opts.db;
    this.redis = opts.redis;
    this.authStateKey = opts.authStateKey;
    this.log = opts.log;
    this.startedAt = new Date();
  }

  // --------------------------------------------------------------- public API

  /** Boot the socket. Resolves once Baileys has been wired (not yet connected). */
  async start(): Promise<void> {
    if (this.sock) return;
    this.status = 'connecting';
    await this.spawn();
  }

  /** Tear down the socket without logging out (use to evict from the pool). */
  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      // `end()` closes the websocket; `logout()` would also wipe the
      // device on WhatsApp's side, which is the wrong semantics here.
      this.sock?.end(undefined);
    } catch {
      /* swallow */
    }
    this.sock = undefined;
    this.status = 'disconnected';
  }

  /**
   * Log out on WhatsApp's side, then wipe the local Mongo row.
   * Safe to call even if the socket never connected.
   */
  async logout(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    try {
      await this.sock?.logout();
    } catch (err) {
      this.log.warn({ err, sessionId: this.sessionId }, 'baileys logout rpc failed');
    }
    try {
      this.sock?.end(undefined);
    } catch {
      /* swallow */
    }
    this.sock = undefined;
    this.status = 'logged_out';
    await dbDeleteSession(this.db, this.sessionId).catch((err) => {
      this.log.warn({ err, sessionId: this.sessionId }, 'sabwa_sessions delete failed');
    });
  }

  /** Latest QR string emitted by Baileys (already URL-safe). */
  getQr(): string | undefined {
    return this.lastQr;
  }

  /**
   * Request a pair code for `phoneE164`. The socket must be at least far
   * enough along to have emitted its first `qr` event — Baileys rejects
   * `requestPairingCode` calls before that point. Callers that hit the
   * race should retry after `getQr()` returns truthy.
   */
  async getPairCode(phoneE164: string): Promise<string | undefined> {
    if (this.lastPairCode) return this.lastPairCode;
    if (!this.sock) return undefined;
    try {
      this.pairCodeRequested = true;
      const raw = await this.sock.requestPairingCode(phoneE164);
      this.lastPairCode = formatPairCode(raw);
      // Mirror onto the same channel the QR event uses so the browser
      // SSE listener doesn't need a second subscription.
      await this.publishEvent('pair_code', {
        sessionId: this.sessionId,
        code: this.lastPairCode,
        ts: Date.now(),
      });
      return this.lastPairCode;
    } catch (err) {
      this.pairCodeRequested = false;
      this.log.warn({ err, sessionId: this.sessionId }, 'requestPairingCode failed');
      return undefined;
    }
  }

  /** Cheap snapshot of the session's current status / artifacts. */
  getStatus(): {
    status: SessionStatus;
    qr?: string;
    pairCode?: string;
    lastConnectedAt?: Date;
    lastError?: string;
  } {
    return {
      status: this.status,
      qr: this.lastQr,
      pairCode: this.lastPairCode,
      lastConnectedAt: this.lastConnectedAt,
      lastError: this.lastError,
    };
  }

  /**
   * Thin pass-through for the `BaileysSession` interface in `state.ts`,
   * used by the auto-reply worker. Delegates to the live socket and
   * returns whatever Baileys returned.
   */
  async sendMessage(
    jid: string,
    content: AnyMessageContent,
    options?: MiscMessageGenerationOptions,
  ): Promise<WAMessage | undefined> {
    if (!this.sock) {
      throw new Error(`sendMessage on un-started session ${this.sessionId}`);
    }
    return this.sock.sendMessage(jid, content, options);
  }

  // ---------- group pass-throughs (used by /v1/groups) ----------

  /**
   * Add / remove / promote / demote participants on a group. Mirrors
   * `WASocket.groupParticipantsUpdate` so the `/v1/groups` route can call
   * `session.groupParticipantsUpdate(...)` directly.
   */
  async groupParticipantsUpdate(
    jid: string,
    participants: string[],
    action: 'add' | 'remove' | 'promote' | 'demote',
  ): ReturnType<WASocket['groupParticipantsUpdate']> {
    if (!this.sock) {
      throw new Error(`groupParticipantsUpdate on un-started session ${this.sessionId}`);
    }
    return this.sock.groupParticipantsUpdate(jid, participants, action);
  }

  /** Fetch the current invite code for a group (admin-only). */
  async groupInviteCode(jid: string): Promise<string | undefined> {
    if (!this.sock) {
      throw new Error(`groupInviteCode on un-started session ${this.sessionId}`);
    }
    return this.sock.groupInviteCode(jid);
  }

  /** Leave a group (the linked account exits — does not remove others). */
  async groupLeave(jid: string): Promise<void> {
    if (!this.sock) {
      throw new Error(`groupLeave on un-started session ${this.sessionId}`);
    }
    return this.sock.groupLeave(jid);
  }

  /** Create a new group. Returns Baileys' `GroupMetadata` blob. */
  async groupCreate(
    subject: string,
    participants: string[],
  ): ReturnType<WASocket['groupCreate']> {
    if (!this.sock) {
      throw new Error(`groupCreate on un-started session ${this.sessionId}`);
    }
    return this.sock.groupCreate(subject, participants);
  }

  /** Update a group's subject (admin-only). */
  async groupUpdateSubject(jid: string, subject: string): Promise<void> {
    if (!this.sock) {
      throw new Error(`groupUpdateSubject on un-started session ${this.sessionId}`);
    }
    return this.sock.groupUpdateSubject(jid, subject);
  }

  /** Revoke and re-mint the group invite code (admin-only). */
  async groupRevokeInvite(jid: string): Promise<string | undefined> {
    if (!this.sock) {
      throw new Error(`groupRevokeInvite on un-started session ${this.sessionId}`);
    }
    return this.sock.groupRevokeInvite(jid);
  }

  // ----------------------------------------------------------------- internal

  private async spawn(): Promise<void> {
    const { state: authState, saveCreds } = await useMongoAuthState({
      sessionId: this.sessionId,
      db: this.db,
      authStateKey: this.authStateKey,
      log: this.log,
    });
    this.saveCreds = saveCreds;

    const version = await fetchLatestBaileysVersion()
      .then((r) => r.version)
      .catch(() => undefined);

    const sock = makeWASocket({
      auth: authState,
      // Browser tuple Baileys uses to identify the linked device.
      browser: Browsers.appropriate('SabWa'),
      printQRInTerminal: false,
      version,
      logger: silentLogger(),
      // Pull the full chat/contact/message history on first link so the
      // inbox is hydrated immediately rather than starting empty.
      syncFullHistory: true,
      shouldSyncHistoryMessage: () => true,
      // Stay invisible while the worker is connected — we don't want the
      // linked device to flip the user's presence to "online" just by
      // virtue of the integration being running.
      markOnlineOnConnect: false,
    });

    this.sock = sock;
    this.wireEvents(sock);
  }

  private wireEvents(sock: WASocket): void {
    sock.ev.on('creds.update', () => {
      this.saveCreds?.().catch((err) => {
        this.log.warn({ err, sessionId: this.sessionId }, 'saveCreds failed');
      });
    });

    sock.ev.on('connection.update', (u) => {
      this.handleConnectionUpdate(u).catch((err) => {
        this.log.warn({ err, sessionId: this.sessionId }, 'connection.update handler failed');
      });
    });

    sock.ev.on('messaging-history.set', (payload) => {
      this.persistAndPublish('messaging-history.set', payload).catch((err) => {
        this.log.warn({ err, sessionId: this.sessionId }, 'messaging-history.set failed');
      });
    });

    sock.ev.on('messages.upsert', (u) => {
      for (const m of u.messages ?? []) {
        this.persistAndPublish('messages.upsert', { type: u.type, message: m }).catch(
          (err) => {
            this.log.warn({ err, sessionId: this.sessionId }, 'messages.upsert failed');
          },
        );
      }
    });

    sock.ev.on('messages.update', (updates) => {
      for (const upd of updates) {
        this.persistAndPublish('messages.update', upd).catch((err) => {
          this.log.warn({ err, sessionId: this.sessionId }, 'messages.update failed');
        });
      }
    });

    sock.ev.on('chats.upsert', (chats) => {
      for (const chat of chats) {
        this.persistAndPublish('chats.upsert', chat).catch((err) => {
          this.log.warn({ err, sessionId: this.sessionId }, 'chats.upsert failed');
        });
      }
    });

    sock.ev.on('chats.update', (chats) => {
      for (const chat of chats) {
        this.persistAndPublish('chats.update', chat).catch((err) => {
          this.log.warn({ err, sessionId: this.sessionId }, 'chats.update failed');
        });
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts) {
        this.persistAndPublish('contacts.upsert', c).catch((err) => {
          this.log.warn({ err, sessionId: this.sessionId }, 'contacts.upsert failed');
        });
      }
    });

    sock.ev.on('groups.upsert', (groups) => {
      for (const g of groups) {
        this.persistAndPublish('groups.upsert', g).catch((err) => {
          this.log.warn({ err, sessionId: this.sessionId }, 'groups.upsert failed');
        });
      }
    });

    sock.ev.on('groups.update', (groups) => {
      for (const g of groups) {
        this.persistAndPublish('groups.update', g).catch((err) => {
          this.log.warn({ err, sessionId: this.sessionId }, 'groups.update failed');
        });
      }
    });

    sock.ev.on('presence.update', (u) => {
      const presences = u.presences ?? {};
      for (const [participant, info] of Object.entries(presences)) {
        this.publishEvent('presence.update', {
          sessionId: this.sessionId,
          chat_jid: u.id,
          participant,
          presence: normalizePresence(info?.lastKnownPresence ?? 'available'),
          ts: Date.now(),
        }).catch(() => {});
      }
    });
  }

  private async handleConnectionUpdate(
    u: BaileysEventMap['connection.update'],
  ): Promise<void> {
    const { connection, lastDisconnect, qr } = u;

    if (qr) {
      this.lastQr = qr;
      this.status = 'qr';
      await this.publishEvent('qr', {
        sessionId: this.sessionId,
        qr,
        ts: Date.now(),
      });
      // If the caller asked to pair via 8-digit code instead of QR,
      // request it once the socket is far enough along to accept it.
      if (
        this.pairMethod === 'code' &&
        this.phoneE164 &&
        !this.pairCodeRequested &&
        this.sock
      ) {
        await this.getPairCode(this.phoneE164);
      }
    }

    if (connection === 'open') {
      this.status = 'connected';
      this.reconnectAttempts = 0;
      this.lastError = undefined;
      this.lastConnectedAt = new Date();

      const user = this.sock?.user;
      const learnedPhone = user?.id ? normalizePhoneE164(user.id) : undefined;
      const pushName = user?.name?.trim() || undefined;
      if (learnedPhone) this.phoneE164 = learnedPhone;

      // Persist the auth_state blob (encrypted) eagerly so a restart can
      // resume without re-pairing. We re-serialise here rather than rely
      // solely on `saveCreds` so the row also gets a Binary touch even if
      // no `creds.update` has fired since the last flush.
      await this.persistAuthStateSnapshot().catch((err) => {
        this.log.warn({ err, sessionId: this.sessionId }, 'auth state snapshot failed');
      });

      await dbUpdateStatus(this.db, this.sessionId, 'connected').catch(() => {});
      await dbUpdateIdentity(this.db, this.sessionId, {
        phoneE164: learnedPhone,
        pushName,
      }).catch(() => {});

      await this.publishEvent('status', {
        sessionId: this.sessionId,
        status: 'connected',
        ts: Date.now(),
      });

      // Background bootstrap so the inbox isn't empty for groups and so DPs
      // appear without waiting for the user to open each chat. Both are
      // fire-and-forget — failures only impact cosmetic fields.
      this.syncGroups().catch((err) =>
        this.log.warn({ err, sessionId: this.sessionId }, 'syncGroups failed'),
      );
      this.fillMissingProfilePics().catch((err) =>
        this.log.warn({ err, sessionId: this.sessionId }, 'fillMissingProfilePics failed'),
      );
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      this.lastError = lastDisconnect?.error
        ? String((lastDisconnect.error as Error).message ?? lastDisconnect.error)
        : undefined;

      if (loggedOut || this.stopped) {
        this.status = 'logged_out';
        await dbUpdateStatus(this.db, this.sessionId, 'logged_out').catch(() => {});
        await this.publishEvent('status', {
          sessionId: this.sessionId,
          status: 'logged_out',
          detail: this.lastError,
          ts: Date.now(),
        });
        this.sock = undefined;
        return;
      }

      // Transient — schedule a respawn against the same persisted auth.
      this.status = 'pending';
      await this.publishEvent('status', {
        sessionId: this.sessionId,
        status: 'pending',
        detail: this.lastError ?? 'disconnected',
        ts: Date.now(),
      });
      this.scheduleReconnect();
    }
  }

  /** Exponential backoff: 1s, 2s, 4s, … capped at 60s. */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const attempt = ++this.reconnectAttempts;
    const delayMs = Math.min(60_000, 1_000 * 2 ** Math.min(attempt - 1, 6));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.sock = undefined;
      this.spawn().catch((err) => {
        this.log.warn({ err, sessionId: this.sessionId }, 'reconnect spawn failed');
      });
    }, delayMs);
  }

  private async persistAuthStateSnapshot(): Promise<void> {
    if (!this.sock) return;
    // `WASocket.authState` is the same state object `useMongoAuthState`
    // returned and Baileys has been mutating in-place. We snapshot
    // `creds` here — the keys map is already persisted incrementally on
    // every `keys.set` via the auth-state factory's `flush()`.
    const creds = this.sock.authState.creds;
    const blob = encryptAuthState(
      this.authStateKey,
      Buffer.from(JSON.stringify({ creds }, BufferJSON.replacer), 'utf8'),
    );
    await dbUpdateAuthState(this.db, this.sessionId, blob);
  }

  // ---------------------------------------------------------------- pub/sub

  /**
   * Publish a single event onto the per-session Redis channel.
   *
   * Wire shape matches `realtime/pubsub.ts::SabwaEvent` — a `kind`-tagged
   * object with the payload flattened to the top level so consumers can
   * read `ev.qr` / `ev.code` / `ev.status` directly. (Earlier this method
   * emitted `{event, sessionId, payload}` which the SSE bridge rejected
   * with "dropping event with missing/non-string kind".)
   *
   * Errors are logged but never thrown — pub/sub is best-effort.
   */
  private async publishEvent(kind: string, payload: unknown): Promise<void> {
    const base: Record<string, unknown> = {
      kind,
      sessionId: this.sessionId,
    };
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      // Flatten payload fields onto the envelope, but don't let them
      // overwrite `kind` (the discriminator the bridge filters on).
      for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
        if (k === 'kind') continue;
        base[k] = v;
      }
    } else if (payload !== undefined) {
      base.payload = payload;
    }
    const message = JSON.stringify(base);
    try {
      await this.redis.pub.publish(eventChannel(this.sessionId), message);
    } catch (err) {
      this.log.warn(
        { err, sessionId: this.sessionId, kind },
        'redis publish failed',
      );
    }
  }

  // ---------------------------------------------------------------- persistence

  /**
   * Mirror a Baileys event into the matching `sabwa_*` Mongo collection
   * and publish the corresponding pub/sub event. Best-effort — failures
   * are logged but never thrown so a single bad payload can't stall the
   * Baileys event loop.
   */
  private async persistAndPublish(event: string, payload: unknown): Promise<void> {
    await this.publishEvent(event, payload);

    const now = new Date();
    try {
      switch (event) {
        case 'messaging-history.set':
          await this.persistHistorySnapshot(payload, now);
          break;
        case 'chats.upsert':
        case 'chats.update':
          await this.upsertChat(payload as Record<string, unknown>, now);
          break;
        case 'messages.upsert':
          await this.upsertMessage(payload as Record<string, unknown>, now);
          break;
        case 'contacts.upsert':
        case 'contacts.update':
          await this.upsertContact(payload as Record<string, unknown>);
          break;
        case 'groups.upsert':
        case 'groups.update':
          await this.upsertGroup(payload as Record<string, unknown>, now);
          break;
        default:
          break;
      }
    } catch (err) {
      this.log.warn(
        { err, sessionId: this.sessionId, event },
        'sabwa_* mirror persist failed',
      );
    }
  }

  private async persistHistorySnapshot(payload: unknown, now: Date): Promise<void> {
    if (!payload || typeof payload !== 'object') return;
    const p = payload as Record<string, unknown>;

    const chats = Array.isArray(p.chats) ? (p.chats as Record<string, unknown>[]) : [];
    for (const c of chats) await this.upsertChat(c, now).catch(() => {});

    const contacts = Array.isArray(p.contacts)
      ? (p.contacts as Record<string, unknown>[])
      : [];
    for (const c of contacts) await this.upsertContact(c).catch(() => {});

    const messages = Array.isArray(p.messages)
      ? (p.messages as Record<string, unknown>[])
      : [];
    for (const m of messages) {
      await this.upsertMessage({ message: m, type: 'notify' }, now).catch(() => {});
    }
  }

  /**
   * Delegates to `ChatsRepo.upsert` so the wire DTO (ObjectId fields, the
   * `SabwaChat` shape from `src/lib/sabwa/types.ts`) stays consistent with
   * what `/v1/chats` writes. The bumping of `lastMessage` happens in the
   * `messages.upsert` branch below, not here.
   */
  private async upsertChat(payload: Record<string, unknown>, _now: Date): Promise<void> {
    const jid =
      (typeof payload.id === 'string' && payload.id) ||
      (typeof payload.jid === 'string' && payload.jid) ||
      '';
    if (!jid) return;
    const name =
      (typeof payload.name === 'string' && payload.name) ||
      (typeof payload.subject === 'string' && payload.subject) ||
      undefined;
    const unreadCount =
      typeof payload.unreadCount === 'number' ? payload.unreadCount : undefined;
    const input: Parameters<ChatsRepo['upsert']>[0] = {
      projectId: this.projectId,
      sessionId: this.sessionId,
      jid,
    };
    if (name) input.name = name;
    if (unreadCount !== undefined && unreadCount > 0) input.unreadCount = unreadCount;
    await new ChatsRepo(this.db).upsert(input);

    // Lazily fetch DP — throttled per-jid via `profilePicFetchedAt`.
    this.fetchProfilePic(jid).catch(() => {});
  }

  /**
   * Persist via `MessagesRepo.upsertByMessageId` so the wire shape matches
   * `SabwaMessage` from `src/lib/sabwa/types.ts`. Also bumps the chat row's
   * `lastMessage` so the inbox preview updates without a second round-trip.
   */
  private async upsertMessage(
    payload: Record<string, unknown>,
    _now: Date,
  ): Promise<void> {
    const msg = (payload.message ?? payload) as Record<string, unknown>;
    const key = (msg.key ?? {}) as Record<string, unknown>;
    const chatJid = typeof key.remoteJid === 'string' ? key.remoteJid : '';
    const messageId = typeof key.id === 'string' ? key.id : '';
    if (!chatJid || !messageId) return;
    const fromMe = key.fromMe === true;
    const fromJid =
      (typeof key.participant === 'string' && key.participant) || chatJid;
    const tsSec =
      typeof msg.messageTimestamp === 'number'
        ? msg.messageTimestamp
        : typeof msg.messageTimestamp === 'string'
          ? Number(msg.messageTimestamp)
          : Math.floor(Date.now() / 1000);
    const tsMs = tsSec * 1000;

    const { type, body, caption } = extractInboundMessageShape(msg);

    const messages = new MessagesRepo(this.db);
    const upserted = await messages.upsertByMessageId({
      projectId: this.projectId,
      sessionId: this.sessionId,
      chatJid,
      messageId,
      fromJid,
      fromMe,
      type,
      body,
      caption,
      status: fromMe ? 'sent' : 'delivered',
      ts: tsMs,
    });

    // Bump the chat preview (only for fresh inbound — outbound mirroring
    // happens in `sendMessage` so we don't double-count unread).
    try {
      const chats = new ChatsRepo(this.db);
      const upsertInput: Parameters<ChatsRepo['upsert']>[0] = {
        projectId: this.projectId,
        sessionId: this.sessionId,
        jid: chatJid,
        lastMessage: {
          id: upserted.messageId,
          body: body ?? caption ?? `[${type}]`,
          ts: new Date(tsMs),
          fromMe,
        },
      };
      if (!fromMe) upsertInput.unreadCount = 1;

      // For 1:1 chats, the inbound message's pushName is the counterpart's
      // display name — propagate to the chat row so the inbox shows a name
      // even when no chats.upsert event ever fired with metadata. Skip for
      // groups: pushName there is a participant, not the group subject.
      const inboundPushName =
        typeof msg.pushName === 'string' ? msg.pushName.trim() : '';
      if (
        !fromMe &&
        inboundPushName &&
        chatJid.endsWith('@s.whatsapp.net')
      ) {
        upsertInput.name = inboundPushName;
      }

      await chats.upsert(upsertInput);

      // Mirror pushName onto the sender's contact row regardless of chat
      // type so the contact list (and the 1:1 chat list fallback via the
      // $lookup in ChatsRepo.list) stays current.
      if (!fromMe && inboundPushName) {
        const contactJid = fromJid || chatJid;
        await this.upsertContact({ id: contactJid, notify: inboundPushName }).catch(
          () => {},
        );
      }
    } catch (err) {
      this.log.warn({ err, sessionId: this.sessionId, chatJid }, 'chat preview bump failed');
    }

    // Lazily ensure we have a DP for the chat. Throttled per-jid so a
    // history flood doesn't hammer WhatsApp's profile-pic endpoint.
    this.fetchProfilePic(chatJid).catch(() => {});
  }

  private async upsertContact(payload: Record<string, unknown>): Promise<void> {
    const jid =
      (typeof payload.id === 'string' && payload.id) ||
      (typeof payload.jid === 'string' && payload.jid) ||
      '';
    if (!jid) return;
    const name =
      (typeof payload.name === 'string' && payload.name) ||
      (typeof payload.verifiedName === 'string' && payload.verifiedName) ||
      undefined;
    const pushName =
      (typeof payload.notify === 'string' && payload.notify) ||
      (typeof payload.pushName === 'string' && payload.pushName) ||
      name;
    const phone =
      jid.endsWith('@s.whatsapp.net') || jid.endsWith('@c.us')
        ? normalizePhoneE164(jid)
        : undefined;

    // sabwa_contacts.sessionId / projectId are ObjectId in the schema —
    // passing strings makes Mongo store / match against the wrong BSON type,
    // so the row never matches the chat-list $lookup. Always coerce.
    const projectOid = this.toOid(this.projectId);
    const sessionOid = this.toOid(this.sessionId);

    const setFields: Record<string, unknown> = {
      projectId: projectOid,
      sessionId: sessionOid,
      jid,
      updatedAt: new Date(),
    };
    if (phone !== undefined) setFields.phoneE164 = phone;
    if (name !== undefined) setFields.name = name;
    if (pushName !== undefined) setFields.pushName = pushName;

    await this.db.collection('sabwa_contacts').updateOne(
      { projectId: projectOid, sessionId: sessionOid, jid },
      { $set: setFields },
      { upsert: true },
    );
  }

  private async upsertGroup(
    payload: Record<string, unknown>,
    now: Date,
  ): Promise<void> {
    const jid =
      (typeof payload.id === 'string' && payload.id) ||
      (typeof payload.jid === 'string' && payload.jid) ||
      '';
    if (!jid) return;
    const subject = typeof payload.subject === 'string' ? payload.subject : '';

    const projectOid = this.toOid(this.projectId);
    const sessionOid = this.toOid(this.sessionId);

    await this.db.collection('sabwa_groups').updateOne(
      { projectId: projectOid, sessionId: sessionOid, jid },
      {
        $set: {
          projectId: projectOid,
          sessionId: sessionOid,
          jid,
          subject,
          updatedAt: now,
          // Stash raw payload so callers can read participant lists,
          // ephemeral duration, etc., without us pre-mapping every field.
          raw: payload,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }

  /** Coerce a `string | ObjectId` into `ObjectId`; invalid strings throw. */
  private toOid(value: string | ObjectId): ObjectId {
    return typeof value === 'string' ? new ObjectId(value) : value;
  }

  /**
   * Pull the full group list from Baileys and upsert each as both a
   * `sabwa_chats` row (so the inbox's Groups tab is populated) and a
   * `sabwa_groups` row (so participant metadata stays available).
   *
   * Called on every successful connect — Baileys' `groups.upsert` event
   * only fires for groups created during a live session, so without this
   * the inbox stays empty for pre-existing groups.
   */
  private async syncGroups(): Promise<void> {
    if (!this.sock) return;
    let metas: Record<string, unknown>;
    try {
      metas = (await this.sock.groupFetchAllParticipating()) as Record<string, unknown>;
    } catch (err) {
      this.log.warn({ err, sessionId: this.sessionId }, 'groupFetchAllParticipating failed');
      return;
    }
    const chats = new ChatsRepo(this.db);
    const now = new Date();
    const entries = Object.entries(metas);
    this.log.info(
      { sessionId: this.sessionId, count: entries.length },
      'syncGroups fetched',
    );
    for (const [jid, raw] of entries) {
      if (!jid || !jid.endsWith('@g.us')) continue;
      const meta = (raw ?? {}) as Record<string, unknown>;
      const subject = typeof meta.subject === 'string' && meta.subject ? meta.subject : jid;
      const participants = Array.isArray(meta.participants)
        ? meta.participants.length
        : undefined;
      const input: Parameters<ChatsRepo['upsert']>[0] = {
        projectId: this.projectId,
        sessionId: this.sessionId,
        jid,
        type: 'group',
        name: subject,
      };
      if (participants !== undefined) input.participants = participants;
      await chats.upsert(input).catch((err) => {
        this.log.warn({ err, sessionId: this.sessionId, jid }, 'syncGroups upsert failed');
      });
      await this.upsertGroup({ id: jid, subject, ...meta }, now).catch(() => {});
      this.fetchProfilePic(jid).catch(() => {});
    }
  }

  /**
   * Fetch the profile picture for a jid and persist it to both
   * `sabwa_chats.profilePicUrl` and `sabwa_contacts.profilePicUrl`.
   *
   * Throttled per-jid (24h) so the history flood that fires `chats.upsert`
   * for hundreds of jids on first sync doesn't hammer WhatsApp's CDN.
   */
  private async fetchProfilePic(jid: string): Promise<void> {
    if (!this.sock || !jid) return;
    if (jid === 'status@broadcast' || jid.endsWith('@broadcast')) return;
    const last = this.profilePicFetchedAt.get(jid);
    const now = Date.now();
    if (last && now - last < 24 * 60 * 60 * 1000) return;
    this.profilePicFetchedAt.set(jid, now);

    let url: string | undefined;
    try {
      url = await this.sock.profilePictureUrl(jid, 'image');
    } catch {
      // 404 (no DP) / forbidden (privacy) — both are normal, ignore.
      return;
    }
    if (!url) return;

    const sessionOid = this.toOid(this.sessionId);
    await Promise.all([
      this.db
        .collection('sabwa_chats')
        .updateOne(
          { sessionId: sessionOid, jid },
          { $set: { profilePicUrl: url, updatedAt: new Date() } },
        )
        .catch(() => {}),
      this.db
        .collection('sabwa_contacts')
        .updateOne(
          { sessionId: sessionOid, jid },
          { $set: { profilePicUrl: url, updatedAt: new Date() } },
        )
        .catch(() => {}),
    ]);
  }

  /**
   * Backfill DPs for chats that don't yet have one. Walks up to 200 chats
   * spaced 200ms apart so a freshly-paired session catches up without
   * triggering WhatsApp's rate limit. Runs once per connect.
   */
  private async fillMissingProfilePics(): Promise<void> {
    if (!this.sock) return;
    const sessionOid = this.toOid(this.sessionId);
    const cursor = this.db
      .collection<{ jid: string }>('sabwa_chats')
      .find(
        { sessionId: sessionOid, profilePicUrl: { $exists: false } },
        { projection: { jid: 1, _id: 0 } },
      )
      .limit(200);
    for await (const doc of cursor) {
      if (!this.sock || this.stopped) break;
      if (typeof doc.jid !== 'string') continue;
      await this.fetchProfilePic(doc.jid).catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

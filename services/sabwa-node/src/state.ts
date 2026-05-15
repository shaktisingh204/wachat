/**
 * Shared application state for sabwa-node.
 *
 * A single `AppState` is built once in `index.ts` and threaded through to all
 * routes via `req.app.locals.state`. The shape intentionally mirrors the
 * `state.rs` struct from the Rust engine so the per-domain agents porting
 * handlers have a 1:1 translation target.
 *
 * `sessions` is the in-memory pool of live Baileys sockets keyed by SabWa
 * session id (a string `ObjectId`). The per-domain `sessions` agent is
 * responsible for populating / reaping entries.
 */

import type { Db, MongoClient } from 'mongodb';
import type { RedisHandles } from './db/redis.js';
import type { Logger } from './log.js';
import type { SessionPool } from './wa/pool.js';

/** Configuration loaded once from the environment. */
export interface AppConfig {
  port: number;
  mongoUrl: string;
  redisUrl: string;
  serviceToken: string;
  /** Base64 of 32 raw bytes — AES-256-GCM key for sessions.authState at rest. */
  authStateKey: string;
}

/**
 * Placeholder type for a live Baileys session. The sessions agent will
 * replace this with the real socket + auth state container.
 */
export interface BaileysSession {
  sessionId: string;
  projectId: string;
  // Filled in by the sessions agent. Kept opaque here to avoid a hard
  // dependency on `@whiskeysockets/baileys` types in the shared state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock?: unknown;
  status: 'connecting' | 'qr' | 'pairing' | 'connected' | 'disconnected';
  startedAt: Date;
}

export interface AppState {
  config: AppConfig;
  log: Logger;
  mongo: MongoClient;
  db: Db;
  redis: RedisHandles;
  /** Pre-parsed 32-byte AES key derived from `config.authStateKey`. */
  authStateKey: Buffer;
  /** Live Baileys session pool — populated lazily by `/v1/sessions`. */
  pool: SessionPool;
  /**
   * SabWa session id -> opaque placeholder kept for forward-compatibility
   * with the original sidecar contract. Real per-session state now lives
   * inside `pool`; this map is intentionally left here so any caller that
   * peeks at `state.sessions` still compiles. New code should use `pool`.
   */
  sessions: Map<string, BaileysSession>;
}

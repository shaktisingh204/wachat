/**
 * MongoDB-backed Baileys auth-state factory.
 *
 * Mirrors the shape of `useMultiFileAuthState` from `@whiskeysockets/baileys`
 * but persists every keyed value as a single JSON blob inside
 * `sabwa_sessions.authState`.
 *
 * The blob is stored encrypted at rest using AES-256-GCM with the wire
 * format `nonce (12 bytes) || ciphertext || tag (16 bytes)` — byte-for-byte
 * compatible with the Rust engine's `crypto.rs` (`AuthStateCrypto`), so a
 * pre-existing Rust-written row can be hydrated by this Node implementation
 * (and vice-versa) without migration.
 *
 * The key is sourced once at startup from `AUTH_STATE_KEY` (or
 * `SABWA_AUTH_ENCRYPTION_KEY` — same env-var name the Rust engine reads).
 * Accepts either a 64-char hex string or a 32-byte base64 blob.
 *
 * Note on the nonce: the original spec text in the task description says
 * "24-byte nonce" but the Rust engine actually uses a **12-byte** nonce
 * (the AES-GCM default — see `crypto.rs::NONCE_LEN = 12`). We match the
 * Rust engine bit-for-bit here so blobs interoperate.
 */

import { Binary, ObjectId, type Db } from 'mongodb';
import {
  BufferJSON,
  initAuthCreds,
  proto,
  type AuthenticationCreds,
  type AuthenticationState,
  type SignalDataTypeMap,
} from '@whiskeysockets/baileys';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Logger } from '../log.js';

const SESSIONS_COLLECTION = 'sabwa_sessions';
const NONCE_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

// ---------- key parsing ----------

/**
 * Parse a 32-byte AES key from the raw env-var value. Accepts:
 *   - 64-char hex (optionally `0x`-prefixed), or
 *   - standard base64 of 32 bytes.
 *
 * Matches `AuthStateCrypto::from_key_string` in the Rust engine so any
 * key that worked there continues to work here.
 */
export function parseAuthStateKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(
      'AUTH_STATE_KEY is empty — must be 32 bytes (64 hex chars or base64)',
    );
  }

  const hexCandidate = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;
  if (hexCandidate.length === KEY_LEN * 2 && /^[0-9a-fA-F]+$/.test(hexCandidate)) {
    return Buffer.from(hexCandidate, 'hex');
  }

  const decoded = Buffer.from(trimmed, 'base64');
  if (decoded.length !== KEY_LEN) {
    throw new Error(
      `AUTH_STATE_KEY must decode to exactly ${KEY_LEN} bytes (got ${decoded.length})`,
    );
  }
  return decoded;
}

// ---------- AES-256-GCM helpers ----------

/**
 * Encrypt `plaintext` and return `nonce (12) || ciphertext || tag (16)`.
 */
export function encryptAuthState(key: Buffer, plaintext: Buffer): Buffer {
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ct, tag]);
}

/**
 * Decrypt a blob produced by `encryptAuthState` (or by Rust's
 * `AuthStateCrypto::encrypt`).
 */
export function decryptAuthState(key: Buffer, blob: Buffer): Buffer {
  if (blob.length < NONCE_LEN + TAG_LEN) {
    throw new Error(
      `encrypted auth_state blob is too short: ${blob.length} bytes (need >= ${NONCE_LEN + TAG_LEN})`,
    );
  }
  const nonce = blob.subarray(0, NONCE_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ct = blob.subarray(NONCE_LEN, blob.length - TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

// ---------- on-disk JSON shape (in-memory only here) ----------

interface StoredAuthState {
  creds: AuthenticationCreds;
  /** key category (e.g. `pre-key`, `session`) -> id -> value (Baileys JSON). */
  keys: Record<string, Record<string, unknown>>;
}

// ---------- public factory ----------

export interface MongoAuthStateOptions {
  /** Mongo session row `_id` (string form of ObjectId). */
  sessionId: string;
  db: Db;
  /** Parsed 32-byte AES key (see `parseAuthStateKey`). */
  authStateKey: Buffer;
  log: Logger;
}

/**
 * Build an `AuthenticationState` + `saveCreds` pair backed by a single
 * encrypted document on `sabwa_sessions.authState`.
 *
 * - On first call, hydrates from the existing row if any (decrypting via
 *   `AUTH_STATE_KEY`). If the row has no `authState` yet (a fresh
 *   `pending` session) we start with `initAuthCreds()`.
 * - `saveCreds` re-serialises the **full** state and rewrites the blob.
 *   The blob is small (a few KB) so the simplicity of full-rewrites
 *   outweighs the cost of a per-key incremental store.
 * - All reads/writes are serialised through a per-instance promise chain
 *   so concurrent `keys.set` calls don't race against `saveCreds`.
 */
export async function useMongoAuthState(
  opts: MongoAuthStateOptions,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const { sessionId, db, authStateKey, log } = opts;
  const col = db.collection(SESSIONS_COLLECTION);

  let oid: ObjectId;
  try {
    oid = new ObjectId(sessionId);
  } catch {
    throw new Error(`useMongoAuthState: invalid session id (not an ObjectId): ${sessionId}`);
  }

  // Load + decrypt the existing blob, if any.
  let stored: StoredAuthState;
  const row = await col.findOne(
    { _id: oid },
    { projection: { authState: 1 } },
  );
  const rawBin = row?.authState;
  if (
    rawBin &&
    typeof rawBin === 'object' &&
    'buffer' in rawBin &&
    Buffer.isBuffer((rawBin as Binary).buffer) &&
    (rawBin as Binary).buffer.length > 0
  ) {
    try {
      const plain = decryptAuthState(authStateKey, Buffer.from((rawBin as Binary).buffer));
      stored = JSON.parse(plain.toString('utf8'), BufferJSON.reviver) as StoredAuthState;
      if (!stored || typeof stored !== 'object' || !stored.creds) {
        throw new Error('decrypted auth state has no `creds` field');
      }
      if (!stored.keys) stored.keys = {};
    } catch (err) {
      log.warn(
        { err, sessionId },
        'failed to decrypt/parse persisted auth state — starting fresh',
      );
      stored = { creds: initAuthCreds(), keys: {} };
    }
  } else {
    stored = { creds: initAuthCreds(), keys: {} };
  }

  // Serialise writes through a single chain so we never race.
  let writeChain: Promise<void> = Promise.resolve();
  const flush = (): Promise<void> => {
    const next = writeChain.then(async () => {
      const plain = Buffer.from(
        JSON.stringify(stored, BufferJSON.replacer),
        'utf8',
      );
      const blob = encryptAuthState(authStateKey, plain);
      await col.updateOne(
        { _id: oid },
        {
          $set: {
            authState: new Binary(blob),
            updatedAt: new Date(),
          },
        },
      );
    });
    // Swallow errors on the chain itself so a transient Mongo blip doesn't
    // poison every subsequent write — but surface the error to the caller.
    writeChain = next.catch(() => {});
    return next;
  };

  const state: AuthenticationState = {
    creds: stored.creds,
    keys: {
      get: async (type, ids) => {
        const out: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        const bucket = stored.keys[type] ?? {};
        for (const id of ids) {
          let value = bucket[id];
          if (value !== undefined && value !== null) {
            if (type === 'app-state-sync-key') {
              value = proto.Message.AppStateSyncKeyData.fromObject(
                value as object,
              );
            }
            out[id] = value as SignalDataTypeMap[typeof type];
          }
        }
        return out;
      },
      set: async (data) => {
        let dirty = false;
        for (const category of Object.keys(data) as Array<keyof SignalDataTypeMap>) {
          const entries = data[category] ?? {};
          let bucket = stored.keys[category];
          if (!bucket) {
            bucket = {};
            stored.keys[category] = bucket;
          }
          for (const id of Object.keys(entries)) {
            const value = entries[id];
            if (value === null || value === undefined) {
              if (id in bucket) {
                delete bucket[id];
                dirty = true;
              }
            } else {
              bucket[id] = value;
              dirty = true;
            }
          }
        }
        if (dirty) await flush();
      },
    },
  };

  const saveCreds = async (): Promise<void> => {
    // `creds` is held by reference inside `state`, so Baileys mutates it
    // in-place; we just re-flush the whole blob.
    await flush();
  };

  return { state, saveCreds };
}

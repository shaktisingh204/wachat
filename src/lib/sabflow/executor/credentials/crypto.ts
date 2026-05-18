/**
 * SabFlow Executor — Credential Envelope Encryption (AES-256-GCM)
 * ---------------------------------------------------------------
 *
 * Track B Phase 5 (sub-task #2): KEK/DEK envelope encryption for the
 * SabFlow executor credential store. Every credential record is encrypted
 * with a freshly-generated 256-bit Data Encryption Key (DEK); the DEK is
 * then wrapped under a Key Encryption Key (KEK) read from the
 * environment. This lets us rotate KEKs without re-encrypting (and
 * exposing) the underlying credential plaintexts — see
 * {@link rotateCredential}.
 *
 * ## Why envelope encryption?
 *
 * - **Key rotation is cheap**: only the wrapped DEK changes during a KEK
 *   rotation; the bulky ciphertext stays put.
 * - **Per-record DEKs**: a leaked DEK only compromises one credential,
 *   not the whole store.
 * - **KEK never touches the DB**: the KEK lives in env / a KMS; only the
 *   *wrapped* DEK is persisted next to the ciphertext.
 *
 * ## Environment layout
 *
 * KEKs are sourced from environment variables of the form:
 *
 * ```text
 *   SABFLOW_KEK_<id> = <base64-encoded 32 raw bytes>
 * ```
 *
 * The default `<id>` is `v1`, so the bootstrap env var is
 * `SABFLOW_KEK_v1`. To introduce a new KEK (for rotation), set
 * `SABFLOW_KEK_v2` and pass `'v2'` as the `toKekId` argument to
 * {@link rotateCredential}. The id is recorded in the envelope so
 * decryption knows which KEK to ask for.
 *
 * Generate a fresh KEK with:
 *
 * ```sh
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 * ```
 *
 * ## Wire format
 *
 * The envelope is intentionally a flat structure of `Buffer`s — the
 * caller (the credential store) decides how to persist it (typically
 * each buffer is base64-encoded into a JSON column, or stored as raw
 * `BYTEA` in Postgres). The format is:
 *
 * - `ciphertext`     — AES-256-GCM ciphertext of `JSON.stringify(plaintext)`
 *                      under the DEK.
 * - `iv`             — 12-byte IV used for the ciphertext.
 * - `tag`            — 16-byte GCM authentication tag for the ciphertext.
 * - `dek`            — AES-256-GCM ciphertext of the raw 32-byte DEK
 *                      under the KEK, prefixed with its own 12-byte IV
 *                      and suffixed with its own 16-byte tag (so a
 *                      caller never has to track three separate buffers
 *                      to unwrap the DEK). Layout: `iv ‖ ct ‖ tag`,
 *                      total length `12 + 32 + 16 = 60` bytes.
 * - `kekId`          — Which KEK was used to wrap `dek`. Required for
 *                      decryption + rotation; recorded so a store with
 *                      mixed-vintage records still decrypts cleanly.
 *
 * @module sabflow/executor/credentials/crypto
 */

import 'server-only';

import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	timingSafeEqual,
	type CipherGCM,
	type DecipherGCM,
} from 'node:crypto';

import { CredentialsError } from '../errors';

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

/** AES-256-GCM is the only supported algorithm. */
const ALGORITHM = 'aes-256-gcm' as const;

/** GCM strongly prefers a 96-bit (12-byte) IV. */
const IV_LENGTH = 12;

/** GCM authentication tag length, in bytes (128 bits). */
const TAG_LENGTH = 16;

/** Required raw key length for AES-256: 32 bytes / 256 bits. */
const KEY_LENGTH = 32;

/** Total length of a packed wrapped DEK: `iv ‖ ct ‖ tag`. */
const WRAPPED_DEK_LENGTH = IV_LENGTH + KEY_LENGTH + TAG_LENGTH;

/** Default KEK id used when callers don't pass one. */
export const DEFAULT_KEK_ID = 'v1';

/** Env-var prefix used by {@link getKek}. */
const KEK_ENV_PREFIX = 'SABFLOW_KEK_';

/** Conservative regex for KEK ids — keeps the env-var name safe. */
const KEK_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

/**
 * The opaque envelope persisted by the credential store.
 *
 * `ciphertext` / `iv` / `tag` together form the AES-256-GCM payload of
 * `JSON.stringify(plaintext)` under the DEK; `dek` is the DEK itself,
 * sealed (`iv ‖ ct ‖ tag`) under the KEK identified by `kekId`.
 */
export interface CredentialEnvelope {
	/** AES-256-GCM ciphertext of the JSON-encoded plaintext, under the DEK. */
	ciphertext: Buffer;
	/** 12-byte IV used for {@link CredentialEnvelope.ciphertext | ciphertext}. */
	iv: Buffer;
	/** 16-byte GCM auth tag for {@link CredentialEnvelope.ciphertext | ciphertext}. */
	tag: Buffer;
	/** KEK-wrapped DEK: `iv (12) ‖ ct (32) ‖ tag (16)` = 60 bytes. */
	dek: Buffer;
	/** Which KEK was used to wrap {@link CredentialEnvelope.dek | dek}. */
	kekId: string;
}

/* ------------------------------------------------------------------ */
/* KEK resolution                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve a KEK by id, reading `SABFLOW_KEK_<id>` from `process.env` and
 * decoding it from base64. Returns a fresh 32-byte `Buffer` on success.
 *
 * @throws {@link CredentialsError} when:
 *   - the id contains characters that wouldn't make a safe env-var name,
 *   - the env var is missing or empty,
 *   - the env var is not valid base64,
 *   - the decoded key isn't exactly 32 bytes.
 *
 * @example
 * ```ts
 * const kek = getKek('v1'); // reads SABFLOW_KEK_v1
 * ```
 */
export function getKek(kekId: string = DEFAULT_KEK_ID): Buffer {
	if (typeof kekId !== 'string' || !KEK_ID_PATTERN.test(kekId)) {
		throw new CredentialsError(
			`Invalid KEK id "${String(kekId)}" — must match ${KEK_ID_PATTERN.source}`,
			{ reason: 'invalid', details: { kekId } },
		);
	}

	const envName = `${KEK_ENV_PREFIX}${kekId}`;
	const raw = process.env[envName];
	if (!raw || raw.length === 0) {
		throw new CredentialsError(`Missing KEK env var ${envName}`, {
			reason: 'missing',
			details: { kekId, envName },
		});
	}

	let decoded: Buffer;
	try {
		decoded = Buffer.from(raw, 'base64');
	} catch (cause) {
		throw new CredentialsError(`KEK env var ${envName} is not valid base64`, {
			reason: 'invalid',
			cause,
			details: { kekId, envName },
		});
	}

	if (decoded.length !== KEY_LENGTH) {
		throw new CredentialsError(
			`KEK env var ${envName} must decode to exactly ${KEY_LENGTH} bytes (got ${decoded.length})`,
			{ reason: 'invalid', details: { kekId, envName, length: decoded.length } },
		);
	}
	return decoded;
}

/* ------------------------------------------------------------------ */
/* Internal helpers                                                    */
/* ------------------------------------------------------------------ */

/**
 * AES-256-GCM encrypt raw bytes under `key`. Returns `{ iv, ct, tag }`
 * with a freshly-generated IV.
 *
 * @internal
 */
function gcmEncrypt(key: Buffer, plaintext: Buffer): { iv: Buffer; ct: Buffer; tag: Buffer } {
	if (key.length !== KEY_LENGTH) {
		throw new CredentialsError(`AES-256-GCM key must be ${KEY_LENGTH} bytes`, {
			reason: 'invalid',
			details: { keyLength: key.length },
		});
	}
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH }) as CipherGCM;
	const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	const tag = cipher.getAuthTag();
	return { iv, ct, tag };
}

/**
 * AES-256-GCM decrypt under `key`. Throws {@link CredentialsError} on
 * any failure (bad tag, malformed input). GCM's `final()` already does
 * a constant-time tag verification internally; we just translate the
 * exception into our error taxonomy.
 *
 * @internal
 */
function gcmDecrypt(
	key: Buffer,
	iv: Buffer,
	ct: Buffer,
	tag: Buffer,
	context: 'ciphertext' | 'dek',
): Buffer {
	if (key.length !== KEY_LENGTH) {
		throw new CredentialsError(`AES-256-GCM key must be ${KEY_LENGTH} bytes`, {
			reason: 'invalid',
			details: { keyLength: key.length, context },
		});
	}
	if (iv.length !== IV_LENGTH) {
		throw new CredentialsError(`AES-256-GCM IV must be ${IV_LENGTH} bytes`, {
			reason: 'invalid',
			details: { ivLength: iv.length, context },
		});
	}
	if (tag.length !== TAG_LENGTH) {
		throw new CredentialsError(`AES-256-GCM tag must be ${TAG_LENGTH} bytes`, {
			reason: 'invalid',
			details: { tagLength: tag.length, context },
		});
	}

	const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH }) as DecipherGCM;
	decipher.setAuthTag(tag);
	try {
		// `final()` performs GCM's built-in constant-time tag check; any
		// mismatch surfaces as "Unsupported state or unable to authenticate
		// data". We map that to a typed CredentialsError below.
		return Buffer.concat([decipher.update(ct), decipher.final()]);
	} catch (cause) {
		throw new CredentialsError(
			context === 'dek'
				? 'Failed to unwrap DEK — KEK mismatch or tampered envelope'
				: 'Failed to decrypt credential — DEK mismatch or tampered ciphertext',
			{ reason: 'invalid', cause, details: { context } },
		);
	}
}

/**
 * Pack a freshly-wrapped DEK into the on-disk layout: `iv ‖ ct ‖ tag`.
 *
 * @internal
 */
function packWrappedDek(iv: Buffer, ct: Buffer, tag: Buffer): Buffer {
	return Buffer.concat([iv, ct, tag], WRAPPED_DEK_LENGTH);
}

/**
 * Unpack the `iv ‖ ct ‖ tag` layout produced by {@link packWrappedDek}.
 *
 * @internal
 */
function unpackWrappedDek(wrapped: Buffer): { iv: Buffer; ct: Buffer; tag: Buffer } {
	if (!Buffer.isBuffer(wrapped) || wrapped.length !== WRAPPED_DEK_LENGTH) {
		throw new CredentialsError(
			`Malformed wrapped DEK — expected ${WRAPPED_DEK_LENGTH} bytes, got ${
				Buffer.isBuffer(wrapped) ? wrapped.length : typeof wrapped
			}`,
			{ reason: 'invalid', details: { length: Buffer.isBuffer(wrapped) ? wrapped.length : undefined } },
		);
	}
	return {
		iv: wrapped.subarray(0, IV_LENGTH),
		ct: wrapped.subarray(IV_LENGTH, IV_LENGTH + KEY_LENGTH),
		tag: wrapped.subarray(IV_LENGTH + KEY_LENGTH, WRAPPED_DEK_LENGTH),
	};
}

/**
 * Validate envelope shape before we touch any keys — fail fast with a
 * structured error rather than a cryptic Buffer assertion later.
 *
 * @internal
 */
function assertEnvelopeShape(envelope: unknown): asserts envelope is CredentialEnvelope {
	if (!envelope || typeof envelope !== 'object') {
		throw new CredentialsError('Malformed credential envelope — not an object', {
			reason: 'invalid',
		});
	}
	const e = envelope as Partial<CredentialEnvelope>;
	if (!Buffer.isBuffer(e.ciphertext)) {
		throw new CredentialsError('Malformed credential envelope — `ciphertext` is not a Buffer', {
			reason: 'invalid',
		});
	}
	if (!Buffer.isBuffer(e.iv) || e.iv.length !== IV_LENGTH) {
		throw new CredentialsError(
			`Malformed credential envelope — \`iv\` must be a ${IV_LENGTH}-byte Buffer`,
			{ reason: 'invalid' },
		);
	}
	if (!Buffer.isBuffer(e.tag) || e.tag.length !== TAG_LENGTH) {
		throw new CredentialsError(
			`Malformed credential envelope — \`tag\` must be a ${TAG_LENGTH}-byte Buffer`,
			{ reason: 'invalid' },
		);
	}
	if (!Buffer.isBuffer(e.dek) || e.dek.length !== WRAPPED_DEK_LENGTH) {
		throw new CredentialsError(
			`Malformed credential envelope — wrapped \`dek\` must be ${WRAPPED_DEK_LENGTH} bytes`,
			{ reason: 'invalid' },
		);
	}
	if (typeof e.kekId !== 'string' || !KEK_ID_PATTERN.test(e.kekId)) {
		throw new CredentialsError('Malformed credential envelope — missing/invalid `kekId`', {
			reason: 'invalid',
		});
	}
}

/**
 * Best-effort zeroization for transient secret buffers. JS doesn't
 * guarantee in-place erasure (V8 may have copied the buffer), but this
 * is still strictly better than leaving raw DEK bytes lying around in
 * the GC graph.
 *
 * @internal
 */
function wipe(buf: Buffer): void {
	try {
		buf.fill(0);
	} catch {
		/* read-only view — nothing we can do */
	}
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Envelope-encrypt a plaintext credential object under the KEK
 * identified by `kekId`.
 *
 * The plaintext is serialized with `JSON.stringify` — values must be
 * JSON-serializable (no `Buffer`, no `bigint`, no functions).
 *
 * @param plaintext  The credential object to seal (anything
 *                   JSON-serializable).
 * @param kekId      KEK to use for wrapping. Defaults to
 *                   {@link DEFAULT_KEK_ID}.
 *
 * @returns A {@link CredentialEnvelope} containing the ciphertext, its
 *          GCM IV/tag, the KEK-wrapped DEK, and the `kekId`.
 *
 * @throws {@link CredentialsError} when the plaintext is not a
 *         non-null object, the KEK is missing, or serialization fails.
 *
 * @example
 * ```ts
 * const env = encryptCredential({ apiKey: 'sk_live_…' }, 'v1');
 * // persist env.{ciphertext,iv,tag,dek,kekId} alongside the credential row
 * ```
 */
export function encryptCredential(
	plaintext: object,
	kekId: string = DEFAULT_KEK_ID,
): CredentialEnvelope {
	if (plaintext === null || typeof plaintext !== 'object') {
		throw new CredentialsError('encryptCredential: `plaintext` must be a non-null object', {
			reason: 'invalid',
		});
	}

	let serialized: Buffer;
	try {
		serialized = Buffer.from(JSON.stringify(plaintext), 'utf8');
	} catch (cause) {
		throw new CredentialsError('encryptCredential: failed to JSON-serialize plaintext', {
			reason: 'invalid',
			cause,
		});
	}

	const kek = getKek(kekId);
	const dek = randomBytes(KEY_LENGTH);
	try {
		// 1. Encrypt plaintext under DEK.
		const { iv, ct, tag } = gcmEncrypt(dek, serialized);
		// 2. Wrap DEK under KEK.
		const wrapped = gcmEncrypt(kek, dek);

		return {
			ciphertext: ct,
			iv,
			tag,
			dek: packWrappedDek(wrapped.iv, wrapped.ct, wrapped.tag),
			kekId,
		};
	} finally {
		wipe(dek);
		wipe(kek);
		wipe(serialized);
	}
}

/**
 * Reverse of {@link encryptCredential}. Unwraps the DEK with the
 * envelope's `kekId` KEK, then decrypts the ciphertext. Returns the
 * parsed plaintext object.
 *
 * Constant-time tag verification is delegated to GCM's `final()`; any
 * mismatch — whether on the wrapped-DEK tag or the ciphertext tag — is
 * surfaced as a {@link CredentialsError} with `reason: 'invalid'`.
 *
 * @param envelope  The envelope previously produced by
 *                  {@link encryptCredential} (or
 *                  {@link rotateCredential}).
 *
 * @throws {@link CredentialsError} when:
 *   - the envelope is malformed,
 *   - the KEK is missing,
 *   - either GCM auth tag does not verify,
 *   - the decrypted plaintext is not valid JSON / not an object.
 *
 * @example
 * ```ts
 * const creds = decryptCredential(env) as { apiKey: string };
 * ```
 */
export function decryptCredential(envelope: CredentialEnvelope): object {
	assertEnvelopeShape(envelope);

	const kek = getKek(envelope.kekId);
	const wrapped = unpackWrappedDek(envelope.dek);
	let dek: Buffer | undefined;
	let plaintextBuf: Buffer | undefined;
	try {
		// 1. Unwrap DEK under KEK (GCM auth tag verified here).
		dek = gcmDecrypt(kek, wrapped.iv, wrapped.ct, wrapped.tag, 'dek');
		if (dek.length !== KEY_LENGTH) {
			throw new CredentialsError(
				`Unwrapped DEK has unexpected length ${dek.length} (want ${KEY_LENGTH})`,
				{ reason: 'invalid' },
			);
		}
		// 2. Decrypt ciphertext under DEK (GCM auth tag verified here).
		plaintextBuf = gcmDecrypt(dek, envelope.iv, envelope.ciphertext, envelope.tag, 'ciphertext');

		let parsed: unknown;
		try {
			parsed = JSON.parse(plaintextBuf.toString('utf8'));
		} catch (cause) {
			throw new CredentialsError(
				'Failed to parse decrypted credential — invalid JSON in plaintext',
				{ reason: 'invalid', cause },
			);
		}
		if (parsed === null || typeof parsed !== 'object') {
			throw new CredentialsError(
				'Decrypted credential is not a JSON object (got ' + typeof parsed + ')',
				{ reason: 'invalid' },
			);
		}
		return parsed as object;
	} finally {
		if (dek) wipe(dek);
		if (plaintextBuf) wipe(plaintextBuf);
		wipe(kek);
	}
}

/**
 * Re-wrap an existing envelope's DEK under a new KEK without touching
 * the ciphertext. This is the rotation primitive: it keeps the bulky
 * ciphertext immutable (so blob storage / DB row footprints don't move)
 * and only replaces the 60-byte wrapped DEK + the `kekId` marker.
 *
 * Both KEKs must be present in the environment at rotation time.
 *
 * If `fromKekId` doesn't match `envelope.kekId`, we throw — the caller
 * is operating on the wrong envelope and we want to fail loud instead
 * of silently corrupting the row.
 *
 * If `fromKekId === toKekId` we still re-wrap (fresh IV + fresh tag),
 * which can be used to refresh wrap material without changing keys.
 *
 * The original envelope is **not** mutated; a brand-new
 * {@link CredentialEnvelope} is returned.
 *
 * @param envelope    Existing envelope to rotate.
 * @param fromKekId   KEK id that currently wraps `envelope.dek`. Must
 *                    equal `envelope.kekId`.
 * @param toKekId     KEK id to wrap under going forward.
 *
 * @throws {@link CredentialsError} on envelope shape errors, KEK id
 *         mismatch, missing KEKs, or auth-tag failure while unwrapping
 *         the old DEK.
 *
 * @example
 * ```ts
 * // Rotate from v1 to v2:
 * const fresh = rotateCredential(oldEnv, 'v1', 'v2');
 * await store.update(id, fresh);
 * ```
 */
export function rotateCredential(
	envelope: CredentialEnvelope,
	fromKekId: string,
	toKekId: string,
): CredentialEnvelope {
	assertEnvelopeShape(envelope);

	if (envelope.kekId !== fromKekId) {
		throw new CredentialsError(
			`rotateCredential: envelope.kekId (${envelope.kekId}) does not match fromKekId (${fromKekId})`,
			{ reason: 'invalid', details: { envelopeKekId: envelope.kekId, fromKekId } },
		);
	}

	const fromKek = getKek(fromKekId);
	const toKek = getKek(toKekId);

	// Optional cross-check: if both ids resolve to the *same* raw bytes
	// (e.g. an operator accidentally aliased them) and they're not the
	// same id, surface that as an invalid rotation so the caller can
	// re-check their env. We use `timingSafeEqual` to avoid leaking key
	// comparison timing — it's not strictly required here but cheap.
	if (fromKekId !== toKekId && fromKek.length === toKek.length && timingSafeEqual(fromKek, toKek)) {
		wipe(fromKek);
		wipe(toKek);
		throw new CredentialsError(
			`rotateCredential: ${fromKekId} and ${toKekId} resolve to identical key material — refuse to rotate`,
			{ reason: 'invalid', details: { fromKekId, toKekId } },
		);
	}

	const wrapped = unpackWrappedDek(envelope.dek);
	let dek: Buffer | undefined;
	try {
		dek = gcmDecrypt(fromKek, wrapped.iv, wrapped.ct, wrapped.tag, 'dek');
		if (dek.length !== KEY_LENGTH) {
			throw new CredentialsError(
				`Unwrapped DEK has unexpected length ${dek.length} (want ${KEY_LENGTH})`,
				{ reason: 'invalid' },
			);
		}
		const rewrapped = gcmEncrypt(toKek, dek);
		return {
			ciphertext: envelope.ciphertext,
			iv: envelope.iv,
			tag: envelope.tag,
			dek: packWrappedDek(rewrapped.iv, rewrapped.ct, rewrapped.tag),
			kekId: toKekId,
		};
	} finally {
		if (dek) wipe(dek);
		wipe(fromKek);
		wipe(toKek);
	}
}

/**
 * SabVault client-side crypto.
 *
 * PLAINTEXT NEVER LEAVES THE BROWSER. Every secret payload is encrypted
 * here with AES-GCM-256 using a key derived from the user's master password
 * via PBKDF2-SHA-256 (310,000 iterations — OWASP 2023 floor). The server
 * stores only the resulting base64 envelope and the per-user salt.
 *
 * **Where the master key lives:** in memory only. The
 * `/dashboard/sabvault/unlock` page derives it once into a JS variable
 * (held by a React context provider — see `vault-key-context.tsx`) and
 * discards it on tab close or explicit lock. NEVER persisted to
 * localStorage, IndexedDB, or cookies.
 *
 * **Envelope format:**
 *   `version || iv (12 bytes) || ciphertext` — concatenated, base64-encoded.
 *   `version === 0x01` reserves room for a future XChaCha20-Poly1305 swap.
 *
 * **What's encrypted:** the entire kind-specific payload object as JSON.
 * The Mongo document keeps `name`, `url`, `tags`, `kind`, `folderId`,
 * `attachments` in cleartext (the user opted into searching them).
 *
 * Browser-only — uses `window.crypto.subtle`. Importing from a server
 * component will fail at runtime; that's intentional.
 */

const PBKDF2_ITERATIONS = 310_000;
const SALT_LEN = 16; // 128 bits
const IV_LEN = 12; // 96 bits — AES-GCM standard
const KEY_LEN_BITS = 256;
const ENVELOPE_VERSION = 0x01;

/* ─── Base64 helpers ─────────────────────────────────────────────────── */

export function bytesToBase64(b: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < b.byteLength; i++) bin += String.fromCharCode(b[i]);
    return typeof window !== 'undefined'
        ? window.btoa(bin)
        : Buffer.from(bin, 'binary').toString('base64');
}

export function base64ToBytes(s: string): Uint8Array {
    const bin =
        typeof window !== 'undefined'
            ? window.atob(s)
            : Buffer.from(s, 'base64').toString('binary');
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

/* ─── Random helpers ─────────────────────────────────────────────────── */

export function randomBytes(len: number): Uint8Array {
    const b = new Uint8Array(len);
    crypto.getRandomValues(b);
    return b;
}

/** Mint a per-user salt — call this exactly once during vault setup. */
export function newSalt(): Uint8Array {
    return randomBytes(SALT_LEN);
}

/* ─── Key derivation ─────────────────────────────────────────────────── */

/**
 * Derive an AES-GCM master key from `password` + per-user `salt`.
 *
 * The returned `CryptoKey` is non-extractable — it can encrypt/decrypt but
 * the raw key bytes cannot be read out (defense in depth against a rogue
 * extension reading our React state).
 */
export async function deriveMasterKey(
    password: string,
    salt: Uint8Array,
): Promise<CryptoKey> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as unknown as BufferSource,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: KEY_LEN_BITS },
        false, // non-extractable
        ['encrypt', 'decrypt'],
    );
}

/* ─── Encrypt / decrypt ──────────────────────────────────────────────── */

/**
 * Encrypt an arbitrary JSON-serializable payload to the base64 envelope
 * format the server expects in `encryptedPayloadB64`.
 */
export async function encryptPayload(
    payload: unknown,
    key: CryptoKey,
): Promise<string> {
    const iv = randomBytes(IV_LEN);
    const enc = new TextEncoder();
    const plaintext = enc.encode(JSON.stringify(payload));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv as unknown as BufferSource },
            key,
            plaintext as unknown as BufferSource,
        ),
    );
    const envelope = new Uint8Array(1 + iv.byteLength + ciphertext.byteLength);
    envelope[0] = ENVELOPE_VERSION;
    envelope.set(iv, 1);
    envelope.set(ciphertext, 1 + iv.byteLength);
    return bytesToBase64(envelope);
}

/**
 * Decrypt an envelope produced by {@link encryptPayload}. Throws if the
 * version byte is unknown or the GCM tag verification fails.
 */
export async function decryptPayload<T = unknown>(
    envelopeB64: string,
    key: CryptoKey,
): Promise<T> {
    const env = base64ToBytes(envelopeB64);
    if (env.byteLength < 1 + IV_LEN + 16) {
        throw new Error('sabvault: envelope too short');
    }
    if (env[0] !== ENVELOPE_VERSION) {
        throw new Error(`sabvault: unsupported envelope version ${env[0]}`);
    }
    const iv = env.slice(1, 1 + IV_LEN);
    const ciphertext = env.slice(1 + IV_LEN);
    const plaintext = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        ciphertext as unknown as BufferSource,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/* ─── Verification helpers ──────────────────────────────────────────── */

/**
 * Tiny encrypted canary the client stores in the user's vault-key record.
 * If decryption of this canary succeeds, the master password is correct;
 * if it throws, we surface "wrong password" without writing an audit row
 * server-side until the user proves identity.
 */
export async function makeCanary(key: CryptoKey): Promise<string> {
    return encryptPayload({ sabvault: 'canary', v: 1 }, key);
}

export async function verifyCanary(envelopeB64: string, key: CryptoKey): Promise<boolean> {
    try {
        const out = await decryptPayload<{ sabvault?: string }>(envelopeB64, key);
        return out?.sabvault === 'canary';
    } catch {
        return false;
    }
}

/* ─── Password strength (cleartext-only, never persisted) ───────────── */

/**
 * Heuristic strength scorer — runs in the browser before encryption so the
 * server-side `strength` flag can be set without ever seeing the
 * cleartext. Score: 0–4, mapped to weak/fair/good/strong.
 */
export function scorePasswordStrength(
    pw: string,
): { score: 0 | 1 | 2 | 3 | 4; label: 'weak' | 'fair' | 'good' | 'strong' | 'very_strong' } {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    const label =
        score === 0 || score === 1
            ? 'weak'
            : score === 2
              ? 'fair'
              : score === 3
                ? 'good'
                : score === 4
                  ? 'strong'
                  : 'very_strong';
    return { score: score as 0 | 1 | 2 | 3 | 4, label };
}

/* ─── HIBP k-anonymity helper (client-only) ─────────────────────────── */

/**
 * Hash a password with SHA-1 and return `{ prefix, suffix }` so the caller
 * can hit the HIBP range API (`https://api.pwnedpasswords.com/range/PREFIX`)
 * — the full hash is never sent, only the first 5 hex chars. The verdict
 * (boolean) is what gets reported back to `sabvaultBreachAlertsApi.upsert`.
 */
export async function hibpKAnonymityHash(
    password: string,
): Promise<{ prefix: string; suffix: string }> {
    const buf = await crypto.subtle.digest(
        'SHA-1',
        new TextEncoder().encode(password) as unknown as BufferSource,
    );
    const hex = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    return { prefix: hex.slice(0, 5), suffix: hex.slice(5) };
}

export const SABVAULT_CRYPTO_PARAMS = Object.freeze({
    pbkdf2Iterations: PBKDF2_ITERATIONS,
    saltLen: SALT_LEN,
    ivLen: IV_LEN,
    keyLenBits: KEY_LEN_BITS,
    envelopeVersion: ENVELOPE_VERSION,
    algorithm: 'AES-GCM-256' as const,
});

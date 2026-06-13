import 'server-only';

/**
 * SabMail OpenPGP helpers — plain server lib (no DB, no tenancy).
 *
 * End-to-end encryption is OPTIONAL: the `openpgp` package is NOT a hard
 * dependency. Every function dynamic-imports it as a NON-LITERAL specifier so
 * TypeScript compiles WITHOUT the package present, and returns a clean
 * `{ ok:false, error }` when it's absent — never a runtime crash.
 *
 *   Install with:  npm i openpgp
 *
 * The private key NEVER leaves the server unencrypted: the caller (server
 * actions) stores `privateKeyArmored` in Mongo and only ever hands the
 * `publicKeyArmored` + `fingerprint` to the client. These helpers are pure —
 * no logging of key material.
 */

export type PgpResult<T> = ({ ok: true } & T) | { ok: false; error: string };

const ABSENT_ERROR = 'Install openpgp (npm i openpgp) to enable encryption.';

/** Lazily load `openpgp` as an optional peer dep (null when not installed). */
async function loadOpenpgp(): Promise<any | null> {
  try {
    const mod = (await import(/* webpackIgnore: true */ ('openpgp' as string)).catch(
      () => null,
    )) as any;
    if (!mod) return null;
    // openpgp ships both default + named exports across bundlers.
    return (mod.default ?? mod) as any;
  } catch {
    return null;
  }
}

/** True when the optional `openpgp` package is installed and importable. */
export async function isPgpAvailable(): Promise<boolean> {
  return (await loadOpenpgp()) !== null;
}

/**
 * Generate a fresh PGP keypair for `{name,email}`. When a `passphrase` is
 * supplied the private key is protected with it (still stored server-side).
 * Returns the armored public + private keys and the key fingerprint.
 */
export async function generatePgpKeypair(
  name: string,
  email: string,
  passphrase?: string,
): Promise<
  PgpResult<{ publicKeyArmored: string; privateKeyArmored: string; fingerprint: string }>
> {
  const openpgp = await loadOpenpgp();
  if (!openpgp) return { ok: false, error: ABSENT_ERROR };

  const trimmedEmail = (email || '').trim();
  if (!trimmedEmail) return { ok: false, error: 'An email is required to generate a key.' };
  const displayName = (name || '').trim() || trimmedEmail;

  try {
    const opts: Record<string, unknown> = {
      type: 'ecc',
      curve: 'curve25519',
      userIDs: [{ name: displayName, email: trimmedEmail }],
      format: 'armored',
    };
    const pass = (passphrase || '').trim();
    if (pass) opts.passphrase = pass;

    const generated = (await openpgp.generateKey(opts)) as {
      publicKey: string;
      privateKey: string;
    };

    const fingerprint = await fingerprintFromArmored(openpgp, generated.publicKey);

    return {
      ok: true,
      publicKeyArmored: generated.publicKey,
      privateKeyArmored: generated.privateKey,
      fingerprint,
    };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}

/**
 * Extract the (uppercased, space-grouped) fingerprint from an armored public
 * (or private) key. Returns `''` when the package is absent or the key is
 * unreadable — callers may surface that as "unknown fingerprint".
 */
export async function pgpFingerprint(publicKeyArmored: string): Promise<string> {
  const openpgp = await loadOpenpgp();
  if (!openpgp) return '';
  try {
    return await fingerprintFromArmored(openpgp, publicKeyArmored);
  } catch {
    return '';
  }
}

/** Encrypt `plaintext` to `publicKeyArmored`; returns armored ciphertext. */
export async function encryptPgp(
  publicKeyArmored: string,
  plaintext: string,
): Promise<PgpResult<{ ciphertextArmored: string }>> {
  const openpgp = await loadOpenpgp();
  if (!openpgp) return { ok: false, error: ABSENT_ERROR };
  if (!publicKeyArmored?.trim()) return { ok: false, error: 'No public key to encrypt to.' };

  try {
    const publicKey = (await openpgp.readKey({ armoredKey: publicKeyArmored })) as any;
    const message = (await openpgp.createMessage({ text: plaintext ?? '' })) as any;
    const ciphertextArmored = (await openpgp.encrypt({
      message,
      encryptionKeys: publicKey,
      format: 'armored',
    })) as string;
    return { ok: true, ciphertextArmored };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}

/**
 * Decrypt armored `ciphertext` with `privateKeyArmored`, unlocking it with
 * `passphrase` when the private key is passphrase-protected.
 */
export async function decryptPgp(
  privateKeyArmored: string,
  passphrase: string | undefined,
  ciphertext: string,
): Promise<PgpResult<{ plaintext: string }>> {
  const openpgp = await loadOpenpgp();
  if (!openpgp) return { ok: false, error: ABSENT_ERROR };
  if (!privateKeyArmored?.trim()) return { ok: false, error: 'No private key available to decrypt.' };
  if (!ciphertext?.trim()) return { ok: false, error: 'Nothing to decrypt.' };

  try {
    let privateKey = (await openpgp.readPrivateKey({ armoredKey: privateKeyArmored })) as any;
    const pass = (passphrase || '').trim();
    if (!privateKey.isDecrypted?.()) {
      privateKey = (await openpgp.decryptKey({
        privateKey,
        passphrase: pass,
      })) as any;
    }
    const message = (await openpgp.readMessage({ armoredMessage: ciphertext })) as any;
    const decrypted = (await openpgp.decrypt({
      message,
      decryptionKeys: privateKey,
    })) as { data: unknown };
    return { ok: true, plaintext: String(decrypted.data ?? '') };
  } catch (e) {
    // openpgp throws a generic "decryption failed" on a wrong passphrase.
    return { ok: false, error: errText(e) };
  }
}

/**
 * Validate an armored public key (and, optionally, a private key + passphrase)
 * — used by the import action before persisting. Returns the canonical
 * fingerprint on success.
 */
export async function validatePgpKeys(input: {
  publicKeyArmored: string;
  privateKeyArmored?: string;
  passphrase?: string;
}): Promise<PgpResult<{ fingerprint: string; hasPrivate: boolean }>> {
  const openpgp = await loadOpenpgp();
  if (!openpgp) return { ok: false, error: ABSENT_ERROR };

  const pub = (input.publicKeyArmored || '').trim();
  if (!pub) return { ok: false, error: 'Paste an armored public key.' };

  try {
    const publicKey = (await openpgp.readKey({ armoredKey: pub })) as any;
    const fingerprint = formatFingerprint(String(publicKey.getFingerprint?.() ?? ''));

    let hasPrivate = false;
    const priv = (input.privateKeyArmored || '').trim();
    if (priv) {
      let privateKey = (await openpgp.readPrivateKey({ armoredKey: priv })) as any;
      const pass = (input.passphrase || '').trim();
      if (!privateKey.isDecrypted?.()) {
        // Verify the passphrase unlocks the key (throws if wrong).
        privateKey = (await openpgp.decryptKey({ privateKey, passphrase: pass })) as any;
      }
      hasPrivate = true;
    }

    return { ok: true, fingerprint, hasPrivate };
  } catch (e) {
    return { ok: false, error: errText(e) };
  }
}

/* ── internals ───────────────────────────────────────────────────────── */

async function fingerprintFromArmored(openpgp: any, armored: string): Promise<string> {
  const key = (await openpgp.readKey({ armoredKey: armored })) as any;
  return formatFingerprint(String(key.getFingerprint?.() ?? ''));
}

/** Group a 40-hex-char fingerprint into 4-char blocks, uppercased. */
function formatFingerprint(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (!hex) return '';
  return (hex.match(/.{1,4}/g) ?? [hex]).join(' ');
}

function errText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  const s = String(e ?? '').trim();
  return s || 'PGP operation failed.';
}

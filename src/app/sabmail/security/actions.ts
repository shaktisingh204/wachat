'use server';

import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import {
  decryptPgp,
  encryptPgp,
  generatePgpKeypair,
  isPgpAvailable,
  pgpFingerprint,
  validatePgpKeys,
} from '@/lib/sabmail/pgp';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Security / OpenPGP E2EE.
 *
 * One PGP keypair per workspace, stored as a `{ workspaceId, kind:'pgp' }`
 * document in the `sabmail_settings` collection (the settings collection
 * already holds a separate `{ workspaceId }` settings doc, so the `kind`
 * discriminator keeps the two side by side without a schema change).
 *
 * The PRIVATE key is stored server-side and NEVER returned to the client —
 * only `publicKeyArmored` + `fingerprint` cross the wire. Encryption is
 * OPTIONAL: when the `openpgp` package is absent every action degrades to a
 * clean availability banner instead of crashing.
 * ──────────────────────────────────────────────────────────────────── */

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Mongo shape of the per-workspace PGP key document. */
interface SabmailPgpDoc {
  workspaceId: string;
  kind: 'pgp';
  publicKeyArmored: string;
  privateKeyArmored: string;
  /** True when the private key is passphrase-protected. */
  encrypted: boolean;
  fingerprint: string;
  name?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Client-safe status (never carries the private key). */
export interface SabmailPgpStatus {
  /** Whether the optional `openpgp` package is installed on the server. */
  available: boolean;
  hasKey: boolean;
  publicKeyArmored?: string;
  fingerprint?: string;
  name?: string;
  email?: string;
  createdAt?: string;
  /** True when the stored private key is passphrase-protected. */
  encrypted?: boolean;
}

const PGP_FILTER = (workspaceId: string) => ({ workspaceId, kind: 'pgp' as const });

async function loadPgpDoc(workspaceId: string): Promise<SabmailPgpDoc | null> {
  const { db } = await connectToDatabase();
  return (await db
    .collection(SABMAIL_COLLECTIONS.pgpKeys)
    .findOne(PGP_FILTER(workspaceId))) as unknown as SabmailPgpDoc | null;
}

/* ── status ──────────────────────────────────────────────────────────── */

export async function getSabmailPgpStatus(): Promise<Result<{ status: SabmailPgpStatus }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  try {
    const available = await isPgpAvailable();
    const doc = await loadPgpDoc(workspaceId);
    if (!doc) {
      return { ok: true, status: { available, hasKey: false } };
    }
    return {
      ok: true,
      status: {
        available,
        hasKey: true,
        publicKeyArmored: doc.publicKeyArmored,
        fingerprint: doc.fingerprint,
        name: doc.name,
        email: doc.email,
        encrypted: !!doc.encrypted,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : undefined,
      },
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── generate ────────────────────────────────────────────────────────── */

export async function generateSabmailPgpKey(input: {
  name: string;
  email: string;
  passphrase?: string;
}): Promise<Result<{ status: SabmailPgpStatus }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  const email = (input.email || '').trim();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: 'Enter a valid email for the key identity.' };
  }
  const name = (input.name || '').trim();
  const passphrase = (input.passphrase || '').trim();

  try {
    const gen = await generatePgpKeypair(name, email, passphrase || undefined);
    if (!gen.ok) return { ok: false, error: gen.error };

    const now = new Date();
    const { db } = await connectToDatabase();
    await db.collection(SABMAIL_COLLECTIONS.pgpKeys).updateOne(
      PGP_FILTER(workspaceId),
      {
        $set: {
          publicKeyArmored: gen.publicKeyArmored,
          privateKeyArmored: gen.privateKeyArmored,
          encrypted: !!passphrase,
          fingerprint: gen.fingerprint,
          name: name || undefined,
          email,
          updatedAt: now,
        },
        $setOnInsert: { workspaceId, kind: 'pgp', createdAt: now },
      } as never,
      { upsert: true },
    );

    revalidatePath('/sabmail/security');
    return {
      ok: true,
      status: {
        available: true,
        hasKey: true,
        publicKeyArmored: gen.publicKeyArmored,
        fingerprint: gen.fingerprint,
        name: name || undefined,
        email,
        encrypted: !!passphrase,
        createdAt: now.toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── import ──────────────────────────────────────────────────────────── */

export async function importSabmailPgpKey(input: {
  publicKeyArmored: string;
  privateKeyArmored?: string;
  passphrase?: string;
  name?: string;
  email?: string;
}): Promise<Result<{ status: SabmailPgpStatus }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  const publicKeyArmored = (input.publicKeyArmored || '').trim();
  if (!publicKeyArmored) return { ok: false, error: 'Paste an armored public key.' };
  const privateKeyArmored = (input.privateKeyArmored || '').trim();
  const passphrase = (input.passphrase || '').trim();

  try {
    const valid = await validatePgpKeys({
      publicKeyArmored,
      privateKeyArmored: privateKeyArmored || undefined,
      passphrase: passphrase || undefined,
    });
    if (!valid.ok) return { ok: false, error: valid.error };

    const now = new Date();
    const { db } = await connectToDatabase();
    await db.collection(SABMAIL_COLLECTIONS.pgpKeys).updateOne(
      PGP_FILTER(workspaceId),
      {
        $set: {
          publicKeyArmored,
          // Only store a private key if one was provided + validated.
          privateKeyArmored: valid.hasPrivate ? privateKeyArmored : '',
          encrypted: valid.hasPrivate ? !!passphrase : false,
          fingerprint: valid.fingerprint,
          name: (input.name || '').trim() || undefined,
          email: (input.email || '').trim() || undefined,
          updatedAt: now,
        },
        $setOnInsert: { workspaceId, kind: 'pgp', createdAt: now },
      } as never,
      { upsert: true },
    );

    revalidatePath('/sabmail/security');
    return {
      ok: true,
      status: {
        available: true,
        hasKey: true,
        publicKeyArmored,
        fingerprint: valid.fingerprint,
        name: (input.name || '').trim() || undefined,
        email: (input.email || '').trim() || undefined,
        encrypted: valid.hasPrivate ? !!passphrase : false,
        createdAt: now.toISOString(),
      },
    };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── delete ──────────────────────────────────────────────────────────── */

export async function deleteSabmailPgpKey(): Promise<{ ok: true } | { ok: false; error: string }> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  try {
    const { db } = await connectToDatabase();
    await db.collection(SABMAIL_COLLECTIONS.pgpKeys).deleteOne(PGP_FILTER(workspaceId));
    revalidatePath('/sabmail/security');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── encrypt / decrypt round-trip test ───────────────────────────────── */

export async function testEncryptDecrypt(
  text: string,
  passphrase?: string,
): Promise<Result<{ ciphertext: string; roundtrip: string; ok: true }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

  const plaintext = text ?? '';
  if (!plaintext.trim()) return { ok: false, error: 'Enter some text to encrypt.' };

  try {
    const doc = await loadPgpDoc(workspaceId);
    if (!doc) return { ok: false, error: 'Generate or import a key first.' };
    if (!doc.publicKeyArmored) return { ok: false, error: 'This workspace has no public key.' };
    if (!doc.privateKeyArmored) {
      return {
        ok: false,
        error: 'No private key stored — only a public key was imported, so the round-trip test is unavailable.',
      };
    }

    const enc = await encryptPgp(doc.publicKeyArmored, plaintext);
    if (!enc.ok) return { ok: false, error: enc.error };

    // Prefer the passphrase the caller supplied; the stored key may be locked.
    const pass = (passphrase || '').trim();
    const dec = await decryptPgp(doc.privateKeyArmored, pass || undefined, enc.ciphertextArmored);
    if (!dec.ok) {
      return {
        ok: false,
        error: doc.encrypted
          ? `Decryption failed — check the passphrase. (${dec.error})`
          : dec.error,
      };
    }

    return { ok: true, ciphertext: enc.ciphertextArmored, roundtrip: dec.plaintext };
  } catch (e) {
    return { ok: false, error: getErrorMessage(e) };
  }
}

/* ── public-key fingerprint preview (no persistence) ─────────────────── */

/** Compute a fingerprint for an armored public key without storing it. */
export async function previewSabmailPgpFingerprint(
  publicKeyArmored: string,
): Promise<Result<{ fingerprint: string }>> {
  const workspaceId = await getSabmailWorkspaceId();
  if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
  const fingerprint = await pgpFingerprint((publicKeyArmored || '').trim());
  if (!fingerprint) return { ok: false, error: 'Could not read a key fingerprint from that input.' };
  return { ok: true, fingerprint };
}

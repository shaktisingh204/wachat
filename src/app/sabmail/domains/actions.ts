'use server';

import { generateKeyPairSync } from 'node:crypto';

import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { SABMAIL_COLLECTIONS } from '@/lib/sabmail/db/collections';
import { getSabmailWorkspaceId } from '@/lib/sabmail/workspace';
import { getErrorMessage } from '@/lib/utils';

/* ──────────────────────────────────────────────────────────────────────
 * SabMail — Domains & Deliverability.
 *
 * A sending domain (`sabmail_domains`) carries the DNS the user must add so
 * SabMail can authenticate mail sent on their behalf: SPF (TXT), DMARC (TXT)
 * and a DKIM TXT record. Verification is REAL — it resolves the live DNS
 * records with Node's resolver and flips status accordingly.
 *
 * The DKIM keypair is REAL and self-hosted: on add we generate a 2048-bit RSA
 * keypair with `node:crypto`, store ONLY the private key + selector in Mongo,
 * and publish the public key in the DKIM TXT record. The own-domain send path
 * (`@/lib/sabmail/sending`) uses the private key to DKIM-sign outgoing mail.
 *
 * Scoped per-workspace like every other SabMail collection. The DKIM private
 * key is a secret — it is NEVER projected back to the client (see `toRow`).
 * ──────────────────────────────────────────────────────────────────── */

export type SabmailDomainStatus = 'pending' | 'verified' | 'failed';

/** The `sabmail_domains` document shape (typed locally — the shared typed
 *  collection accessor only covers accounts/settings). */
export interface SabmailDomainDoc {
  _id?: ObjectId;
  workspaceId: string;
  domain: string;
  dkimSelector: string;
  /** PEM-encoded PKCS#8 RSA private key — SECRET, never returned to the client. */
  dkimPrivateKeyPem?: string;
  /** base64 DER (SPKI) of the public key — published in the DKIM TXT record. */
  dkimPublicKeyB64?: string;
  /** When the current DKIM keypair was generated. */
  dkimCreatedAt?: Date;
  status: SabmailDomainStatus;
  checks: { spf: boolean; dmarc: boolean; checkedAt?: Date };
  createdAt: Date;
}

/** Safe, client-serializable projection of a domain — NEVER includes the
 *  DKIM private key. The public key (base64 DER) is safe to expose. */
export interface SabmailDomainRow {
  id: string;
  domain: string;
  dkimSelector: string;
  /** base64 DER of the DKIM public key (null until a keypair exists). */
  dkimPublicKeyB64: string | null;
  dkimCreatedAt: string | null;
  status: SabmailDomainStatus;
  checks: { spf: boolean; dmarc: boolean; checkedAt: string | null };
  createdAt: string;
}

/** One DNS record the user should publish at their registrar. */
export interface SabmailDnsRecord {
  type: 'TXT' | 'CNAME';
  host: string;
  value: string;
  label: string;
}

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };
type VoidResult = { ok: true } | { ok: false; error: string };

/** RFC-ish hostname check: labels of a-z0-9/hyphen, at least one dot, valid TLD. */
const DOMAIN_RE =
  /^(?=.{1,253}$)(?!-)[a-z0-9-]{1,63}(?<!-)(?:\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

function toRow(doc: WithId<SabmailDomainDoc>): SabmailDomainRow {
  // NB: `dkimPrivateKeyPem` is intentionally never read here — it must stay server-side.
  return {
    id: String(doc._id),
    domain: doc.domain,
    dkimSelector: doc.dkimSelector,
    dkimPublicKeyB64: doc.dkimPublicKeyB64 ?? null,
    dkimCreatedAt: doc.dkimCreatedAt ? new Date(doc.dkimCreatedAt).toISOString() : null,
    status: doc.status,
    checks: {
      spf: !!doc.checks?.spf,
      dmarc: !!doc.checks?.dmarc,
      checkedAt: doc.checks?.checkedAt ? new Date(doc.checks.checkedAt).toISOString() : null,
    },
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

/* ── DKIM keypair (real, node:crypto, no optional dep) ────────────────── */

interface DkimKeypair {
  privateKeyPem: string;
  /** base64 DER (SPKI) — the PEM body with header/footer/newlines stripped. */
  publicKeyB64: string;
}

/**
 * Generate a 2048-bit RSA DKIM keypair. The private key is PEM/PKCS#8 (used to
 * sign outgoing mail); the public key is exported as SPKI PEM then reduced to
 * its base64 DER body for the `p=` value of the DKIM TXT record.
 */
function generateDkimKeypair(): DkimKeypair {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  // Strip PEM armor + all whitespace → base64 DER for the DKIM `p=` field.
  const publicKeyB64 = String(publicKey)
    .replace(/-----BEGIN PUBLIC KEY-----/g, '')
    .replace(/-----END PUBLIC KEY-----/g, '')
    .replace(/\s+/g, '');
  return { privateKeyPem: String(privateKey), publicKeyB64 };
}

/* ── recommended records (generation only) ───────────────────────────── */

/**
 * The DNS records the user must publish for `domain` with DKIM `selector`.
 *
 * The DKIM record is now a REAL self-hosted TXT record carrying the public key
 * we generated on add. When `publicKeyB64` is supplied (the stored DKIM public
 * key), the DKIM record is a `v=DKIM1; k=rsa; p=<b64>` TXT at
 * `<selector>._domainkey`. When it's absent (legacy domains with no keypair
 * yet), the value is a clear placeholder prompting the user to regenerate.
 */
export async function getRecommendedRecords(
  domain: string,
  selector: string,
  publicKeyB64?: string,
): Promise<SabmailDnsRecord[]> {
  const d = (domain || '').trim().toLowerCase();
  const sel = (selector || 'sabmail').trim().toLowerCase();
  const b64 = (publicKeyB64 || '').trim();
  const dkimValue = b64
    ? `v=DKIM1; k=rsa; p=${b64}`
    : 'v=DKIM1; k=rsa; p= (regenerate the DKIM key to populate this value)';
  return [
    {
      type: 'TXT',
      host: '@',
      value: 'v=spf1 include:_spf.sabmail.example ~all',
      label: 'SPF',
    },
    {
      type: 'TXT',
      host: '_dmarc',
      value: `v=DMARC1; p=none; rua=mailto:dmarc@${d}`,
      label: 'DMARC',
    },
    {
      type: 'TXT',
      host: `${sel}._domainkey`,
      value: dkimValue,
      label: 'DKIM',
    },
  ];
}

/* ── list ─────────────────────────────────────────────────────────────── */

export async function listSabmailDomains(): Promise<Result<{ domains: SabmailDomainRow[] }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const { db } = await connectToDatabase();
    const docs = await db
      .collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    return { ok: true, domains: docs.map((d) => toRow(d as WithId<SabmailDomainDoc>)) };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── add ──────────────────────────────────────────────────────────────── */

export async function addSabmailDomain(
  input: { domain: string },
): Promise<Result<{ domain: SabmailDomainRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };

    const domain = (input.domain || '').trim().toLowerCase().replace(/\.$/, '');
    if (!domain) return { ok: false, error: 'Enter a domain.' };
    if (!DOMAIN_RE.test(domain)) {
      return { ok: false, error: 'Enter a valid domain, e.g. mail.example.com.' };
    }

    const { db } = await connectToDatabase();
    const col = db.collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains);

    const existing = await col.findOne({ workspaceId, domain }, { projection: { _id: 1 } });
    if (existing) return { ok: false, error: 'That domain is already added.' };

    const dkimSelector = 'sabmail';
    const now = new Date();
    const keypair = generateDkimKeypair();
    const doc: SabmailDomainDoc = {
      workspaceId,
      domain,
      dkimSelector,
      dkimPrivateKeyPem: keypair.privateKeyPem,
      dkimPublicKeyB64: keypair.publicKeyB64,
      dkimCreatedAt: now,
      status: 'pending',
      checks: { spf: false, dmarc: false },
      createdAt: now,
    };
    const ins = await col.insertOne(doc as never);

    return {
      ok: true,
      domain: toRow({ ...doc, _id: ins.insertedId } as WithId<SabmailDomainDoc>),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── delete ───────────────────────────────────────────────────────────── */

export async function deleteSabmailDomain(id: string): Promise<VoidResult> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid domain id.' };

    const { db } = await connectToDatabase();
    const res = await db
      .collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains)
      .deleteOne({ _id: new ObjectId(id), workspaceId });
    if (res.deletedCount === 0) return { ok: false, error: 'Domain not found.' };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── regenerate DKIM keypair ──────────────────────────────────────────── */

/**
 * Rotate a domain's DKIM keypair: generate a fresh RSA pair, store the new
 * private key, and return the row carrying the new public key (base64 DER).
 * The user must then republish the `<selector>._domainkey` TXT record with the
 * new `p=` value. The private key is never returned.
 */
export async function regenerateSabmailDkim(
  id: string,
): Promise<Result<{ domain: SabmailDomainRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid domain id.' };

    const { db } = await connectToDatabase();
    const col = db.collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains);
    const existing = (await col.findOne({
      _id: new ObjectId(id),
      workspaceId,
    })) as WithId<SabmailDomainDoc> | null;
    if (!existing) return { ok: false, error: 'Domain not found.' };

    const keypair = generateDkimKeypair();
    const dkimCreatedAt = new Date();
    await col.updateOne(
      { _id: existing._id, workspaceId },
      {
        $set: {
          dkimPrivateKeyPem: keypair.privateKeyPem,
          dkimPublicKeyB64: keypair.publicKeyB64,
          dkimCreatedAt,
        },
      },
    );

    return {
      ok: true,
      domain: toRow({
        ...existing,
        dkimPublicKeyB64: keypair.publicKeyB64,
        dkimCreatedAt,
      } as WithId<SabmailDomainDoc>),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

/* ── verify (REAL DNS) ────────────────────────────────────────────────── */

/** True when an ENOTFOUND/ENODATA "record absent" error should be tolerated. */
function isAbsentDnsError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  return code === 'ENOTFOUND' || code === 'ENODATA';
}

/**
 * Resolve every TXT record for `name`; treat "no such record" as an empty
 * list rather than an error. Each TXT record is an array of string chunks
 * which DNS may split — join them before matching.
 */
async function resolveTxtFlat(
  resolveTxt: (hostname: string) => Promise<string[][]>,
  name: string,
): Promise<string[]> {
  try {
    const records = await resolveTxt(name);
    return records.map((chunks) => chunks.join(''));
  } catch (err) {
    if (isAbsentDnsError(err)) return [];
    throw err;
  }
}

export async function verifySabmailDomain(
  id: string,
): Promise<Result<{ domain: SabmailDomainRow }>> {
  try {
    const workspaceId = await getSabmailWorkspaceId();
    if (!workspaceId) return { ok: false, error: 'No active SabMail project.' };
    if (!id || !ObjectId.isValid(id)) return { ok: false, error: 'Invalid domain id.' };

    const { db } = await connectToDatabase();
    const col = db.collection<SabmailDomainDoc>(SABMAIL_COLLECTIONS.domains);
    const existing = (await col.findOne({
      _id: new ObjectId(id),
      workspaceId,
    })) as WithId<SabmailDomainDoc> | null;
    if (!existing) return { ok: false, error: 'Domain not found.' };

    const dns = (await import('node:dns/promises')) as unknown as {
      resolveTxt: (hostname: string) => Promise<string[][]>;
    };

    // SPF lives on the apex domain as a TXT starting with `v=spf1`.
    const spfRecords = await resolveTxtFlat(dns.resolveTxt, existing.domain);
    const spf = spfRecords.some((r) => /^v=spf1\b/i.test(r.trim()));

    // DMARC lives at `_dmarc.<domain>` as a TXT starting with `v=DMARC1`.
    const dmarcRecords = await resolveTxtFlat(dns.resolveTxt, `_dmarc.${existing.domain}`);
    const dmarc = dmarcRecords.some((r) => /^v=DMARC1\b/i.test(r.trim()));

    const checkedAt = new Date();
    const status: SabmailDomainStatus = spf && dmarc ? 'verified' : 'failed';

    await col.updateOne(
      { _id: existing._id, workspaceId },
      { $set: { status, checks: { spf, dmarc, checkedAt } } },
    );

    return {
      ok: true,
      domain: toRow({
        ...existing,
        status,
        checks: { spf, dmarc, checkedAt },
      } as WithId<SabmailDomainDoc>),
    };
  } catch (err) {
    return { ok: false, error: getErrorMessage(err) };
  }
}

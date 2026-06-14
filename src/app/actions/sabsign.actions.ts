'use server';

/**
 * SabSign server actions.
 *
 * Strategy:
 *   1. Prefer the Rust crates (`sabsign-envelopes`, `sabsign-templates`,
 *      `sabsign-fields`, `sabsign-audit`) for all CRUD + state-machine
 *      transitions.
 *   2. Fall back to Mongo (via `connectToDatabase`) for ancillary writes:
 *      OTP cache, bulk-batch metadata, and (TODO) audit-trail PDF blob
 *      handoff.
 *
 * Tenant scoping: every authenticated action runs its Rust calls inside
 * {@link withTenant}, which binds the Rust JWT `tid` claim to the selected
 * SabSign project (`getSabsignWorkspaceId`) so each `esign_*` collection is
 * isolated per workspace. When no project is selected (e.g. before the gate
 * is adopted) it falls back to the default per-user scoping. The PUBLIC sign
 * endpoints (`submitSignature`, `getSignView`) are intentionally NOT
 * tenant-wrapped — the external signer has no session and is authenticated by
 * their per-signer access token; Rust resolves the envelope by id alone.
 *
 * No emojis, no legacy `clay`, no raw external URLs — file refs are
 * SabFiles IDs (`docId`).
 */

import 'server-only';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createHash, randomBytes } from 'crypto';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { sabsignEnvelopesApi } from '@/lib/rust-client/sabsign-envelopes';
import { sabsignTemplatesApi } from '@/lib/rust-client/sabsign-templates';
import { sabsignFieldsApi } from '@/lib/rust-client/sabsign-fields';
import { sabsignAuditApi } from '@/lib/rust-client/sabsign-audit';
import { RustApiError, runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabsignWorkspaceId } from '@/lib/sabsign/workspace';
import { downloadSabfileBytes, uploadSabfileBytes } from '@/lib/sabsign/pdf/sabfiles-io';
import { renderSignedPdf } from '@/lib/sabsign/pdf/render-signed-pdf';
import { renderAuditTrailPdf } from '@/lib/sabsign/pdf/render-audit-trail-pdf';
import { sendSignInvites, sendOtpSms } from '@/lib/sabsign/notify';
import type {
  CreateEnvelopeInput,
  EnvelopeListParams,
  EnvelopeSigner,
  SabSignEnvelopeDoc,
  SignSubmissionInput,
  UpdateEnvelopeInput,
} from '@/lib/rust-client/sabsign-envelopes';
import type {
  CreateTemplateInput,
  SabSignTemplateDoc,
  InstantiateInput,
  UpdateTemplateInput,
} from '@/lib/rust-client/sabsign-templates';

// ── Helpers ──────────────────────────────────────────────────────────

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

function genToken(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}

async function requireUser() {
  const session = await getSession();
  if (!session?.user?._id) {
    throw new Error('Unauthorized');
  }
  return session.user;
}

/**
 * Run `fn` with every nested Rust call scoped to the active SabSign project
 * (`tid` claim). Falls back to the default per-user scoping when no project
 * is selected.
 */
async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  const ws = await getSabsignWorkspaceId();
  return ws ? runWithRustTenant(ws, fn) : fn();
}

function normaliseEnvelopeForCreate(input: CreateEnvelopeInput): CreateEnvelopeInput {
  // Ensure each signer has an id + access token. Rust generates these
  // server-side too, but doing it here lets the UI render the correct
  // sign URLs immediately after creation.
  const signers = (input.signers || []).map((s, i) => ({
    ...s,
    id: s.id || genToken(8),
    accessToken: s.accessToken || genToken(16),
    order: s.order ?? i + 1,
    status: s.status || 'pending',
  }));
  return { ...input, signers };
}

// ── Envelopes ────────────────────────────────────────────────────────

export async function listEnvelopes(params?: EnvelopeListParams) {
  await requireUser();
  try {
    return await withTenant(() => sabsignEnvelopesApi.list(params));
  } catch (err) {
    if (err instanceof RustApiError) {
      // Graceful empty fallback when Rust is unreachable / route unmounted.
      console.error('[sabsign] list failed:', err.message);
      return { items: [], page: 0, limit: 25, hasMore: false };
    }
    throw err;
  }
}

export async function getEnvelope(id: string) {
  await requireUser();
  return withTenant(() => sabsignEnvelopesApi.getById(id));
}

export async function createEnvelope(input: CreateEnvelopeInput) {
  await requireUser();
  const payload = normaliseEnvelopeForCreate(input);
  const res = await withTenant(() => sabsignEnvelopesApi.create(payload));
  revalidatePath('/sabsign');
  return res;
}

export async function updateEnvelope(id: string, patch: UpdateEnvelopeInput) {
  await requireUser();
  const res = await withTenant(() => sabsignEnvelopesApi.update(id, patch));
  revalidatePath('/sabsign');
  return res;
}

export async function deleteEnvelope(id: string) {
  await requireUser();
  const res = await withTenant(() => sabsignEnvelopesApi.delete(id));
  revalidatePath('/sabsign');
  return res;
}

export async function sendEnvelope(id: string, rotateTokens = false) {
  await requireUser();
  const res = await withTenant(() => sabsignEnvelopesApi.send(id, rotateTokens));
  // Dispatch invite emails to every `notified` signer (best-effort — uses the
  // owner's configured email transport; never fails the send).
  try {
    await sendSignInvites(res);
  } catch (e) {
    console.warn('[sabsign] sendSignInvites failed:', e);
  }
  revalidatePath('/sabsign');
  return res;
}

export async function voidEnvelope(id: string, reason?: string) {
  await requireUser();
  const res = await withTenant(() => sabsignEnvelopesApi.void(id, reason));
  revalidatePath('/sabsign');
  return res;
}

// Public sign-page submission. Does NOT require a SabNode session — the
// signer is an external party — but DOES require a valid `(signerId,
// accessToken)` pair which Rust verifies. NOT tenant-wrapped.
export async function submitSignature(envelopeId: string, input: SignSubmissionInput) {
  // OTP path: verify against the Mongo-backed cache issued by `issueSignerOtp`.
  if (input.otp) {
    const { db } = await connectToDatabase();
    const stored = await db
      .collection('esign_signer_otps')
      .findOne({ envelopeId, signerId: input.signerId });
    if (!stored || sha256(input.otp.trim()) !== stored.otpHash || stored.expiresAt < new Date()) {
      throw new Error('Invalid or expired OTP');
    }
    await db
      .collection('esign_signer_otps')
      .deleteOne({ envelopeId, signerId: input.signerId });
  }
  // Capture the signer's IP server-side for the audit trail (the client can't
  // be trusted to report its own IP). userAgent is supplied by the client.
  let ip = input.ip;
  if (!ip) {
    const hdrs = await headers();
    ip =
      hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      hdrs.get('x-real-ip') ||
      undefined;
  }
  return sabsignEnvelopesApi.submit(envelopeId, { ...input, ip });
}

/**
 * Public, signer-scoped envelope view for the sign page. No SabNode session —
 * the external signer is authenticated by `(signerId, token)`, which the Rust
 * side verifies. Returns the sanitized envelope (secrets stripped) plus the
 * resolved signer id, and marks the signer `viewed` as a side-effect. NOT
 * tenant-wrapped.
 */
export async function getSignView(envelopeId: string, signerId: string, token: string) {
  return sabsignEnvelopesApi.signView(envelopeId, signerId, token);
}

/**
 * Issue a 6-digit OTP for an SMS-OTP signer. Stored hashed in Mongo with
 * 10-minute TTL. The actual SMS send is a TODO — wire to the existing
 * SabSMS / Twilio sidecar.
 */
// Public — called from the sign page (no session). `phone` is supplied by the
// portal from the sanitized sign-view; SMS delivery is best-effort.
export async function issueSignerOtp(envelopeId: string, signerId: string, phone?: string) {
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const { db } = await connectToDatabase();
  await db.collection('esign_signer_otps').updateOne(
    { envelopeId, signerId },
    {
      $set: {
        envelopeId,
        signerId,
        otpHash: sha256(otp),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  if (phone) {
    try {
      await sendOtpSms(phone, otp);
    } catch (e) {
      console.warn('[sabsign] OTP SMS dispatch failed:', e);
    }
  }
  return { ok: true, otpPreview: process.env.NODE_ENV !== 'production' ? otp : undefined };
}

// ── Templates ────────────────────────────────────────────────────────

export async function listTemplates(params?: { page?: number; limit?: number; q?: string }) {
  await requireUser();
  try {
    return await withTenant(() => sabsignTemplatesApi.list(params));
  } catch (err) {
    if (err instanceof RustApiError) {
      return { items: [], page: 0, limit: 25, hasMore: false };
    }
    throw err;
  }
}

export async function createTemplate(input: CreateTemplateInput) {
  await requireUser();
  const res = await withTenant(() => sabsignTemplatesApi.create(input));
  revalidatePath('/sabsign/templates');
  return res;
}

export async function updateTemplate(id: string, patch: UpdateTemplateInput) {
  await requireUser();
  return withTenant(() => sabsignTemplatesApi.update(id, patch));
}

export async function deleteTemplate(id: string) {
  await requireUser();
  const res = await withTenant(() => sabsignTemplatesApi.delete(id));
  revalidatePath('/sabsign/templates');
  return res;
}

export async function instantiateTemplate(id: string, input: InstantiateInput) {
  await requireUser();
  const res = await withTenant(() => sabsignTemplatesApi.instantiate(id, input));
  revalidatePath('/sabsign');
  return res;
}

/**
 * Create a template by snapshotting an existing envelope.
 */
export async function createTemplateFromEnvelope(envelopeId: string, name: string) {
  await requireUser();
  return withTenant(async () => {
    const env: SabSignEnvelopeDoc = await sabsignEnvelopesApi.getById(envelopeId);
    const tmpl: CreateTemplateInput = {
      name,
      docId: env.docId,
      docUrl: env.docUrl,
      docName: env.docName,
      description: `Cloned from envelope ${env.name}`,
      routingOrder: env.routingOrder,
      routingRules: env.routingRules,
      recipientSlots: env.signers.map((s) => ({
        role: s.role,
        label: s.name || s.role,
        order: s.order,
        authMethod: s.authMethod,
      })),
      fields: env.fields,
    };
    return sabsignTemplatesApi.create(tmpl);
  });
}

// ── Bulk send ────────────────────────────────────────────────────────

interface BulkSignerRow {
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

/**
 * Parse CSV signers + spawn N envelopes from a template, one per row.
 * The Mongo `esign_bulk_batches` collection records the batch so the UI
 * can show progress.
 */
export async function bulkSendFromTemplate(
  templateId: string,
  rows: BulkSignerRow[],
  envelopeNamePrefix = 'Envelope',
) {
  const user = await requireUser();
  if (!rows.length) throw new Error('No signers in CSV');

  const { db } = await connectToDatabase();
  const batchId = genToken(12);
  const workspaceId = (await getSabsignWorkspaceId()) ?? String(user._id);
  // `_id` is intentionally a string for bulk batches — `batchId` is the
  // public-facing handle the UI tracks. Mongo accepts non-ObjectId `_id`
  // as long as it's unique within the collection.
  await db.collection('esign_bulk_batches').insertOne({
    _id: batchId as any,
    userId: String(user._id),
    workspaceId,
    templateId,
    totalRows: rows.length,
    spawnedEnvelopes: 0,
    createdAt: new Date(),
    status: 'running',
  });

  const envelopeIds = await withTenant(async () => {
    const tmpl: SabSignTemplateDoc = await sabsignTemplatesApi.getById(templateId);
    const ids: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const role = row.role || tmpl.recipientSlots[0]?.role || 'signer';
      const signer: EnvelopeSigner = {
        id: genToken(8),
        role,
        name: row.name,
        email: row.email,
        phone: row.phone,
        authMethod: 'email',
        order: 1,
        status: 'pending',
        accessToken: genToken(16),
      };
      try {
        const res = await sabsignTemplatesApi.instantiate(templateId, {
          envelopeName: `${envelopeNamePrefix} #${i + 1} (${row.name})`,
          signers: [signer],
        });
        ids.push(res.envelopeId);
        // Tag the new envelope with the bulk batch id via direct Mongo.
        // NOTE: `esign_envelopes._id` is a STRING (hex) — query by the raw
        // id, never `new ObjectId(...)`.
        await db.collection('esign_envelopes').updateOne(
          { _id: res.envelopeId as any },
          { $set: { bulkBatchId: batchId } },
        );
        // Actually send each envelope (draft → sent) + e-mail its signer.
        try {
          const sent = await sabsignEnvelopesApi.send(res.envelopeId);
          await sendSignInvites(sent);
        } catch (e) {
          console.warn(`[sabsign] bulk send/email row ${i} failed:`, e);
        }
        await db
          .collection('esign_bulk_batches')
          .updateOne({ _id: batchId as any }, { $inc: { spawnedEnvelopes: 1 } });
      } catch (err) {
        console.error(`[sabsign] bulk row ${i} failed:`, err);
      }
    }
    return ids;
  });

  await db
    .collection('esign_bulk_batches')
    .updateOne({ _id: batchId as any }, { $set: { status: 'completed' } });

  revalidatePath('/sabsign');
  return { batchId, envelopeIds };
}

// ── Field analytics + audit ──────────────────────────────────────────

export async function getFieldUsage(status?: string) {
  await requireUser();
  try {
    return await withTenant(() => sabsignFieldsApi.usage(status));
  } catch {
    return { buckets: [] };
  }
}

export async function getEnvelopeAudit(envelopeId: string) {
  await requireUser();
  try {
    return await withTenant(() => sabsignAuditApi.list({ envelopeId, limit: 1000 }));
  } catch {
    return { items: [], chainValid: true };
  }
}

export async function listAuditEvents(params?: {
  envelopeId?: string;
  eventType?: string;
  limit?: number;
}) {
  await requireUser();
  try {
    return await withTenant(() => sabsignAuditApi.list(params));
  } catch {
    return { items: [], chainValid: true };
  }
}

// ── Audit trail PDF ──────────────────────────────────────────────────

/**
 * Build the audit-trail PDF and persist it to SabFiles.
 *
 * TODO (W0.4): actually render a PDF via `pdf-lib`/`jspdf`, upload to
 * SabFiles, then patch `auditTrailPdfId` on the envelope. For now we persist
 * the structured audit JSON snapshot so the audit-trail page can render.
 */
export async function generateAuditTrailPdf(envelopeId: string) {
  await requireUser();
  const { env, audit } = await withTenant(async () => {
    const env = await sabsignEnvelopesApi.getById(envelopeId);
    const audit = await sabsignAuditApi.list({ envelopeId, limit: 5000 });
    return { env, audit };
  });

  const summary = {
    envelope: {
      id: env._id,
      name: env.name,
      status: env.status,
      docName: env.docName,
      createdAt: env.createdAt,
      completedAt: env.completedAt,
    },
    signers: env.signers.map((s) => ({
      name: s.name,
      email: s.email,
      role: s.role,
      authMethod: s.authMethod,
      status: s.status,
      ip: s.ipAddress,
      completedAt: s.completedAt,
      declinedAt: s.declinedAt,
    })),
    events: audit.items,
    chainValid: audit.chainValid,
  };

  // Persist the structured audit JSON to Mongo so the audit-trail page can
  // render even if the PDF renderer isn't wired yet.
  const { db } = await connectToDatabase();
  const result = await db.collection('esign_audit_trail_snapshots').insertOne({
    envelopeId,
    payload: summary,
    createdAt: new Date(),
  });

  return { snapshotId: result.insertedId.toString(), summary };
}

/**
 * Finalize a COMPLETED envelope: flatten the filled fields into the source PDF
 * (the signed document) + render the audit-trail certificate, store both in
 * SabFiles, and patch `signedDocId` / `auditTrailPdfId` onto the envelope.
 *
 * Idempotent — re-running when both ids already exist is a no-op. Safe to call
 * from the sender's envelope-detail page on first view of a completed
 * envelope, or from a worker. The envelope read/patch is tenant-scoped; the
 * SabFiles I/O runs under the DEFAULT user scope (files are per-user, not
 * per-project).
 */
export async function finalizeEnvelope(envelopeId: string) {
  await requireUser();

  const { env, audit } = await withTenant(async () => {
    const env = await sabsignEnvelopesApi.getById(envelopeId);
    const audit = await sabsignAuditApi.list({ envelopeId, limit: 5000 });
    return { env, audit };
  });

  if (env.status !== 'completed') {
    return { ok: false as const, reason: 'Envelope is not completed.' };
  }
  if (env.signedDocId && env.auditTrailPdfId) {
    return {
      ok: true as const,
      signedDocId: env.signedDocId,
      auditTrailPdfId: env.auditTrailPdfId,
      alreadyDone: true,
    };
  }

  // ── signed PDF (flatten field values) — user-scoped SabFiles I/O ──
  let signedDocId = env.signedDocId;
  if (!signedDocId && env.docId) {
    try {
      const orig = await downloadSabfileBytes(env.docId);
      const signed = await renderSignedPdf(orig, env);
      const up = await uploadSabfileBytes({
        name: `${env.name} (signed).pdf`,
        mime: 'application/pdf',
        bytes: signed,
      });
      signedDocId = up.id;
    } catch (e) {
      console.error('[sabsign] signed PDF generation failed:', e);
    }
  }

  // ── audit-trail certificate PDF ──
  let auditTrailPdfId = env.auditTrailPdfId;
  if (!auditTrailPdfId) {
    try {
      const summary = {
        envelope: {
          id: env._id,
          name: env.name,
          status: env.status,
          docName: env.docName,
          createdAt: env.createdAt,
          completedAt: env.completedAt,
        },
        signers: env.signers.map((s) => ({
          name: s.name,
          email: s.email,
          role: s.role,
          authMethod: s.authMethod,
          status: s.status,
          ip: s.ipAddress,
          completedAt: s.completedAt,
          declinedAt: s.declinedAt,
        })),
        events: audit.items.map((e) => ({
          eventType: e.eventType,
          ts: e.ts,
          signerId: e.signerId,
          ip: e.ip,
        })),
        chainValid: audit.chainValid,
      };
      const auditPdf = renderAuditTrailPdf(summary);
      const up = await uploadSabfileBytes({
        name: `${env.name} (certificate).pdf`,
        mime: 'application/pdf',
        bytes: auditPdf,
      });
      auditTrailPdfId = up.id;
    } catch (e) {
      console.error('[sabsign] audit PDF generation failed:', e);
    }
  }

  // Patch via direct Mongo — UpdateEnvelopeInput doesn't carry these fields.
  // `esign_envelopes._id` is a STRING, so query by the raw id (+ tenant).
  const { db } = await connectToDatabase();
  const ws = await getSabsignWorkspaceId();
  const filter: Record<string, unknown> = ws
    ? { _id: envelopeId, tenantId: ws }
    : { _id: envelopeId };
  await db.collection('esign_envelopes').updateOne(filter, {
    $set: { signedDocId, auditTrailPdfId, updatedAt: new Date().toISOString() },
  });

  revalidatePath('/sabsign');
  return { ok: true as const, signedDocId, auditTrailPdfId };
}

// ── In-person / kiosk ────────────────────────────────────────────────

/**
 * Build a kiosk URL for an in-person signing session.
 * The PIN is hashed and stored on the signer; only the URL + PIN need
 * to travel to the kiosk device.
 */
export async function generateKioskLink(envelopeId: string, signerId: string, pin: string) {
  await requireUser();
  return withTenant(async () => {
    const env = await sabsignEnvelopesApi.getById(envelopeId);
    const signer = env.signers.find((s) => s.id === signerId);
    if (!signer) throw new Error('Signer not found');
    // Patch the signer with pinHash + authMethod=pin via update.
    const updated = env.signers.map((s) =>
      s.id === signerId
        ? { ...s, authMethod: 'pin' as const, pinHash: sha256(pin.trim()) }
        : s,
    );
    await sabsignEnvelopesApi.update(envelopeId, { signers: updated });
    return {
      url: `/sabsign/kiosk/${envelopeId}?signerId=${signerId}`,
      pin,
    };
  });
}

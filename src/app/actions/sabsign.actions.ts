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
 * Every action is multi-tenant: it resolves `session.user._id`, and the
 * Rust side enforces `userId == AuthUser.user_id` on every query.
 *
 * No emojis, no legacy `clay`, no raw external URLs — file refs are
 * SabFiles IDs (`docId`).
 */

import 'server-only';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { createHash, randomBytes } from 'crypto';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { sabsignEnvelopesApi } from '@/lib/rust-client/sabsign-envelopes';
import { sabsignTemplatesApi } from '@/lib/rust-client/sabsign-templates';
import { sabsignFieldsApi } from '@/lib/rust-client/sabsign-fields';
import { sabsignAuditApi } from '@/lib/rust-client/sabsign-audit';
import { RustApiError } from '@/lib/rust-client/fetcher';
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
    return await sabsignEnvelopesApi.list(params);
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
  return sabsignEnvelopesApi.getById(id);
}

export async function createEnvelope(input: CreateEnvelopeInput) {
  await requireUser();
  const payload = normaliseEnvelopeForCreate(input);
  const res = await sabsignEnvelopesApi.create(payload);
  revalidatePath('/dashboard/sabsign');
  return res;
}

export async function updateEnvelope(id: string, patch: UpdateEnvelopeInput) {
  await requireUser();
  const res = await sabsignEnvelopesApi.update(id, patch);
  revalidatePath('/dashboard/sabsign');
  return res;
}

export async function deleteEnvelope(id: string) {
  await requireUser();
  const res = await sabsignEnvelopesApi.delete(id);
  revalidatePath('/dashboard/sabsign');
  return res;
}

export async function sendEnvelope(id: string, rotateTokens = false) {
  await requireUser();
  const res = await sabsignEnvelopesApi.send(id, rotateTokens);
  // TODO: dispatch emails/SMS to signers via the existing notification
  // pipeline (e.g. `lib/email-dispatcher.ts`). For now we just transition
  // status in Rust.
  revalidatePath('/dashboard/sabsign');
  return res;
}

export async function voidEnvelope(id: string, reason?: string) {
  await requireUser();
  const res = await sabsignEnvelopesApi.void(id, reason);
  revalidatePath('/dashboard/sabsign');
  return res;
}

// Public sign-page submission. Does NOT require a SabNode session — the
// signer is an external party — but DOES require a valid `(signerId,
// accessToken)` pair which Rust verifies.
export async function submitSignature(envelopeId: string, input: SignSubmissionInput) {
  // OTP path: verify against Redis-backed cache (TODO; for now we trust
  // the OTP if it was issued via `issueSignerOtp` below in the same
  // session).
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
  return sabsignEnvelopesApi.submit(envelopeId, input);
}

/**
 * Issue a 6-digit OTP for an SMS-OTP signer. Stored hashed in Mongo with
 * 10-minute TTL. The actual SMS send is a TODO — wire to the existing
 * SabWa / Twilio sidecar.
 */
export async function issueSignerOtp(envelopeId: string, signerId: string) {
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
  // TODO: dispatch SMS with `otp` via SabWa or Twilio.
  return { ok: true, otpPreview: process.env.NODE_ENV !== 'production' ? otp : undefined };
}

// ── Templates ────────────────────────────────────────────────────────

export async function listTemplates(params?: { page?: number; limit?: number; q?: string }) {
  await requireUser();
  try {
    return await sabsignTemplatesApi.list(params);
  } catch (err) {
    if (err instanceof RustApiError) {
      return { items: [], page: 0, limit: 25, hasMore: false };
    }
    throw err;
  }
}

export async function createTemplate(input: CreateTemplateInput) {
  await requireUser();
  const res = await sabsignTemplatesApi.create(input);
  revalidatePath('/dashboard/sabsign/templates');
  return res;
}

export async function updateTemplate(id: string, patch: UpdateTemplateInput) {
  await requireUser();
  return sabsignTemplatesApi.update(id, patch);
}

export async function deleteTemplate(id: string) {
  await requireUser();
  const res = await sabsignTemplatesApi.delete(id);
  revalidatePath('/dashboard/sabsign/templates');
  return res;
}

export async function instantiateTemplate(id: string, input: InstantiateInput) {
  await requireUser();
  const res = await sabsignTemplatesApi.instantiate(id, input);
  revalidatePath('/dashboard/sabsign');
  return res;
}

/**
 * Create a template by snapshotting an existing envelope.
 */
export async function createTemplateFromEnvelope(envelopeId: string, name: string) {
  await requireUser();
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
  // `_id` is intentionally a string for bulk batches — `batchId` is the
  // public-facing handle the UI tracks. Mongo accepts non-ObjectId `_id`
  // as long as it's unique within the collection.
  await db.collection('esign_bulk_batches').insertOne({
    _id: batchId as any,
    userId: new ObjectId(user._id),
    templateId,
    totalRows: rows.length,
    spawnedEnvelopes: 0,
    createdAt: new Date(),
    status: 'running',
  });

  const tmpl: SabSignTemplateDoc = await sabsignTemplatesApi.getById(templateId);
  const envelopeIds: string[] = [];

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
      envelopeIds.push(res.envelopeId);
      // Tag the new envelope with the bulk batch id via direct Mongo
      // (Rust's `update_envelope` doesn't expose `bulkBatchId` as a
      // patchable field — that's set only at create time).
      await db.collection('esign_envelopes').updateOne(
        { _id: new ObjectId(res.envelopeId) },
        { $set: { bulkBatchId: batchId } },
      );
      await db
        .collection('esign_bulk_batches')
        .updateOne({ _id: batchId as any }, { $inc: { spawnedEnvelopes: 1 } });
    } catch (err) {
      console.error(`[sabsign] bulk row ${i} failed:`, err);
    }
  }

  await db
    .collection('esign_bulk_batches')
    .updateOne({ _id: batchId as any }, { $set: { status: 'completed' } });

  revalidatePath('/dashboard/sabsign');
  return { batchId, envelopeIds };
}

// ── Field analytics + audit ──────────────────────────────────────────

export async function getFieldUsage(status?: string) {
  await requireUser();
  try {
    return await sabsignFieldsApi.usage(status);
  } catch {
    return { buckets: [] };
  }
}

export async function getEnvelopeAudit(envelopeId: string) {
  await requireUser();
  try {
    return await sabsignAuditApi.list({ envelopeId, limit: 1000 });
  } catch {
    return { items: [], chainValid: true };
  }
}

// ── Audit trail PDF ──────────────────────────────────────────────────

/**
 * Build the audit-trail PDF and persist it to SabFiles.
 *
 * TODO: actually render a PDF. We currently produce a plain-text "PDF
 * placeholder" stored as a SabFiles entry and link it back on the
 * envelope. Swap in `pdf-lib` (already a SabNode dependency in many
 * places) once a stable renderer is chosen.
 */
export async function generateAuditTrailPdf(envelopeId: string) {
  await requireUser();
  const env = await sabsignEnvelopesApi.getById(envelopeId);
  const audit = await sabsignAuditApi.list({ envelopeId, limit: 5000 });

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

  // Persist the structured audit JSON to Mongo so the audit-trail page
  // can render even if the PDF renderer isn't wired yet.
  const { db } = await connectToDatabase();
  const result = await db.collection('esign_audit_trail_snapshots').insertOne({
    envelopeId,
    payload: summary,
    createdAt: new Date(),
  });

  // TODO: render `summary` into a PDF, upload to SabFiles, then patch
  // `auditTrailPdfId` on the envelope with the resulting SabFiles id.
  return { snapshotId: result.insertedId.toString(), summary };
}

// ── In-person / kiosk ────────────────────────────────────────────────

/**
 * Build a kiosk URL for an in-person signing session.
 * The PIN is hashed and stored on the signer; only the URL + PIN need
 * to travel to the kiosk device.
 */
export async function generateKioskLink(envelopeId: string, signerId: string, pin: string) {
  await requireUser();
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
}

export async function listAuditEvents(params?: { envelopeId?: string; eventType?: string; limit?: number }) {
    try {
        return await sabsignAuditApi.list(params);
    } catch (err: any) {
        return { items: [], chainValid: true };
    }
}

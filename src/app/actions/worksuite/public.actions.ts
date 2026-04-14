'use server';

/**
 * Worksuite — public (unauthenticated) customer-portal actions.
 *
 * These actions back the pages under `/p/*` that customers/leads reach
 * via a shared URL (no login required). They MUST NOT call
 * `requireSession()` — instead the tenant (`userId`) is resolved from
 * the token record or form record referenced in each call.
 *
 * Collections:
 *   crm_public_tokens, crm_public_submissions.
 *
 * Tenant-scoped resources referenced via tokens:
 *   crm_proposals, crm_proposal_signs,
 *   crm_estimate_requests, crm_accept_estimates,
 *   crm_invoices, crm_payments, crm_invoice_payment_details,
 *   crm_contracts, crm_contract_signs,
 *   crm_lead_custom_forms, crm_leads,
 *   crm_ticket_custom_forms, crm_tickets,
 *   crm_gdpr_settings, crm_purpose_consents, crm_purpose_consent_leads.
 */

import crypto from 'crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ObjectId, type Filter, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { requireSession, serialize } from '@/lib/hr-crud';
import type {
  WsPublicAccessToken,
  WsPublicResourceType,
  WsPublicSubmission,
} from '@/lib/worksuite/public-types';

/* ── Collections ─────────────────────────────────────────────── */

const COL = {
  tokens: 'crm_public_tokens',
  submissions: 'crm_public_submissions',
  proposals: 'crm_proposals',
  proposalItems: 'crm_proposal_items',
  proposalSigns: 'crm_proposal_signs',
  estimateRequests: 'crm_estimate_requests',
  acceptEstimates: 'crm_accept_estimates',
  invoices: 'crm_invoices',
  invoicePaymentDetails: 'crm_invoice_payment_details',
  payments: 'crm_payments',
  contracts: 'crm_contracts',
  contractSigns: 'crm_contract_signs',
  leadForms: 'crm_lead_custom_forms',
  leads: 'crm_leads',
  ticketForms: 'crm_ticket_custom_forms',
  tickets: 'crm_tickets',
  gdprSettings: 'crm_gdpr_settings',
  purposeConsents: 'crm_purpose_consents',
  purposeConsentLeads: 'crm_purpose_consent_leads',
} as const;

type Result<T = {}> =
  | ({ success: true } & T)
  | { success: false; error: string };

/* ── Helpers ─────────────────────────────────────────────────── */

function randomToken(bytes = 24): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

async function clientMeta(): Promise<{ ip: string; userAgent: string }> {
  try {
    const h = await headers();
    const ip =
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      '';
    const userAgent = h.get('user-agent') || '';
    return { ip, userAgent };
  } catch {
    return { ip: '', userAgent: '' };
  }
}

function ensureObjectId(v: unknown): ObjectId | null {
  if (v instanceof ObjectId) return v;
  if (typeof v === 'string' && ObjectId.isValid(v)) return new ObjectId(v);
  return null;
}

async function resolveResourceTenant(
  resourceType: WsPublicResourceType,
  resourceId: string,
): Promise<ObjectId | null> {
  if (!ObjectId.isValid(resourceId)) return null;
  const { db } = await connectToDatabase();
  const _id = new ObjectId(resourceId);
  const colName =
    resourceType === 'proposal'
      ? COL.proposals
      : resourceType === 'estimate'
        ? COL.estimateRequests
        : resourceType === 'invoice'
          ? COL.invoices
          : COL.contracts;
  const doc = await db.collection(colName).findOne(
    { _id },
    { projection: { userId: 1 } },
  );
  if (!doc) return null;
  return ensureObjectId((doc as { userId?: unknown }).userId);
}

/* ══════════════════════════════════════════════════════════════
 * TOKEN LIFECYCLE
 * ════════════════════════════════════════════════════════════ */

interface GeneratePublicTokenOptions {
  /** ISO date string or null for never expires. */
  expiresAt?: string | null;
  /** Optional max # of resolves. */
  usesAllowed?: number | null;
}

/**
 * Authenticated: generate a public shareable token for a resource.
 * The token's `userId` is resolved from the underlying resource so that
 * the public resolver can scope correctly with just the token string.
 */
export async function generatePublicToken(
  resourceType: WsPublicResourceType,
  resourceId: string,
  opts: GeneratePublicTokenOptions = {},
): Promise<Result<{ token: string; url: string }>> {
  const session = await requireSession();
  if (!session) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(resourceId)) {
    return { success: false, error: 'Invalid resource id' };
  }
  const tenantId = await resolveResourceTenant(resourceType, resourceId);
  if (!tenantId || tenantId.toHexString() !== session._id) {
    return { success: false, error: 'Resource not found' };
  }

  const { db } = await connectToDatabase();
  const now = new Date();
  const token = randomToken();
  const doc: Omit<WsPublicAccessToken, '_id'> = {
    userId: tenantId,
    resource_type: resourceType,
    resource_id: new ObjectId(resourceId),
    token,
    expires_at: opts.expiresAt ? new Date(opts.expiresAt) : undefined,
    uses_allowed:
      typeof opts.usesAllowed === 'number' && opts.usesAllowed > 0
        ? Math.floor(opts.usesAllowed)
        : undefined,
    uses_count: 0,
    revoked: false,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(COL.tokens).insertOne(doc as Record<string, unknown>);
  const url = `/p/${resourceType}/${token}`;
  return { success: true, token, url };
}

export async function revokePublicToken(tokenId: string): Promise<Result> {
  const session = await requireSession();
  if (!session) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(tokenId)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const userId = new ObjectId(session._id);
  const res = await db.collection(COL.tokens).updateOne(
    { _id: new ObjectId(tokenId), userId },
    { $set: { revoked: true, updatedAt: new Date() } },
  );
  if (!res.matchedCount) return { success: false, error: 'Token not found' };
  return { success: true };
}

/**
 * PUBLIC: resolve a token string to its resource, without auth.
 * Returns `null` if token is invalid / expired / exhausted / revoked.
 */
export async function resolvePublicToken(token: string): Promise<
  | {
      token: WsPublicAccessToken & { _id: string };
      resource:
        | { type: 'proposal'; proposal: Record<string, unknown>; items: unknown[]; signs: unknown[] }
        | { type: 'estimate'; estimate: Record<string, unknown>; acceptances: unknown[] }
        | { type: 'invoice'; invoice: Record<string, unknown>; payments: unknown[] }
        | { type: 'contract'; contract: Record<string, unknown>; signs: unknown[] };
    }
  | null
> {
  if (!token) return null;
  const { db } = await connectToDatabase();
  const tokenDoc = await db.collection(COL.tokens).findOne({ token });
  if (!tokenDoc) return null;
  const typed = tokenDoc as unknown as WithId<WsPublicAccessToken>;
  if (typed.revoked) return null;
  if (typed.expires_at && new Date(typed.expires_at).getTime() < Date.now()) {
    return null;
  }
  if (
    typeof typed.uses_allowed === 'number' &&
    (typed.uses_count || 0) >= typed.uses_allowed
  ) {
    return null;
  }

  const userId = ensureObjectId(typed.userId);
  const resourceId = ensureObjectId(typed.resource_id);
  if (!userId || !resourceId) return null;

  // Increment use counter. Non-critical — best-effort.
  await db.collection(COL.tokens).updateOne(
    { _id: typed._id as unknown as ObjectId },
    { $inc: { uses_count: 1 }, $set: { updatedAt: new Date() } },
  );

  const serializedToken = serialize({
    ...typed,
    _id: String(typed._id),
  }) as WsPublicAccessToken & { _id: string };

  switch (typed.resource_type) {
    case 'proposal': {
      const proposal = await db
        .collection(COL.proposals)
        .findOne({ _id: resourceId, userId });
      if (!proposal) return null;
      const [items, signs] = await Promise.all([
        db
          .collection(COL.proposalItems)
          .find({ proposal_id: resourceId, userId })
          .sort({ createdAt: 1 })
          .toArray(),
        db
          .collection(COL.proposalSigns)
          .find({ proposal_id: resourceId, userId })
          .sort({ signed_at: -1 })
          .toArray(),
      ]);
      return {
        token: serializedToken,
        resource: {
          type: 'proposal',
          proposal: serialize(proposal) as Record<string, unknown>,
          items: serialize(items) as unknown[],
          signs: serialize(signs) as unknown[],
        },
      };
    }
    case 'estimate': {
      const estimate = await db
        .collection(COL.estimateRequests)
        .findOne({ _id: resourceId, userId });
      if (!estimate) return null;
      const acceptances = await db
        .collection(COL.acceptEstimates)
        .find({ estimate_id: resourceId, userId })
        .sort({ accepted_at: -1 })
        .toArray();
      return {
        token: serializedToken,
        resource: {
          type: 'estimate',
          estimate: serialize(estimate) as Record<string, unknown>,
          acceptances: serialize(acceptances) as unknown[],
        },
      };
    }
    case 'invoice': {
      const invoice = await db
        .collection(COL.invoices)
        .findOne({ _id: resourceId, userId });
      if (!invoice) return null;
      const payments = await db
        .collection(COL.payments)
        .find({ invoice_id: resourceId, userId })
        .sort({ createdAt: -1 })
        .toArray();
      return {
        token: serializedToken,
        resource: {
          type: 'invoice',
          invoice: serialize(invoice) as Record<string, unknown>,
          payments: serialize(payments) as unknown[],
        },
      };
    }
    case 'contract': {
      const contract = await db
        .collection(COL.contracts)
        .findOne({ _id: resourceId, userId });
      if (!contract) return null;
      const signs = await db
        .collection(COL.contractSigns)
        .find({ contract_id: String(resourceId), userId })
        .sort({ signed_at: -1 })
        .toArray();
      return {
        token: serializedToken,
        resource: {
          type: 'contract',
          contract: serialize(contract) as Record<string, unknown>,
          signs: serialize(signs) as unknown[],
        },
      };
    }
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
 * PUBLIC FORM SUBMISSIONS (no auth)
 * ════════════════════════════════════════════════════════════ */

async function loadFormTenant(
  collection: 'crm_lead_custom_forms' | 'crm_ticket_custom_forms',
  formId: string,
): Promise<ObjectId | null> {
  if (!ObjectId.isValid(formId)) return null;
  const { db } = await connectToDatabase();
  const doc = await db
    .collection(collection)
    .findOne({ _id: new ObjectId(formId) }, { projection: { userId: 1 } });
  if (!doc) return null;
  return ensureObjectId((doc as { userId?: unknown }).userId);
}

/**
 * PUBLIC: create a lead from a publicly shared lead form.
 * The form's tenant is the owner of the resulting lead record.
 */
export async function submitPublicLead(
  formId: string,
  data: Record<string, unknown>,
): Promise<Result<{ submissionId: string; leadId?: string }>> {
  const userId = await loadFormTenant(COL.leadForms, formId);
  if (!userId) return { success: false, error: 'Form not found' };
  const { db } = await connectToDatabase();
  const { ip, userAgent } = await clientMeta();
  const now = new Date();

  const email = String(data.email || data.contactEmail || '').trim();
  const name = String(
    data.name || data.contactName || data.fullName || '',
  ).trim();
  const phone = String(data.phone || data.contactPhone || '').trim();
  const company = String(data.company || '').trim();
  const title = String(
    data.title || data.subject || name || 'Website lead',
  ).trim();
  const description =
    typeof data.message === 'string'
      ? data.message
      : typeof data.description === 'string'
        ? data.description
        : undefined;

  if (!email && !phone) {
    return { success: false, error: 'Email or phone is required' };
  }

  const leadDoc = {
    userId,
    title,
    description,
    company: company || undefined,
    contactName: name || 'Unknown',
    email,
    phone: phone || undefined,
    status: 'New' as const,
    source: 'Public Form',
    value: 0,
    currency: 'INR',
    createdAt: now,
    updatedAt: now,
  };
  const leadRes = await db
    .collection(COL.leads)
    .insertOne(leadDoc as Record<string, unknown>);

  const submission: Omit<WsPublicSubmission, '_id'> = {
    userId,
    form_type: 'lead',
    created_record_id: leadRes.insertedId,
    submitted_data: data,
    submitter_email: email || undefined,
    submitter_name: name || undefined,
    ip_address: ip,
    user_agent: userAgent,
    submitted_at: now,
    createdAt: now,
  };
  const subRes = await db
    .collection(COL.submissions)
    .insertOne(submission as Record<string, unknown>);

  return {
    success: true,
    submissionId: subRes.insertedId.toString(),
    leadId: leadRes.insertedId.toString(),
  };
}

/**
 * PUBLIC: open a ticket via a publicly shared ticket form.
 */
export async function submitPublicTicket(
  formId: string,
  data: Record<string, unknown>,
): Promise<Result<{ submissionId: string; ticketId?: string }>> {
  const userId = await loadFormTenant(COL.ticketForms, formId);
  if (!userId) return { success: false, error: 'Form not found' };
  const { db } = await connectToDatabase();
  const { ip, userAgent } = await clientMeta();
  const now = new Date();

  const subject = String(data.subject || data.title || 'Support request').trim();
  const description = String(
    data.description || data.message || data.body || '',
  ).trim();
  const email = String(data.email || '').trim();
  const name = String(data.name || '').trim();

  if (!email) return { success: false, error: 'Email is required' };
  if (!subject) return { success: false, error: 'Subject is required' };

  const ticketDoc = {
    userId,
    subject,
    description,
    requesterEmail: email,
    clientName: name || undefined,
    priority: 'medium' as const,
    status: 'open' as const,
    createdAt: now,
    updatedAt: now,
  };
  const ticketRes = await db
    .collection(COL.tickets)
    .insertOne(ticketDoc as Record<string, unknown>);

  const submission: Omit<WsPublicSubmission, '_id'> = {
    userId,
    form_type: 'ticket',
    created_record_id: ticketRes.insertedId,
    submitted_data: data,
    submitter_email: email,
    submitter_name: name || undefined,
    ip_address: ip,
    user_agent: userAgent,
    submitted_at: now,
    createdAt: now,
  };
  const subRes = await db
    .collection(COL.submissions)
    .insertOne(submission as Record<string, unknown>);

  return {
    success: true,
    submissionId: subRes.insertedId.toString(),
    ticketId: ticketRes.insertedId.toString(),
  };
}

/* ══════════════════════════════════════════════════════════════
 * PUBLIC SIGNING / ACCEPTING / PAYING
 * ════════════════════════════════════════════════════════════ */

interface PublicSignPayload {
  name: string;
  email: string;
  signatureDataUrl: string;
}

async function consumeValidToken(
  token: string,
  expectedType: WsPublicResourceType,
): Promise<
  | { userId: ObjectId; resourceId: ObjectId; tokenDoc: WithId<WsPublicAccessToken> }
  | null
> {
  if (!token) return null;
  const { db } = await connectToDatabase();
  const doc = await db.collection(COL.tokens).findOne({ token });
  if (!doc) return null;
  const typed = doc as unknown as WithId<WsPublicAccessToken>;
  if (typed.revoked) return null;
  if (typed.resource_type !== expectedType) return null;
  if (typed.expires_at && new Date(typed.expires_at).getTime() < Date.now()) {
    return null;
  }
  if (
    typeof typed.uses_allowed === 'number' &&
    (typed.uses_count || 0) >= typed.uses_allowed
  ) {
    return null;
  }
  const userId = ensureObjectId(typed.userId);
  const resourceId = ensureObjectId(typed.resource_id);
  if (!userId || !resourceId) return null;
  return { userId, resourceId, tokenDoc: typed };
}

export async function signProposalPublic(
  token: string,
  payload: PublicSignPayload,
): Promise<Result> {
  const ctx = await consumeValidToken(token, 'proposal');
  if (!ctx) return { success: false, error: 'Invalid or expired link' };
  if (!payload.name?.trim() || !payload.email?.trim()) {
    return { success: false, error: 'Name and email are required' };
  }
  if (!payload.signatureDataUrl) {
    return { success: false, error: 'Signature is required' };
  }
  const { db } = await connectToDatabase();
  const { ip } = await clientMeta();
  const now = new Date();
  await db.collection(COL.proposalSigns).insertOne({
    userId: ctx.userId,
    proposal_id: ctx.resourceId,
    signer_name: payload.name.trim(),
    signer_email: payload.email.trim(),
    signed_at: now,
    signature_data_url: payload.signatureDataUrl,
    ip_address: ip,
    createdAt: now,
  });
  await db.collection(COL.proposals).updateOne(
    { _id: ctx.resourceId, userId: ctx.userId },
    { $set: { status: 'accepted', updatedAt: now } },
  );
  revalidatePath(`/p/proposal/${token}`);
  return { success: true };
}

export async function acceptEstimatePublic(
  token: string,
  payload: PublicSignPayload,
): Promise<Result> {
  const ctx = await consumeValidToken(token, 'estimate');
  if (!ctx) return { success: false, error: 'Invalid or expired link' };
  if (!payload.name?.trim() || !payload.email?.trim()) {
    return { success: false, error: 'Name and email are required' };
  }
  if (!payload.signatureDataUrl) {
    return { success: false, error: 'Signature is required' };
  }
  const { db } = await connectToDatabase();
  const { ip } = await clientMeta();
  const now = new Date();
  await db.collection(COL.acceptEstimates).insertOne({
    userId: ctx.userId,
    estimate_id: ctx.resourceId,
    accepted_by_name: payload.name.trim(),
    accepted_by_email: payload.email.trim(),
    accepted_at: now,
    signature_data_url: payload.signatureDataUrl,
    ip_address: ip,
    createdAt: now,
  });
  await db.collection(COL.estimateRequests).updateOne(
    { _id: ctx.resourceId, userId: ctx.userId },
    { $set: { status: 'quoted', updatedAt: now } },
  );
  revalidatePath(`/p/estimate/${token}`);
  return { success: true };
}

interface PublicPaymentPayload {
  amount: number;
  gateway: string;
  transactionId: string;
}

export async function recordPublicPayment(
  token: string,
  payload: PublicPaymentPayload,
): Promise<Result<{ paymentId: string }>> {
  const ctx = await consumeValidToken(token, 'invoice');
  if (!ctx) return { success: false, error: 'Invalid or expired link' };
  const amount = Number(payload.amount || 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: 'Enter a valid amount' };
  }
  if (!payload.gateway?.trim()) {
    return { success: false, error: 'Gateway is required' };
  }
  if (!payload.transactionId?.trim()) {
    return { success: false, error: 'Transaction id is required' };
  }
  const { db } = await connectToDatabase();
  const { ip, userAgent } = await clientMeta();
  const now = new Date();

  const paymentRes = await db.collection(COL.payments).insertOne({
    userId: ctx.userId,
    invoice_id: ctx.resourceId,
    amount,
    gateway: payload.gateway.trim(),
    transaction_id: payload.transactionId.trim(),
    status: 'completed',
    paid_at: now,
    ip_address: ip,
    user_agent: userAgent,
    source: 'public-portal',
    createdAt: now,
    updatedAt: now,
  });

  await db.collection(COL.invoicePaymentDetails).insertOne({
    userId: ctx.userId,
    invoice_id: ctx.resourceId,
    payment_id: paymentRes.insertedId,
    amount,
    method: payload.gateway.trim(),
    transaction_id: payload.transactionId.trim(),
    paid_at: now,
    createdAt: now,
  });

  // Mark invoice paid/partial — best-effort; the downstream billing
  // workflow can reconcile exact status.
  const invoice = await db
    .collection(COL.invoices)
    .findOne({ _id: ctx.resourceId, userId: ctx.userId });
  if (invoice) {
    const total = Number((invoice as { total?: number }).total || 0);
    const existingPaid = Number(
      (invoice as { amountPaid?: number }).amountPaid || 0,
    );
    const newPaid = existingPaid + amount;
    const nextStatus =
      total > 0 && newPaid >= total
        ? 'paid'
        : newPaid > 0
          ? 'partial'
          : (invoice as { status?: string }).status;
    await db.collection(COL.invoices).updateOne(
      { _id: ctx.resourceId, userId: ctx.userId },
      {
        $set: {
          amountPaid: newPaid,
          status: nextStatus,
          updatedAt: now,
        },
      },
    );
  }

  revalidatePath(`/p/invoice/${token}`);
  return { success: true, paymentId: paymentRes.insertedId.toString() };
}

/* ══════════════════════════════════════════════════════════════
 * CONTRACT PUBLIC SIGN
 * ════════════════════════════════════════════════════════════ */

export async function signContractPublic(
  token: string,
  payload: PublicSignPayload,
): Promise<Result> {
  const ctx = await consumeValidToken(token, 'contract');
  if (!ctx) return { success: false, error: 'Invalid or expired link' };
  if (!payload.name?.trim()) {
    return { success: false, error: 'Name is required' };
  }
  if (!payload.signatureDataUrl) {
    return { success: false, error: 'Signature is required' };
  }
  const { db } = await connectToDatabase();
  const now = new Date();
  await db.collection(COL.contractSigns).insertOne({
    userId: ctx.userId,
    contract_id: String(ctx.resourceId),
    signer_name: payload.name.trim(),
    signer_email: payload.email?.trim(),
    signed_at: now,
    signature_data_url: payload.signatureDataUrl,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection(COL.contracts).updateOne(
    { _id: ctx.resourceId, userId: ctx.userId },
    { $set: { signed: true, updatedAt: now } },
  );
  revalidatePath(`/p/contract/${token}`);
  return { success: true };
}

/* ══════════════════════════════════════════════════════════════
 * GDPR CONSENT (public)
 * ════════════════════════════════════════════════════════════ */

/**
 * PUBLIC: find purposes + any matching lead by email, so the portal
 * can render a consent form without authenticating. We search across
 * tenants for the lead by email — if multiple tenants have the lead,
 * we take the most recent, since the link is intended for that lead.
 */
export async function loadPublicConsentContext(
  leadEmail: string,
): Promise<
  | {
      lead: { _id: string; userId: string; email: string; contactName?: string };
      purposes: Array<{
        _id: string;
        title: string;
        description?: string;
        is_required?: boolean;
        granted?: boolean;
      }>;
    }
  | null
> {
  const email = String(leadEmail || '').trim().toLowerCase();
  if (!email) return null;
  const { db } = await connectToDatabase();
  const lead = await db
    .collection(COL.leads)
    .find({ email: { $regex: new RegExp(`^${escapeRegex(email)}$`, 'i') } })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();
  if (!lead) return null;
  const leadId = (lead as { _id: ObjectId })._id;
  const userId = ensureObjectId((lead as { userId?: unknown }).userId);
  if (!userId) return null;

  const purposes = await db
    .collection(COL.purposeConsents)
    .find({ userId, is_active: { $ne: false } } as Filter<Record<string, unknown>>)
    .sort({ sort_order: 1, createdAt: 1 })
    .toArray();

  const leadConsents = await db
    .collection(COL.purposeConsentLeads)
    .find({ userId, lead_id: String(leadId) })
    .toArray();
  const grantedByPurpose = new Map<string, boolean>();
  for (const c of leadConsents) {
    const pid = String((c as { purpose_consent_id?: unknown }).purpose_consent_id);
    grantedByPurpose.set(pid, !!(c as { granted?: boolean }).granted);
  }

  return {
    lead: {
      _id: String(leadId),
      userId: String(userId),
      email: String((lead as { email?: string }).email || ''),
      contactName: (lead as { contactName?: string }).contactName,
    },
    purposes: purposes.map((p) => {
      const id = String((p as { _id?: unknown })._id);
      return {
        _id: id,
        title: String((p as { title?: string }).title || ''),
        description: (p as { description?: string }).description,
        is_required: (p as { is_required?: boolean }).is_required,
        granted: grantedByPurpose.get(id) ?? false,
      };
    }),
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * PUBLIC: persist the lead's consent choices. For each purpose, if it
 * appears in `grantedPurposeIds` we record `granted=true`, otherwise
 * `granted=false`. This is an upsert per (lead_id, purpose_consent_id).
 */
export async function grantPublicConsent(
  leadEmail: string,
  grantedPurposeIds: string[],
): Promise<Result> {
  const ctx = await loadPublicConsentContext(leadEmail);
  if (!ctx) return { success: false, error: 'Lead not found' };
  const { db } = await connectToDatabase();
  const { ip, userAgent } = await clientMeta();
  const now = new Date();
  const userId = new ObjectId(ctx.lead.userId);
  const grantedSet = new Set(grantedPurposeIds.map(String));

  for (const p of ctx.purposes) {
    await db.collection(COL.purposeConsentLeads).updateOne(
      { userId, lead_id: ctx.lead._id, purpose_consent_id: p._id },
      {
        $set: {
          userId,
          lead_id: ctx.lead._id,
          purpose_consent_id: p._id,
          granted: grantedSet.has(p._id),
          granted_at: now,
          ip_address: ip,
          user_agent: userAgent,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
  }
  revalidatePath(`/p/gdpr/${encodeURIComponent(leadEmail)}`);
  return { success: true };
}

/* ══════════════════════════════════════════════════════════════
 * PUBLIC FORM DEFINITION LOADERS
 * ════════════════════════════════════════════════════════════ */

export async function loadPublicLeadForm(formId: string): Promise<
  | {
      formId: string;
      fields: Array<{
        _id: string;
        field_name: string;
        field_type: string;
        field_values?: string[];
        is_required?: boolean;
      }>;
    }
  | null
> {
  const userId = await loadFormTenant(COL.leadForms, formId);
  if (!userId) return null;
  const { db } = await connectToDatabase();
  // A "form" in Worksuite is actually a set of field definitions owned
  // by the same tenant; for simplicity we return every active field
  // from this tenant.
  const fields = await db
    .collection(COL.leadForms)
    .find({ userId })
    .sort({ createdAt: 1 })
    .toArray();
  return {
    formId,
    fields: fields.map((f) => ({
      _id: String((f as { _id?: unknown })._id),
      field_name: String((f as { field_name?: string }).field_name || ''),
      field_type: String((f as { field_type?: string }).field_type || 'text'),
      field_values: (f as { field_values?: string[] }).field_values,
      is_required: (f as { is_required?: boolean }).is_required,
    })),
  };
}

export async function loadPublicTicketForm(formId: string): Promise<
  | {
      formId: string;
      fields: Array<{
        _id: string;
        field_name: string;
        field_type: string;
        field_values?: string;
        is_required?: boolean;
      }>;
    }
  | null
> {
  const userId = await loadFormTenant(COL.ticketForms, formId);
  if (!userId) return null;
  const { db } = await connectToDatabase();
  const fields = await db
    .collection(COL.ticketForms)
    .find({ userId })
    .sort({ createdAt: 1 })
    .toArray();
  return {
    formId,
    fields: fields.map((f) => ({
      _id: String((f as { _id?: unknown })._id),
      field_name: String((f as { field_name?: string }).field_name || ''),
      field_type: String((f as { field_type?: string }).field_type || 'text'),
      field_values: (f as { field_values?: string }).field_values,
      is_required: (f as { is_required?: boolean }).is_required,
    })),
  };
}

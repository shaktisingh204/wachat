'use server';

/**
 * Worksuite — Proposals & Estimate Requests server actions.
 *
 * Ported from Worksuite PHP controllers. Every mutation is
 * tenant-scoped via `userId` (pulled from the CRM session) so no
 * cross-tenant reads or writes are possible.
 */

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ObjectId, type Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type {
  WsProposal,
  WsProposalItem,
  WsProposalSign,
  WsProposalStatus,
  WsProposalTemplate,
  WsProposalTemplateItem,
  WsProposalLineInput,
  WsSignPayload,
  WsEstimateRequest,
  WsEstimateRequestStatus,
  WsAcceptEstimate,
  WsEstimateTemplate,
  WsEstimateTemplateItem,
} from '@/lib/worksuite/proposals-types';

type Result<T = {}> = ({ success: true } & T) | { success: false; error: string };

/* ── Collections ─────────────────────────────────────────────── */

const COL = {
  proposals: 'crm_proposals',
  proposalItems: 'crm_proposal_items',
  proposalSigns: 'crm_proposal_signs',
  proposalTemplates: 'crm_proposal_templates',
  proposalTemplateItems: 'crm_proposal_template_items',
  estimateRequests: 'crm_estimate_requests',
  acceptEstimates: 'crm_accept_estimates',
  estimateTemplates: 'crm_estimate_templates',
  estimateTemplateItems: 'crm_estimate_template_items',
  // Conversion targets
  invoices: 'crm_invoices',
  quotations: 'crm_quotations',
  estimates: 'crm_estimates',
} as const;

/* ── Helpers ─────────────────────────────────────────────────── */

async function requireUser(): Promise<ObjectId | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return new ObjectId(session.user._id);
}

function serialize<T = unknown>(v: unknown): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function computeLineTotal(line: WsProposalLineInput): number {
  const base = Number(line.quantity || 0) * Number(line.unit_price || 0);
  const tax = Number(line.tax || 0);
  return Math.round((base + (base * tax) / 100) * 100) / 100;
}

function computeTotals(
  lines: WsProposalLineInput[],
  discount = 0,
  taxOverride?: number,
) {
  const subtotal = lines.reduce(
    (s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0),
    0,
  );
  const taxFromLines = lines.reduce((s, l) => {
    const base = Number(l.quantity || 0) * Number(l.unit_price || 0);
    return s + (base * Number(l.tax || 0)) / 100;
  }, 0);
  const tax = taxOverride != null ? Number(taxOverride) : taxFromLines;
  const total = Math.max(0, subtotal + tax - Number(discount || 0));
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

async function nextProposalNumber(userId: ObjectId): Promise<string> {
  const { db } = await connectToDatabase();
  const last = await db
    .collection(COL.proposals)
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  if (!last.length) return 'PROP-00001';
  const prev = String((last[0] as any).proposal_number || '');
  const m = prev.match(/^(.*?)(\d+)$/);
  if (m) {
    const n = parseInt(m[2], 10) + 1;
    return `${m[1]}${String(n).padStart(m[2].length, '0')}`;
  }
  return `PROP-${Date.now().toString().slice(-5)}`;
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      h.get('x-real-ip') ||
      ''
    );
  } catch {
    return '';
  }
}

/* ══════════════════════════════════════════════════════════════
 * PROPOSALS — read
 * ════════════════════════════════════════════════════════════ */

export async function getProposals(opts?: {
  status?: WsProposalStatus;
  clientId?: string;
  query?: string;
}): Promise<(WsProposal & { _id: string })[]> {
  const userId = await requireUser();
  if (!userId) return [];
  const { db } = await connectToDatabase();
  const filter: Filter<any> = { userId };
  if (opts?.status) filter.status = opts.status;
  if (opts?.clientId && ObjectId.isValid(opts.clientId)) {
    filter.client_id = new ObjectId(opts.clientId);
  }
  if (opts?.query) {
    const q = { $regex: opts.query, $options: 'i' };
    filter.$or = [{ title: q }, { proposal_number: q }];
  }
  const docs = await db
    .collection(COL.proposals)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return serialize<(WsProposal & { _id: string })[]>(docs);
}

export async function getProposalById(id: string): Promise<
  | {
      proposal: WsProposal & { _id: string };
      items: (WsProposalItem & { _id: string })[];
      signs: (WsProposalSign & { _id: string })[];
    }
  | null
> {
  const userId = await requireUser();
  if (!userId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  const proposal = await db
    .collection(COL.proposals)
    .findOne({ _id, userId });
  if (!proposal) return null;
  const [items, signs] = await Promise.all([
    db
      .collection(COL.proposalItems)
      .find({ proposal_id: _id, userId })
      .sort({ createdAt: 1 })
      .toArray(),
    db
      .collection(COL.proposalSigns)
      .find({ proposal_id: _id, userId })
      .sort({ signed_at: -1 })
      .toArray(),
  ]);
  return {
    proposal: serialize<WsProposal & { _id: string }>(proposal),
    items: serialize<(WsProposalItem & { _id: string })[]>(items),
    signs: serialize<(WsProposalSign & { _id: string })[]>(signs),
  };
}

/* ══════════════════════════════════════════════════════════════
 * PROPOSALS — write
 * ════════════════════════════════════════════════════════════ */

export interface SaveProposalInput {
  _id?: string;
  title: string;
  proposal_number?: string;
  client_id?: string;
  lead_id?: string;
  currency?: string;
  issue_date?: string;
  valid_until?: string;
  discount?: number;
  tax?: number;
  note?: string;
  terms?: string;
  signature_required?: boolean;
  status?: WsProposalStatus;
  lines: WsProposalLineInput[];
}

export async function saveProposal(
  input: SaveProposalInput,
): Promise<Result<{ id: string }>> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!input.title?.trim()) return { success: false, error: 'Title required' };
  if (!input.lines?.length) {
    return { success: false, error: 'At least one line item required' };
  }

  const { db } = await connectToDatabase();
  const now = new Date();
  const totals = computeTotals(input.lines, input.discount || 0, input.tax);

  const base: Record<string, any> = {
    userId,
    title: input.title.trim(),
    currency: input.currency || 'INR',
    issue_date: input.issue_date ? new Date(input.issue_date) : now,
    valid_until: input.valid_until ? new Date(input.valid_until) : undefined,
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: Number(input.discount || 0),
    total: totals.total,
    note: input.note || '',
    terms: input.terms || '',
    signature_required: !!input.signature_required,
    status: input.status || 'draft',
    client_id:
      input.client_id && ObjectId.isValid(input.client_id)
        ? new ObjectId(input.client_id)
        : undefined,
    lead_id:
      input.lead_id && ObjectId.isValid(input.lead_id)
        ? new ObjectId(input.lead_id)
        : undefined,
    updatedAt: now,
  };

  let proposalId: ObjectId;
  if (input._id && ObjectId.isValid(input._id)) {
    proposalId = new ObjectId(input._id);
    await db.collection(COL.proposals).updateOne(
      { _id: proposalId, userId },
      { $set: base },
    );
    // Replace items.
    await db
      .collection(COL.proposalItems)
      .deleteMany({ proposal_id: proposalId, userId });
  } else {
    const proposal_number =
      input.proposal_number || (await nextProposalNumber(userId));
    const res = await db.collection(COL.proposals).insertOne({
      ...base,
      proposal_number,
      createdAt: now,
    } as any);
    proposalId = res.insertedId;
  }

  if (input.lines.length) {
    const items = input.lines.map((l) => ({
      userId,
      proposal_id: proposalId,
      name: l.name,
      description: l.description || '',
      quantity: Number(l.quantity || 0),
      unit_price: Number(l.unit_price || 0),
      tax: Number(l.tax || 0),
      total: computeLineTotal(l),
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection(COL.proposalItems).insertMany(items as any);
  }

  revalidatePath('/dashboard/crm/sales/proposals');
  revalidatePath(`/dashboard/crm/sales/proposals/${proposalId.toString()}`);
  return { success: true, id: proposalId.toString() };
}

export async function deleteProposal(id: string): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  await db.collection(COL.proposals).deleteOne({ _id, userId });
  await db.collection(COL.proposalItems).deleteMany({ proposal_id: _id, userId });
  await db.collection(COL.proposalSigns).deleteMany({ proposal_id: _id, userId });
  revalidatePath('/dashboard/crm/sales/proposals');
  return { success: true };
}

export async function updateProposalStatus(
  id: string,
  status: WsProposalStatus,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db
    .collection(COL.proposals)
    .updateOne({ _id: new ObjectId(id), userId }, { $set: { status, updatedAt: new Date() } });
  revalidatePath('/dashboard/crm/sales/proposals');
  revalidatePath(`/dashboard/crm/sales/proposals/${id}`);
  return { success: true };
}

/**
 * E-signature: append a signature record and mark the proposal accepted.
 */
export async function signProposal(
  proposalId: string,
  payload: WsSignPayload,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(proposalId)) {
    return { success: false, error: 'Invalid proposal id' };
  }
  if (!payload.name?.trim() || !payload.email?.trim()) {
    return { success: false, error: 'Name and email are required' };
  }
  if (!payload.signatureDataUrl) {
    return { success: false, error: 'Signature is required' };
  }
  const { db } = await connectToDatabase();
  const _id = new ObjectId(proposalId);
  const now = new Date();
  const ip = await clientIp();
  await db.collection(COL.proposalSigns).insertOne({
    userId,
    proposal_id: _id,
    signer_name: payload.name.trim(),
    signer_email: payload.email.trim(),
    signed_at: now,
    signature_data_url: payload.signatureDataUrl,
    ip_address: ip,
    createdAt: now,
  } as any);
  await db
    .collection(COL.proposals)
    .updateOne(
      { _id, userId },
      { $set: { status: 'accepted', updatedAt: now } },
    );
  revalidatePath(`/dashboard/crm/sales/proposals/${proposalId}`);
  revalidatePath('/dashboard/crm/sales/proposals');
  return { success: true };
}

/* ══════════════════════════════════════════════════════════════
 * PROPOSAL TEMPLATES
 * ════════════════════════════════════════════════════════════ */

export async function getProposalTemplates(): Promise<
  (WsProposalTemplate & { _id: string })[]
> {
  const userId = await requireUser();
  if (!userId) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COL.proposalTemplates)
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  return serialize<(WsProposalTemplate & { _id: string })[]>(docs);
}

export async function getProposalTemplateById(id: string): Promise<
  | {
      template: WsProposalTemplate & { _id: string };
      items: (WsProposalTemplateItem & { _id: string })[];
    }
  | null
> {
  const userId = await requireUser();
  if (!userId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  const template = await db
    .collection(COL.proposalTemplates)
    .findOne({ _id, userId });
  if (!template) return null;
  const items = await db
    .collection(COL.proposalTemplateItems)
    .find({ template_id: _id, userId })
    .sort({ createdAt: 1 })
    .toArray();
  return {
    template: serialize<WsProposalTemplate & { _id: string }>(template),
    items: serialize<(WsProposalTemplateItem & { _id: string })[]>(items),
  };
}

export interface SaveProposalTemplateInput {
  _id?: string;
  name: string;
  title: string;
  currency?: string;
  discount?: number;
  tax?: number;
  note?: string;
  terms?: string;
  signature_required?: boolean;
  lines: WsProposalLineInput[];
}

export async function saveProposalTemplate(
  input: SaveProposalTemplateInput,
): Promise<Result<{ id: string }>> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!input.name?.trim()) return { success: false, error: 'Template name required' };

  const { db } = await connectToDatabase();
  const now = new Date();
  const totals = computeTotals(input.lines || [], input.discount || 0, input.tax);

  const base: Record<string, any> = {
    userId,
    name: input.name.trim(),
    title: input.title || input.name.trim(),
    currency: input.currency || 'INR',
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: Number(input.discount || 0),
    total: totals.total,
    note: input.note || '',
    terms: input.terms || '',
    signature_required: !!input.signature_required,
    updatedAt: now,
  };

  let templateId: ObjectId;
  if (input._id && ObjectId.isValid(input._id)) {
    templateId = new ObjectId(input._id);
    await db
      .collection(COL.proposalTemplates)
      .updateOne({ _id: templateId, userId }, { $set: base });
    await db
      .collection(COL.proposalTemplateItems)
      .deleteMany({ template_id: templateId, userId });
  } else {
    const res = await db
      .collection(COL.proposalTemplates)
      .insertOne({ ...base, createdAt: now } as any);
    templateId = res.insertedId;
  }

  if (input.lines?.length) {
    const items = input.lines.map((l) => ({
      userId,
      template_id: templateId,
      name: l.name,
      description: l.description || '',
      quantity: Number(l.quantity || 0),
      unit_price: Number(l.unit_price || 0),
      tax: Number(l.tax || 0),
      total: computeLineTotal(l),
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection(COL.proposalTemplateItems).insertMany(items as any);
  }

  revalidatePath('/dashboard/crm/sales/proposals/templates');
  revalidatePath(
    `/dashboard/crm/sales/proposals/templates/${templateId.toString()}`,
  );
  return { success: true, id: templateId.toString() };
}

export async function deleteProposalTemplate(id: string): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  await db.collection(COL.proposalTemplates).deleteOne({ _id, userId });
  await db
    .collection(COL.proposalTemplateItems)
    .deleteMany({ template_id: _id, userId });
  revalidatePath('/dashboard/crm/sales/proposals/templates');
  return { success: true };
}

/**
 * Clone a template into a brand new proposal attached to `clientId`.
 */
export async function createProposalFromTemplate(
  templateId: string,
  clientId?: string,
): Promise<Result<{ id: string }>> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(templateId)) {
    return { success: false, error: 'Invalid template id' };
  }
  const { db } = await connectToDatabase();
  const tId = new ObjectId(templateId);
  const template = (await db
    .collection(COL.proposalTemplates)
    .findOne({ _id: tId, userId })) as unknown as WsProposalTemplate | null;
  if (!template) return { success: false, error: 'Template not found' };

  const items = (await db
    .collection(COL.proposalTemplateItems)
    .find({ template_id: tId, userId })
    .toArray()) as unknown as WsProposalTemplateItem[];

  const now = new Date();
  const proposal_number = await nextProposalNumber(userId);
  const proposalDoc = {
    userId,
    proposal_number,
    title: template.title,
    currency: template.currency || 'INR',
    subtotal: template.subtotal || 0,
    tax: template.tax || 0,
    discount: template.discount || 0,
    total: template.total || 0,
    note: template.note || '',
    terms: template.terms || '',
    signature_required: !!template.signature_required,
    status: 'draft' as WsProposalStatus,
    issue_date: now,
    client_id:
      clientId && ObjectId.isValid(clientId) ? new ObjectId(clientId) : undefined,
    createdAt: now,
    updatedAt: now,
  };
  const res = await db.collection(COL.proposals).insertOne(proposalDoc as any);
  const proposalId = res.insertedId;

  if (items.length) {
    const clonedItems = items.map((it) => ({
      userId,
      proposal_id: proposalId,
      name: it.name,
      description: it.description || '',
      quantity: Number(it.quantity || 0),
      unit_price: Number(it.unit_price || 0),
      tax: Number(it.tax || 0),
      total: Number(it.total || 0),
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection(COL.proposalItems).insertMany(clonedItems as any);
  }

  revalidatePath('/dashboard/crm/sales/proposals');
  return { success: true, id: proposalId.toString() };
}

/* ══════════════════════════════════════════════════════════════
 * Proposal → Invoice conversion
 * ════════════════════════════════════════════════════════════ */

export async function convertProposalToInvoice(
  proposalId: string,
): Promise<Result<{ invoiceId: string }>> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(proposalId)) {
    return { success: false, error: 'Invalid proposal id' };
  }
  const { db } = await connectToDatabase();
  const _id = new ObjectId(proposalId);
  const proposal = (await db
    .collection(COL.proposals)
    .findOne({ _id, userId })) as unknown as WsProposal | null;
  if (!proposal) return { success: false, error: 'Proposal not found' };

  const items = (await db
    .collection(COL.proposalItems)
    .find({ proposal_id: _id, userId })
    .toArray()) as unknown as (WsProposalItem & { _id?: unknown })[];

  const now = new Date();
  const lineItems = items.map((it) => ({
    id: `item-${String(it._id ?? Date.now())}`,
    name: it.name,
    description: it.description || '',
    quantity: Number(it.quantity || 0),
    rate: Number(it.unit_price || 0),
  }));

  const invoiceDoc = {
    userId,
    accountId: (proposal as any).client_id,
    invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
    invoiceDate: now,
    currency: proposal.currency || 'INR',
    lineItems,
    subtotal: proposal.subtotal || 0,
    total: proposal.total || 0,
    status: 'Draft',
    notes: proposal.note || '',
    termsAndConditions: proposal.terms ? [{ id: 'terms-1', text: proposal.terms }] : [],
    createdAt: now,
    updatedAt: now,
    sourceProposalId: _id,
  };
  const res = await db.collection(COL.invoices).insertOne(invoiceDoc as any);

  revalidatePath('/dashboard/crm/sales/invoices');
  return { success: true, invoiceId: res.insertedId.toString() };
}

/* ══════════════════════════════════════════════════════════════
 * ESTIMATE REQUESTS
 * ════════════════════════════════════════════════════════════ */

export async function getEstimateRequests(opts?: {
  status?: WsEstimateRequestStatus;
}): Promise<(WsEstimateRequest & { _id: string })[]> {
  const userId = await requireUser();
  if (!userId) return [];
  const { db } = await connectToDatabase();
  const filter: Filter<any> = { userId };
  if (opts?.status) filter.status = opts.status;
  const docs = await db
    .collection(COL.estimateRequests)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return serialize<(WsEstimateRequest & { _id: string })[]>(docs);
}

export async function getEstimateRequestById(id: string): Promise<
  | {
      request: WsEstimateRequest & { _id: string };
      accepts: (WsAcceptEstimate & { _id: string })[];
    }
  | null
> {
  const userId = await requireUser();
  if (!userId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  const request = await db
    .collection(COL.estimateRequests)
    .findOne({ _id, userId });
  if (!request) return null;
  const accepts = await db
    .collection(COL.acceptEstimates)
    .find({ estimate_id: _id, userId })
    .sort({ accepted_at: -1 })
    .toArray();
  return {
    request: serialize<WsEstimateRequest & { _id: string }>(request),
    accepts: serialize<(WsAcceptEstimate & { _id: string })[]>(accepts),
  };
}

export interface SaveEstimateRequestInput {
  _id?: string;
  client_id?: string;
  requester_name?: string;
  requester_email?: string;
  description: string;
  desired_date?: string;
  notes?: string;
  status?: WsEstimateRequestStatus;
}

export async function saveEstimateRequest(
  input: SaveEstimateRequestInput,
): Promise<Result<{ id: string }>> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!input.description?.trim()) {
    return { success: false, error: 'Description required' };
  }
  const { db } = await connectToDatabase();
  const now = new Date();
  const doc: Record<string, any> = {
    userId,
    description: input.description.trim(),
    desired_date: input.desired_date ? new Date(input.desired_date) : undefined,
    notes: input.notes || '',
    status: input.status || 'pending',
    requester_name: input.requester_name || '',
    requester_email: input.requester_email || '',
    client_id:
      input.client_id && ObjectId.isValid(input.client_id)
        ? new ObjectId(input.client_id)
        : undefined,
    updatedAt: now,
  };

  if (input._id && ObjectId.isValid(input._id)) {
    const _id = new ObjectId(input._id);
    await db
      .collection(COL.estimateRequests)
      .updateOne({ _id, userId }, { $set: doc });
    revalidatePath('/dashboard/crm/sales/estimate-requests');
    return { success: true, id: input._id };
  }
  doc.createdAt = now;
  const res = await db.collection(COL.estimateRequests).insertOne(doc as any);
  revalidatePath('/dashboard/crm/sales/estimate-requests');
  return { success: true, id: res.insertedId.toString() };
}

export async function updateEstimateRequestStatus(
  id: string,
  status: WsEstimateRequestStatus,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  await db
    .collection(COL.estimateRequests)
    .updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { status, updatedAt: new Date() } },
    );
  revalidatePath('/dashboard/crm/sales/estimate-requests');
  revalidatePath(`/dashboard/crm/sales/estimate-requests/${id}`);
  return { success: true };
}

export async function deleteEstimateRequest(id: string): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  await db.collection(COL.estimateRequests).deleteOne({ _id, userId });
  await db.collection(COL.acceptEstimates).deleteMany({ estimate_id: _id, userId });
  revalidatePath('/dashboard/crm/sales/estimate-requests');
  return { success: true };
}

/**
 * Customer accepts an estimate request. Records a signed acceptance
 * and flips the request into the `quoted` state.
 */
export async function acceptEstimate(
  estimateId: string,
  payload: WsSignPayload,
): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(estimateId)) {
    return { success: false, error: 'Invalid estimate id' };
  }
  if (!payload.name?.trim() || !payload.email?.trim()) {
    return { success: false, error: 'Name and email are required' };
  }
  if (!payload.signatureDataUrl) {
    return { success: false, error: 'Signature is required' };
  }
  const { db } = await connectToDatabase();
  const _id = new ObjectId(estimateId);
  const now = new Date();
  const ip = await clientIp();
  await db.collection(COL.acceptEstimates).insertOne({
    userId,
    estimate_id: _id,
    accepted_by_name: payload.name.trim(),
    accepted_by_email: payload.email.trim(),
    accepted_at: now,
    signature_data_url: payload.signatureDataUrl,
    ip_address: ip,
    createdAt: now,
  } as any);
  await db
    .collection(COL.estimateRequests)
    .updateOne(
      { _id, userId },
      { $set: { status: 'quoted', updatedAt: now } },
    );
  revalidatePath(`/dashboard/crm/sales/estimate-requests/${estimateId}`);
  revalidatePath('/dashboard/crm/sales/estimate-requests');
  return { success: true };
}

/**
 * Convert an estimate request into a Quotation. Falls back to the
 * `crm_estimates` collection if no quotations collection is in use.
 */
export async function convertEstimateRequestToQuote(
  requestId: string,
): Promise<Result<{ quoteId: string; collection: string }>> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(requestId)) {
    return { success: false, error: 'Invalid request id' };
  }
  const { db } = await connectToDatabase();
  const _id = new ObjectId(requestId);
  const req = (await db
    .collection(COL.estimateRequests)
    .findOne({ _id, userId })) as unknown as WsEstimateRequest | null;
  if (!req) return { success: false, error: 'Request not found' };

  // Prefer quotations collection when it exists; otherwise fall back
  // to a generic `crm_estimates` collection so the data is never lost.
  let collections: string[] = [];
  try {
    collections = (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      (c: any) => c.name,
    );
  } catch {
    collections = [];
  }
  const target = collections.includes(COL.quotations)
    ? COL.quotations
    : COL.estimates;

  const now = new Date();
  const doc: Record<string, any> = {
    userId,
    accountId: (req as any).client_id,
    quotationNumber: `QUO-${Date.now().toString().slice(-6)}`,
    quotationDate: now,
    currency: 'INR',
    lineItems: [],
    subtotal: 0,
    total: 0,
    notes: req.description,
    termsAndConditions: [],
    additionalInfo: [],
    status: 'Draft',
    createdAt: now,
    updatedAt: now,
    sourceEstimateRequestId: _id,
  };
  const res = await db.collection(target).insertOne(doc as any);

  await db
    .collection(COL.estimateRequests)
    .updateOne(
      { _id, userId },
      {
        $set: {
          status: 'quoted',
          converted_quote_id: res.insertedId,
          updatedAt: now,
        },
      },
    );

  revalidatePath('/dashboard/crm/sales/estimate-requests');
  revalidatePath(`/dashboard/crm/sales/estimate-requests/${requestId}`);
  if (target === COL.quotations) revalidatePath('/dashboard/crm/sales/quotations');
  return { success: true, quoteId: res.insertedId.toString(), collection: target };
}

/* ══════════════════════════════════════════════════════════════
 * ESTIMATE TEMPLATES
 * ════════════════════════════════════════════════════════════ */

export async function getEstimateTemplates(): Promise<
  (WsEstimateTemplate & { _id: string })[]
> {
  const userId = await requireUser();
  if (!userId) return [];
  const { db } = await connectToDatabase();
  const docs = await db
    .collection(COL.estimateTemplates)
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();
  return serialize<(WsEstimateTemplate & { _id: string })[]>(docs);
}

export async function getEstimateTemplateById(id: string): Promise<
  | {
      template: WsEstimateTemplate & { _id: string };
      items: (WsEstimateTemplateItem & { _id: string })[];
    }
  | null
> {
  const userId = await requireUser();
  if (!userId || !ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  const template = await db
    .collection(COL.estimateTemplates)
    .findOne({ _id, userId });
  if (!template) return null;
  const items = await db
    .collection(COL.estimateTemplateItems)
    .find({ template_id: _id, userId })
    .sort({ createdAt: 1 })
    .toArray();
  return {
    template: serialize<WsEstimateTemplate & { _id: string }>(template),
    items: serialize<(WsEstimateTemplateItem & { _id: string })[]>(items),
  };
}

export interface SaveEstimateTemplateInput {
  _id?: string;
  name: string;
  title: string;
  currency?: string;
  discount?: number;
  tax?: number;
  note?: string;
  terms?: string;
  lines: WsProposalLineInput[];
}

export async function saveEstimateTemplate(
  input: SaveEstimateTemplateInput,
): Promise<Result<{ id: string }>> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!input.name?.trim()) return { success: false, error: 'Template name required' };

  const { db } = await connectToDatabase();
  const now = new Date();
  const totals = computeTotals(input.lines || [], input.discount || 0, input.tax);

  const base: Record<string, any> = {
    userId,
    name: input.name.trim(),
    title: input.title || input.name.trim(),
    currency: input.currency || 'INR',
    subtotal: totals.subtotal,
    tax: totals.tax,
    discount: Number(input.discount || 0),
    total: totals.total,
    note: input.note || '',
    terms: input.terms || '',
    updatedAt: now,
  };

  let templateId: ObjectId;
  if (input._id && ObjectId.isValid(input._id)) {
    templateId = new ObjectId(input._id);
    await db
      .collection(COL.estimateTemplates)
      .updateOne({ _id: templateId, userId }, { $set: base });
    await db
      .collection(COL.estimateTemplateItems)
      .deleteMany({ template_id: templateId, userId });
  } else {
    const res = await db
      .collection(COL.estimateTemplates)
      .insertOne({ ...base, createdAt: now } as any);
    templateId = res.insertedId;
  }

  if (input.lines?.length) {
    const items = input.lines.map((l) => ({
      userId,
      template_id: templateId,
      name: l.name,
      description: l.description || '',
      quantity: Number(l.quantity || 0),
      unit_price: Number(l.unit_price || 0),
      tax: Number(l.tax || 0),
      total: computeLineTotal(l),
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection(COL.estimateTemplateItems).insertMany(items as any);
  }

  revalidatePath('/dashboard/crm/sales/estimates-templates');
  return { success: true, id: templateId.toString() };
}

export async function deleteEstimateTemplate(id: string): Promise<Result> {
  const userId = await requireUser();
  if (!userId) return { success: false, error: 'Access denied' };
  if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id' };
  const { db } = await connectToDatabase();
  const _id = new ObjectId(id);
  await db.collection(COL.estimateTemplates).deleteOne({ _id, userId });
  await db
    .collection(COL.estimateTemplateItems)
    .deleteMany({ template_id: _id, userId });
  revalidatePath('/dashboard/crm/sales/estimates-templates');
  return { success: true };
}

'use server';

/**
 * Per-entity CSV import actions (CRM_REBUILD_PLAN §5.9).
 *
 * Thin glue layer over `src/lib/bulk-io/`. Each public action:
 *   1. Authenticates + RBAC-gates the call.
 *   2. Constructs the per-entity adapter (mapRow/dedupKey/insertOne).
 *   3. Runs `runBulkImport(...)`.
 *   4. Writes one audit row summarizing the result.
 *
 * The adapters intentionally mirror the **minimum** column set per
 * entity. Optional columns are picked up when present but not required.
 */

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { connectToDatabase } from '@/lib/mongodb';
import {
  runBulkImport,
  type BulkImportAdapter,
  type BulkImportContext,
  type BulkImportReport,
  type DedupPolicy,
} from '@/lib/bulk-io';

/* ─── Shared helpers ───────────────────────────────────────────── */

function s(v: string | undefined | null): string | undefined {
  const t = (v ?? '').trim();
  return t.length === 0 ? undefined : t;
}

function lower(v: string | undefined): string {
  return (v ?? '').trim().toLowerCase();
}

function pickKey(
  row: Record<string, string>,
  ...candidates: string[]
): string | undefined {
  for (const c of candidates) {
    const direct = row[c];
    if (direct !== undefined && String(direct).trim().length > 0) return direct;
    const lc = c.toLowerCase();
    for (const k of Object.keys(row)) {
      if (k.toLowerCase() === lc) {
        const v = row[k];
        if (v !== undefined && String(v).trim().length > 0) return v;
      }
    }
  }
  return undefined;
}

/* ─── Lead adapter ─────────────────────────────────────────────── */

interface LeadDraft {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: string;
  notes?: string;
}

const LEAD_ADAPTER: BulkImportAdapter<LeadDraft> = {
  entityKind: 'lead',
  mapRow(raw) {
    const name = s(pickKey(raw, 'name', 'fullName', 'lead'));
    if (!name) {
      return { ok: false, error: 'Missing required column "name".' };
    }
    return {
      ok: true,
      value: {
        name,
        company: s(pickKey(raw, 'company', 'organization', 'companyName')),
        email: lower(s(pickKey(raw, 'email', 'emailAddress'))) || undefined,
        phone: s(pickKey(raw, 'phone', 'mobile', 'phoneNumber')),
        source: s(pickKey(raw, 'source', 'leadSource')),
        status: s(pickKey(raw, 'status')) ?? 'New',
        notes: s(pickKey(raw, 'notes', 'remarks')),
      },
    };
  },
  dedupKey(value) {
    return value.email ?? `${value.name.toLowerCase()}|${value.phone ?? ''}`;
  },
  async existingKeys(values, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const emails = values.map((v) => v.email).filter((e): e is string => !!e);
    if (emails.length === 0) return new Set<string>();
    const rows = await db
      .collection('crm_leads')
      .find(
        { userId: userObjectId, email: { $in: emails } },
        { projection: { email: 1 } as any },
      )
      .toArray();
    return new Set(rows.map((r) => String((r as any).email).toLowerCase()));
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const doc = {
      userId: userObjectId,
      name: value.name,
      company: value.company,
      email: value.email,
      phone: value.phone,
      source: value.source,
      status: value.status,
      notes: value.notes ? [{ content: value.notes, createdAt: new Date(), author: 'import' }] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Record<string, unknown>;
    const r = await db.collection('crm_leads').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Contact adapter ──────────────────────────────────────────── */

interface ContactDraft {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  accountName?: string;
}

const CONTACT_ADAPTER: BulkImportAdapter<ContactDraft> = {
  entityKind: 'contact',
  mapRow(raw) {
    const firstName = s(pickKey(raw, 'firstName', 'first_name', 'firstname', 'name'));
    if (!firstName) {
      return { ok: false, error: 'Missing required column "firstName".' };
    }
    return {
      ok: true,
      value: {
        firstName,
        lastName: s(pickKey(raw, 'lastName', 'last_name', 'lastname', 'surname')),
        email: lower(s(pickKey(raw, 'email', 'emailAddress'))) || undefined,
        phone: s(pickKey(raw, 'phone', 'mobile')),
        jobTitle: s(pickKey(raw, 'jobTitle', 'title')),
        accountName: s(pickKey(raw, 'account', 'accountName', 'company')),
      },
    };
  },
  dedupKey(value) {
    return value.email ?? `${value.firstName.toLowerCase()}|${value.phone ?? ''}`;
  },
  async existingKeys(values, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const emails = values.map((v) => v.email).filter((e): e is string => !!e);
    if (emails.length === 0) return new Set<string>();
    const rows = await db
      .collection('crm_contacts')
      .find(
        { userId: userObjectId, email: { $in: emails } },
        { projection: { email: 1 } as any },
      )
      .toArray();
    return new Set(rows.map((r) => String((r as any).email).toLowerCase()));
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    // Resolve accountName → accountId when present.
    let accountId: ObjectId | undefined;
    if (value.accountName) {
      const acc = await db.collection('crm_accounts').findOne({
        userId: userObjectId,
        name: value.accountName,
      });
      if (acc?._id) accountId = acc._id as ObjectId;
    }
    const doc = {
      userId: userObjectId,
      firstName: value.firstName,
      lastName: value.lastName,
      email: value.email,
      phone: value.phone,
      jobTitle: value.jobTitle,
      ...(accountId ? { accountId } : {}),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Record<string, unknown>;
    const r = await db.collection('crm_contacts').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Account adapter ──────────────────────────────────────────── */

interface AccountDraft {
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  email?: string;
  country?: string;
  city?: string;
  gstin?: string;
  category?: string;
  currency?: string;
}

const ACCOUNT_ADAPTER: BulkImportAdapter<AccountDraft> = {
  entityKind: 'account',
  mapRow(raw) {
    const name = s(pickKey(raw, 'name', 'company', 'companyName'));
    if (!name) {
      return { ok: false, error: 'Missing required column "name".' };
    }
    return {
      ok: true,
      value: {
        name,
        industry: s(pickKey(raw, 'industry')),
        website: s(pickKey(raw, 'website', 'url')),
        phone: s(pickKey(raw, 'phone', 'mobile')),
        email: lower(s(pickKey(raw, 'email'))) || undefined,
        country: s(pickKey(raw, 'country')),
        city: s(pickKey(raw, 'city')),
        gstin: s(pickKey(raw, 'gstin', 'gst')),
        category: s(pickKey(raw, 'category')) ?? 'new',
        currency: s(pickKey(raw, 'currency')) ?? 'INR',
      },
    };
  },
  dedupKey(value) {
    return value.gstin ?? value.email ?? value.name.toLowerCase();
  },
  async existingKeys(values, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const names = values.map((v) => v.name);
    const gstins = values.map((v) => v.gstin).filter((g): g is string => !!g);
    const rows = await db
      .collection('crm_accounts')
      .find(
        {
          userId: userObjectId,
          $or: [
            { name: { $in: names } },
            ...(gstins.length > 0 ? [{ gstin: { $in: gstins } }] : []),
          ],
        },
        { projection: { name: 1, gstin: 1 } as any },
      )
      .toArray();
    const out = new Set<string>();
    for (const row of rows) {
      const r = row as any;
      if (r.gstin) out.add(String(r.gstin));
      if (r.name) out.add(String(r.name).toLowerCase());
    }
    return out;
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const doc = {
      userId: userObjectId,
      name: value.name,
      industry: value.industry,
      website: value.website,
      phone: value.phone,
      country: value.country,
      city: value.city,
      gstin: value.gstin,
      category: value.category,
      currency: value.currency,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Record<string, unknown>;
    const r = await db.collection('crm_accounts').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Item (product) adapter ───────────────────────────────────── */

interface ItemDraft {
  name: string;
  sku?: string;
  description?: string;
  unit?: string;
  hsnCode?: string;
  category?: string;
  sellingPrice?: number;
  costPrice?: number;
  taxRate?: number;
  trackInventory?: boolean;
  openingStock?: number;
}

function num(v: string | undefined): number | undefined {
  if (v === undefined || v === null) return undefined;
  const t = String(v).trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

const ITEM_ADAPTER: BulkImportAdapter<ItemDraft> = {
  entityKind: 'item',
  mapRow(raw) {
    const name = s(pickKey(raw, 'name', 'productName', 'itemName', 'product'));
    if (!name) {
      return { ok: false, error: 'Missing required column "name".' };
    }
    const trackRaw = s(pickKey(raw, 'trackInventory', 'tracked')) ?? '';
    return {
      ok: true,
      value: {
        name,
        sku: s(pickKey(raw, 'sku', 'code', 'productCode')),
        description: s(pickKey(raw, 'description', 'desc')),
        unit: s(pickKey(raw, 'unit', 'uom')),
        hsnCode: s(pickKey(raw, 'hsn', 'hsnCode')),
        category: s(pickKey(raw, 'category')),
        sellingPrice: num(pickKey(raw, 'sellingPrice', 'price', 'salePrice')),
        costPrice: num(pickKey(raw, 'costPrice', 'cost', 'purchasePrice')),
        taxRate: num(pickKey(raw, 'taxRate', 'gst', 'tax')),
        trackInventory: trackRaw
          ? ['true', 'yes', '1'].includes(trackRaw.toLowerCase())
          : undefined,
        openingStock: num(pickKey(raw, 'openingStock', 'stock', 'qty')),
      },
    };
  },
  dedupKey(value) {
    return value.sku?.toLowerCase() ?? value.name.toLowerCase();
  },
  async existingKeys(values, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const skus = values.map((v) => v.sku).filter((s): s is string => !!s);
    const names = values.map((v) => v.name);
    const rows = await db
      .collection('crm_products')
      .find(
        {
          userId: userObjectId,
          $or: [
            ...(skus.length > 0 ? [{ sku: { $in: skus } }] : []),
            { name: { $in: names } },
          ],
        },
        { projection: { sku: 1, name: 1 } as any },
      )
      .toArray();
    const out = new Set<string>();
    for (const row of rows) {
      const r = row as any;
      if (r.sku) out.add(String(r.sku).toLowerCase());
      if (r.name) out.add(String(r.name).toLowerCase());
    }
    return out;
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const doc = {
      userId: userObjectId,
      name: value.name,
      sku: value.sku,
      description: value.description,
      unit: value.unit,
      hsnCode: value.hsnCode,
      category: value.category,
      sellingPrice: value.sellingPrice,
      costPrice: value.costPrice,
      taxRate: value.taxRate,
      trackInventory: value.trackInventory ?? true,
      openingStock: value.openingStock ?? 0,
      currentStock: value.openingStock ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Record<string, unknown>;
    const r = await db.collection('crm_products').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Vendor adapter ───────────────────────────────────────────── */

interface VendorDraft {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  category?: string;
  paymentTerms?: string;
  currency?: string;
  country?: string;
  city?: string;
  address?: string;
}

const VENDOR_ADAPTER: BulkImportAdapter<VendorDraft> = {
  entityKind: 'vendor',
  mapRow(raw) {
    const name = s(pickKey(raw, 'name', 'vendorName', 'company'));
    if (!name) {
      return { ok: false, error: 'Missing required column "name".' };
    }
    return {
      ok: true,
      value: {
        name,
        contactName: s(pickKey(raw, 'contactName', 'contact')),
        email: lower(s(pickKey(raw, 'email'))) || undefined,
        phone: s(pickKey(raw, 'phone', 'mobile')),
        gstin: s(pickKey(raw, 'gstin', 'gst')),
        pan: s(pickKey(raw, 'pan')),
        category: s(pickKey(raw, 'category')),
        paymentTerms: s(pickKey(raw, 'paymentTerms', 'terms')),
        currency: s(pickKey(raw, 'currency')) ?? 'INR',
        country: s(pickKey(raw, 'country')),
        city: s(pickKey(raw, 'city')),
        address: s(pickKey(raw, 'address')),
      },
    };
  },
  dedupKey(value) {
    return value.gstin ?? value.email ?? value.name.toLowerCase();
  },
  async existingKeys(values, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const names = values.map((v) => v.name);
    const gstins = values.map((v) => v.gstin).filter((g): g is string => !!g);
    const rows = await db
      .collection('crm_vendors')
      .find(
        {
          userId: userObjectId,
          $or: [
            { name: { $in: names } },
            ...(gstins.length > 0 ? [{ gstin: { $in: gstins } }] : []),
          ],
        },
        { projection: { name: 1, gstin: 1 } as any },
      )
      .toArray();
    const out = new Set<string>();
    for (const row of rows) {
      const r = row as any;
      if (r.gstin) out.add(String(r.gstin));
      if (r.name) out.add(String(r.name).toLowerCase());
    }
    return out;
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    const doc = {
      userId: userObjectId,
      name: value.name,
      contactName: value.contactName,
      email: value.email,
      phone: value.phone,
      gstin: value.gstin,
      pan: value.pan,
      category: value.category,
      paymentTerms: value.paymentTerms,
      currency: value.currency,
      country: value.country,
      city: value.city,
      address: value.address,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Record<string, unknown>;
    const r = await db.collection('crm_vendors').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Deal adapter ─────────────────────────────────────────────── */

interface DealDraft {
  name: string;
  accountName?: string;
  contactEmail?: string;
  amount?: number;
  currency?: string;
  stage?: string;
  pipelineName?: string;
  closeDate?: Date;
  source?: string;
  notes?: string;
}

const DEAL_ADAPTER: BulkImportAdapter<DealDraft> = {
  entityKind: 'deal',
  mapRow(raw) {
    const name = s(pickKey(raw, 'name', 'dealName', 'opportunity', 'title'));
    if (!name) {
      return { ok: false, error: 'Missing required column "name".' };
    }
    const closeRaw = s(pickKey(raw, 'closeDate', 'expectedClose'));
    let closeDate: Date | undefined;
    if (closeRaw) {
      const d = new Date(closeRaw);
      if (!Number.isNaN(d.getTime())) closeDate = d;
    }
    return {
      ok: true,
      value: {
        name,
        accountName: s(pickKey(raw, 'account', 'accountName', 'company')),
        contactEmail: lower(s(pickKey(raw, 'contactEmail', 'email'))) || undefined,
        amount: num(pickKey(raw, 'amount', 'value', 'dealAmount')),
        currency: s(pickKey(raw, 'currency')) ?? 'INR',
        stage: s(pickKey(raw, 'stage')) ?? 'Qualification',
        pipelineName: s(pickKey(raw, 'pipeline', 'pipelineName')),
        closeDate,
        source: s(pickKey(raw, 'source')),
        notes: s(pickKey(raw, 'notes', 'remarks')),
      },
    };
  },
  dedupKey(value) {
    return `${value.name.toLowerCase()}|${value.accountName?.toLowerCase() ?? ''}`;
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    // Resolve account + pipeline names → ids when present.
    let accountId: ObjectId | undefined;
    if (value.accountName) {
      const acc = await db
        .collection('crm_accounts')
        .findOne({ userId: userObjectId, name: value.accountName });
      if (acc?._id) accountId = acc._id as ObjectId;
    }
    let pipelineId: ObjectId | undefined;
    if (value.pipelineName) {
      const p = await db
        .collection('crm_pipelines')
        .findOne({ userId: userObjectId, name: value.pipelineName });
      if (p?._id) pipelineId = p._id as ObjectId;
    }
    const doc = {
      userId: userObjectId,
      name: value.name,
      ...(accountId ? { accountId } : {}),
      contactEmail: value.contactEmail,
      amount: value.amount,
      currency: value.currency,
      stage: value.stage,
      ...(pipelineId ? { pipelineId } : {}),
      closeDate: value.closeDate,
      source: value.source,
      notes: value.notes ? [{ content: value.notes, createdAt: new Date(), author: 'import' }] : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Record<string, unknown>;
    const r = await db.collection('crm_deals').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Task adapter ─────────────────────────────────────────────── */

interface TaskDraft {
  title: string;
  description?: string;
  dueDate?: Date;
  status: 'To-Do' | 'In Progress' | 'Completed';
  priority: 'High' | 'Medium' | 'Low';
  type: 'Call' | 'Meeting' | 'Follow-up' | 'WhatsApp' | 'Email';
  contactEmail?: string;
  dealName?: string;
}

function normalizeTaskStatus(v: string | undefined): TaskDraft['status'] {
  const t = (v ?? '').trim().toLowerCase();
  if (t.startsWith('in progress') || t === 'in_progress' || t === 'doing')
    return 'In Progress';
  if (t.startsWith('complet') || t === 'done') return 'Completed';
  return 'To-Do';
}

function normalizeTaskPriority(v: string | undefined): TaskDraft['priority'] {
  const t = (v ?? '').trim().toLowerCase();
  if (t.startsWith('h')) return 'High';
  if (t.startsWith('l')) return 'Low';
  return 'Medium';
}

function normalizeTaskType(v: string | undefined): TaskDraft['type'] {
  const t = (v ?? '').trim().toLowerCase();
  if (t === 'call') return 'Call';
  if (t === 'meeting') return 'Meeting';
  if (t === 'whatsapp' || t === 'wa') return 'WhatsApp';
  if (t === 'email') return 'Email';
  return 'Follow-up';
}

const TASK_ADAPTER: BulkImportAdapter<TaskDraft> = {
  entityKind: 'task',
  mapRow(raw) {
    const title = s(pickKey(raw, 'title', 'task', 'name'));
    if (!title) {
      return { ok: false, error: 'Missing required column "title".' };
    }
    const dueRaw = s(pickKey(raw, 'dueDate', 'due', 'due_date'));
    let dueDate: Date | undefined;
    if (dueRaw) {
      const d = new Date(dueRaw);
      if (!Number.isNaN(d.getTime())) dueDate = d;
    }
    return {
      ok: true,
      value: {
        title,
        description: s(pickKey(raw, 'description', 'desc', 'notes')),
        dueDate,
        status: normalizeTaskStatus(s(pickKey(raw, 'status'))),
        priority: normalizeTaskPriority(s(pickKey(raw, 'priority'))),
        type: normalizeTaskType(s(pickKey(raw, 'type'))),
        contactEmail: lower(s(pickKey(raw, 'contactEmail', 'email'))) || undefined,
        dealName: s(pickKey(raw, 'deal', 'dealName')),
      },
    };
  },
  dedupKey(value) {
    return `${value.title.toLowerCase()}|${
      value.dueDate ? value.dueDate.toISOString().slice(0, 10) : ''
    }`;
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    let contactId: ObjectId | undefined;
    if (value.contactEmail) {
      const c = await db
        .collection('crm_contacts')
        .findOne({ userId: userObjectId, email: value.contactEmail });
      if (c?._id) contactId = c._id as ObjectId;
    }
    let dealId: ObjectId | undefined;
    if (value.dealName) {
      const d = await db
        .collection('crm_deals')
        .findOne({ userId: userObjectId, name: value.dealName });
      if (d?._id) dealId = d._id as ObjectId;
    }
    const doc = {
      userId: userObjectId,
      title: value.title,
      description: value.description,
      dueDate: value.dueDate,
      status: value.status,
      priority: value.priority,
      type: value.type,
      ...(contactId ? { contactId } : {}),
      ...(dealId ? { dealId } : {}),
      createdAt: new Date(),
    } as Record<string, unknown>;
    const r = await db.collection('crm_tasks').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Ticket adapter ───────────────────────────────────────────── */

interface TicketDraft {
  subject: string;
  description?: string;
  status?: string;
  priority?: string;
  severity?: string;
  category?: string;
  channel?: string;
  requesterEmail?: string;
}

const TICKET_ADAPTER: BulkImportAdapter<TicketDraft> = {
  entityKind: 'ticket',
  mapRow(raw) {
    const subject = s(pickKey(raw, 'subject', 'title', 'ticket'));
    if (!subject) {
      return { ok: false, error: 'Missing required column "subject".' };
    }
    return {
      ok: true,
      value: {
        subject,
        description: s(pickKey(raw, 'description', 'desc', 'body')),
        status: s(pickKey(raw, 'status')) ?? 'open',
        priority: s(pickKey(raw, 'priority')) ?? 'medium',
        severity: s(pickKey(raw, 'severity')) ?? 'minor',
        category: s(pickKey(raw, 'category')),
        channel: s(pickKey(raw, 'channel', 'source')) ?? 'email',
        requesterEmail:
          lower(s(pickKey(raw, 'requesterEmail', 'email', 'from'))) || undefined,
      },
    };
  },
  dedupKey(value) {
    return `${value.subject.toLowerCase()}|${value.requesterEmail ?? ''}`;
  },
  async insertOne(value, ctx) {
    const { db } = await connectToDatabase();
    const userObjectId = new ObjectId(ctx.userId);
    let requesterId: ObjectId | undefined;
    if (value.requesterEmail) {
      const c = await db
        .collection('crm_contacts')
        .findOne({ userId: userObjectId, email: value.requesterEmail });
      if (c?._id) requesterId = c._id as ObjectId;
    }
    const now = new Date();
    const doc = {
      userId: userObjectId,
      subject: value.subject,
      description: value.description,
      status: value.status,
      priority: value.priority,
      severity: value.severity,
      category: value.category,
      channel: value.channel,
      ...(requesterId ? { requesterId } : {}),
      createdAt: now,
      updatedAt: now,
    } as Record<string, unknown>;
    const r = await db.collection('crm_tickets').insertOne(doc);
    return { id: r.insertedId.toString() };
  },
};

/* ─── Public actions ───────────────────────────────────────────── */

interface BulkImportActionInput {
  csv: string;
  dryRun?: boolean;
  dedup?: DedupPolicy;
  maxRows?: number;
}

async function runForKind<T>(
  permKey: string,
  adapter: BulkImportAdapter<T>,
  input: BulkImportActionInput,
): Promise<
  | (BulkImportReport<T> & { success: true })
  | { success: false; error: string }
> {
  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };

  const guard = await requirePermission(permKey, 'create');
  if (!guard.ok) return { success: false, error: guard.error };

  if (typeof input.csv !== 'string' || input.csv.trim().length === 0) {
    return { success: false, error: 'CSV body is required.' };
  }

  const ctx: BulkImportContext = { userId: String(session.user._id) };
  const report = await runBulkImport({
    csv: input.csv,
    adapter,
    ctx,
    dryRun: input.dryRun,
    dedup: input.dedup,
    maxRows: input.maxRows,
  });

  if (!report.dryRun && report.imported > 0) {
    try {
      await writeAuditEntry({
        tenantUserId: String(session.user._id),
        actorId: String(session.user._id),
        action: 'create',
        entityKind: adapter.entityKind,
        entityId: report.insertedIds[0] ?? '',
        reason: `bulk_import:${report.imported}/${report.total}`,
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath(`/dashboard/crm`);
  }

  return { success: true, ...report };
}

export async function importLeadsCsv(input: BulkImportActionInput) {
  return runForKind('crm_lead', LEAD_ADAPTER, input);
}

export async function importContactsCsv(input: BulkImportActionInput) {
  return runForKind('crm_contact', CONTACT_ADAPTER, input);
}

export async function importAccountsCsv(input: BulkImportActionInput) {
  return runForKind('crm_account', ACCOUNT_ADAPTER, input);
}

export async function importItemsCsv(input: BulkImportActionInput) {
  return runForKind('crm_item', ITEM_ADAPTER, input);
}

export async function importVendorsCsv(input: BulkImportActionInput) {
  return runForKind('crm_vendor', VENDOR_ADAPTER, input);
}

export async function importDealsCsv(input: BulkImportActionInput) {
  return runForKind('crm_deal', DEAL_ADAPTER, input);
}

export async function importTasksCsv(input: BulkImportActionInput) {
  return runForKind('crm_task', TASK_ADAPTER, input);
}

export async function importTicketsCsv(input: BulkImportActionInput) {
  return runForKind('crm_ticket', TICKET_ADAPTER, input);
}

/* ─── §5.9 Wizard endpoints (registry-driven) ──────────────────────────
 *
 * Registry-keyed entry points the `<BulkImportWizard>` calls. They keep
 * the legacy per-entity actions above intact for existing callers.
 */

import { parseCsv as parseCsvWizard } from '@/lib/bulk-io';
import { getAdapter as getWizardAdapter } from '@/lib/bulk-import/registry';
import type {
  BulkImportField,
  ExecuteResult,
} from '@/lib/bulk-import/adapters/types';

interface BulkImportPreviewRow {
  rowIndex: number;
  action: 'create' | 'update' | 'skip' | 'error';
  value?: Record<string, unknown>;
  reason?: string;
  existingId?: string;
}

interface BulkImportPreviewResult {
  entityKind: string;
  totalRows: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  errorCount: number;
  rows: BulkImportPreviewRow[];
  previewCsv: string;
}

interface WizardBulkImportArgs {
  entityKind: string;
  csv: string;
  mapping?: Record<string, string>;
  dedupField?: string;
  updateExisting?: boolean;
}

interface WizardSchemaResponse {
  entityKind: string;
  label: string;
  fields: Array<Pick<BulkImportField, 'field' | 'label' | 'required'>>;
}

function applyMappingWizard(
  rows: Array<Record<string, string>>,
  mapping?: Record<string, string>,
): Array<Record<string, string>> {
  if (!mapping) return rows;
  return rows.map((r) => {
    const next: Record<string, string> = {};
    for (const [csvCol, value] of Object.entries(r)) {
      const target = mapping[csvCol];
      if (target) next[target] = value;
    }
    return next;
  });
}

function previewRowsToCsv(rows: BulkImportPreviewRow[]): string {
  const header = ['rowIndex', 'action', 'existingId', 'reason', 'json'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const json = r.value ? JSON.stringify(r.value).replace(/"/g, '""') : '';
    const cells = [
      String(r.rowIndex),
      r.action,
      r.existingId ?? '',
      (r.reason ?? '').replace(/"/g, '""'),
      json ? `"${json}"` : '',
    ];
    lines.push(
      cells
        .map((c) =>
          c.includes(',') || c.includes('"')
            ? `"${c.replace(/"/g, '""')}"`
            : c,
        )
        .join(','),
    );
  }
  return lines.join('\n');
}

export async function getBulkImportSchema(
  entityKind: string,
): Promise<WizardSchemaResponse | null> {
  const adapter = getWizardAdapter(entityKind);
  if (!adapter) return null;
  return {
    entityKind: adapter.entityKind,
    label: adapter.label,
    fields: adapter.targetSchema.map((f) => ({
      field: f.field,
      label: f.label,
      required: f.required,
    })),
  };
}

export async function previewBulkImport(
  args: WizardBulkImportArgs,
): Promise<{ result?: BulkImportPreviewResult; error?: string }> {
  const adapter = getWizardAdapter(args.entityKind);
  if (!adapter) return { error: `Unknown entity "${args.entityKind}".` };
  if (!args.csv || !args.csv.trim()) return { error: 'CSV is empty.' };

  try {
    const parsed = parseCsvWizard(args.csv);
    if (parsed.rows.length === 0) {
      return {
        result: {
          entityKind: args.entityKind,
          totalRows: 0,
          createCount: 0,
          updateCount: 0,
          skipCount: 0,
          errorCount: 0,
          rows: [],
          previewCsv: '',
        },
      };
    }
    const remapped = applyMappingWizard(parsed.rows, args.mapping);

    type Slot = { idx: number; value: unknown };
    const ok: Slot[] = [];
    const previewRows: BulkImportPreviewRow[] = [];
    for (let i = 0; i < remapped.length; i += 1) {
      const r = adapter.normalize(remapped[i]!);
      if (!r.ok) {
        previewRows.push({ rowIndex: i + 1, action: 'error', reason: r.error });
      } else {
        ok.push({ idx: i, value: r.value });
      }
    }

    const buckets = adapter.dedupe(
      ok.map((s) => s.value),
      [],
      args.dedupField,
    );
    let cursor = 0;
    for (const v of buckets.toCreate) {
      const slot = ok[cursor++]!;
      previewRows.push({
        rowIndex: slot.idx + 1,
        action: 'create',
        value: v as Record<string, unknown>,
      });
    }
    for (const v of buckets.toUpdate) {
      const slot = ok[cursor++]!;
      previewRows.push({
        rowIndex: slot.idx + 1,
        action: 'update',
        value: v.value as Record<string, unknown>,
        existingId: v.existingId,
      });
    }
    for (const v of buckets.skipped) {
      const slot = ok[cursor++]!;
      previewRows.push({
        rowIndex: slot.idx + 1,
        action: 'skip',
        value: v.value as Record<string, unknown>,
        reason: v.reason,
      });
    }
    previewRows.sort((a, b) => a.rowIndex - b.rowIndex);

    return {
      result: {
        entityKind: args.entityKind,
        totalRows: parsed.rows.length,
        createCount: previewRows.filter((r) => r.action === 'create').length,
        updateCount: previewRows.filter((r) => r.action === 'update').length,
        skipCount: previewRows.filter((r) => r.action === 'skip').length,
        errorCount: previewRows.filter((r) => r.action === 'error').length,
        rows: previewRows,
        previewCsv: previewRowsToCsv(previewRows),
      },
    };
  } catch (e) {
    console.error('[previewBulkImport] failed:', e);
    return { error: 'Could not preview import.' };
  }
}

export async function executeBulkImport(
  args: WizardBulkImportArgs,
): Promise<{ result?: ExecuteResult; error?: string }> {
  const adapter = getWizardAdapter(args.entityKind);
  if (!adapter) return { error: `Unknown entity "${args.entityKind}".` };
  if (!args.csv || !args.csv.trim()) return { error: 'CSV is empty.' };

  try {
    const parsed = parseCsvWizard(args.csv);
    const remapped = applyMappingWizard(parsed.rows, args.mapping);
    const errs: Array<{ rowIndex: number; error: string }> = [];
    const values: unknown[] = [];
    for (let i = 0; i < remapped.length; i += 1) {
      const r = adapter.normalize(remapped[i]!);
      if (!r.ok) {
        errs.push({ rowIndex: i + 1, error: r.error });
      } else {
        values.push(r.value);
      }
    }
    const result = await adapter.execute(values, {
      updateExisting: args.updateExisting === true,
      dedupField: args.dedupField,
    });
    result.errors = [...errs, ...result.errors];
    revalidatePath('/dashboard/crm', 'layout');
    return { result };
  } catch (e) {
    console.error('[executeBulkImport] failed:', e);
    return { error: 'Import failed.' };
  }
}

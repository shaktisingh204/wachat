/**
 * Bulk-import adapter — CRM Leads (§5.9).
 *
 * Dedup defaults to lowercased email; phone is a fallback option.
 */

import 'server-only';

import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import type {
    BulkImportAdapterSpec,
    BulkImportField,
    DedupeBuckets,
    ExecuteOptions,
    ExecuteResult,
    NormalizeResult,
} from './types';

export interface LeadImportRow {
    title: string;
    contactName: string;
    email: string;
    phone?: string;
    company?: string;
    website?: string;
    country?: string;
    status?: string;
    source?: string;
    value?: number;
    currency?: string;
    description?: string;
}

const SCHEMA: BulkImportField[] = [
    { field: 'title', label: 'Lead title', required: true },
    { field: 'contactName', label: 'Contact name', required: true },
    {
        field: 'email',
        label: 'Email',
        required: true,
        validator: (v) =>
            v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
                ? 'Invalid email format'
                : null,
    },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'company', label: 'Company', required: false },
    { field: 'website', label: 'Website', required: false },
    { field: 'country', label: 'Country', required: false },
    { field: 'status', label: 'Status', required: false },
    { field: 'source', label: 'Source', required: false },
    {
        field: 'value',
        label: 'Deal value',
        required: false,
        validator: (v) =>
            v && !Number.isFinite(Number(v)) ? 'Not a number' : null,
    },
    { field: 'currency', label: 'Currency (ISO)', required: false },
    { field: 'description', label: 'Description', required: false },
];

function trimOrUndef(v: string | undefined): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length === 0 ? undefined : t;
}

function normalize(row: Record<string, string>): NormalizeResult<LeadImportRow> {
    const title = trimOrUndef(row.title);
    const contactName = trimOrUndef(row.contactName);
    const email = trimOrUndef(row.email)?.toLowerCase();
    if (!title) return { ok: false, error: 'Missing "title"' };
    if (!contactName) return { ok: false, error: 'Missing "contactName"' };
    if (!email) return { ok: false, error: 'Missing "email"' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: `Invalid email "${email}"` };
    }
    const rawValue = trimOrUndef(row.value);
    const value = rawValue ? Number(rawValue) : undefined;
    if (rawValue && !Number.isFinite(value)) {
        return { ok: false, error: `Value "${rawValue}" is not numeric` };
    }
    return {
        ok: true,
        value: {
            title,
            contactName,
            email,
            phone: trimOrUndef(row.phone),
            company: trimOrUndef(row.company),
            website: trimOrUndef(row.website),
            country: trimOrUndef(row.country),
            status: trimOrUndef(row.status),
            source: trimOrUndef(row.source),
            value,
            currency: trimOrUndef(row.currency)?.toUpperCase(),
            description: trimOrUndef(row.description),
        },
    };
}

function keyOf(row: LeadImportRow, field: string): string {
    if (field === 'phone') return (row.phone ?? '').toLowerCase();
    return (row.email ?? '').toLowerCase();
}

function dedupe(
    rows: LeadImportRow[],
    existing: LeadImportRow[],
    dedupField: string = 'email',
): DedupeBuckets<LeadImportRow> {
    const out: DedupeBuckets<LeadImportRow> = {
        toCreate: [],
        toUpdate: [],
        skipped: [],
    };
    const existingMap = new Map<string, LeadImportRow & { _id?: string }>();
    for (const e of existing) {
        const k = keyOf(e, dedupField);
        if (k) existingMap.set(k, e as LeadImportRow & { _id?: string });
    }
    const seenInFile = new Set<string>();
    for (const r of rows) {
        const k = keyOf(r, dedupField);
        if (k && seenInFile.has(k)) {
            out.skipped.push({ value: r, reason: 'Duplicate within file' });
            continue;
        }
        if (k) seenInFile.add(k);
        if (k && existingMap.has(k)) {
            const ex = existingMap.get(k)!;
            out.toUpdate.push({
                value: r,
                existingId: String((ex as { _id?: unknown })._id ?? ''),
            });
        } else {
            out.toCreate.push(r);
        }
    }
    return out;
}

async function execute(
    rows: LeadImportRow[],
    options?: ExecuteOptions,
): Promise<ExecuteResult> {
    const result: ExecuteResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const session = await getSession();
    if (!session?.user) {
        result.errors.push({ rowIndex: 0, error: 'Authentication required.' });
        return result;
    }
    const createGuard = await requirePermission('crm_lead', 'create');
    if (!createGuard.ok) {
        result.errors.push({ rowIndex: 0, error: createGuard.error });
        return result;
    }
    const updateExisting = options?.updateExisting === true;
    if (updateExisting) {
        const editGuard = await requirePermission('crm_lead', 'edit');
        if (!editGuard.ok) {
            result.errors.push({ rowIndex: 0, error: editGuard.error });
            return result;
        }
    }
    const dedupField = options?.dedupField || 'email';

    const { db } = await connectToDatabase();
    const userOid = new ObjectId(String(session.user._id));

    const existingDocs = await db
        .collection('crm_leads')
        .find({ userId: userOid }, { projection: { _id: 1, email: 1, phone: 1 } })
        .toArray();
    const existingMap = new Map<string, string>();
    for (const d of existingDocs) {
        const k =
            dedupField === 'phone'
                ? String((d as { phone?: string }).phone ?? '').toLowerCase()
                : String((d as { email?: string }).email ?? '').toLowerCase();
        if (k) existingMap.set(k, String(d._id));
    }

    for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i]!;
        const k = keyOf(r, dedupField);
        const existingId = k ? existingMap.get(k) : undefined;
        try {
            if (existingId && updateExisting) {
                const $set: Record<string, unknown> = {
                    title: r.title,
                    contactName: r.contactName,
                    email: r.email,
                    phone: r.phone,
                    company: r.company,
                    website: r.website,
                    country: r.country,
                    status: r.status,
                    source: r.source,
                    value: r.value,
                    currency: r.currency,
                    description: r.description,
                    updatedAt: new Date(),
                };
                await db
                    .collection('crm_leads')
                    .updateOne(
                        { _id: new ObjectId(existingId), userId: userOid },
                        { $set },
                    );
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'lead',
                    entityId: existingId,
                    reason: 'bulk_import',
                });
                result.updated += 1;
            } else if (existingId && !updateExisting) {
                result.skipped += 1;
            } else {
                const doc = {
                    userId: userOid,
                    title: r.title,
                    contactName: r.contactName,
                    email: r.email,
                    phone: r.phone,
                    company: r.company,
                    website: r.website,
                    country: r.country,
                    status: r.status ?? 'New',
                    source: r.source ?? 'csv-import',
                    value: r.value ?? 0,
                    currency: r.currency ?? 'INR',
                    description: r.description,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                const inserted = await db.collection('crm_leads').insertOne(doc);
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'lead',
                    entityId: String(inserted.insertedId),
                    reason: 'bulk_import',
                });
                result.created += 1;
            }
        } catch (e) {
            result.errors.push({
                rowIndex: i + 1,
                error: e instanceof Error ? e.message : 'insert failed',
            });
        }
    }
    return result;
}

export const leadsAdapter: BulkImportAdapterSpec<LeadImportRow> = {
    entityKind: 'lead',
    label: 'Leads',
    targetSchema: SCHEMA,
    normalize,
    dedupe,
    execute,
};

export default leadsAdapter;

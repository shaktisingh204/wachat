/**
 * Bulk-import adapter — CRM Contacts (§5.9).
 *
 * Dedup key defaults to lowercased email; can be overridden via
 * `ExecuteOptions.dedupField`. Permission-gated on `crm_contact` create
 * + edit inside `execute`.
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

export interface ContactImportRow {
    name: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    status?: string;
    lifecycleStage?: string;
    leadSource?: string;
    owner?: string;
    tags?: string[];
    linkedinUrl?: string;
    notes?: string;
}

const SCHEMA: BulkImportField[] = [
    { field: 'name', label: 'Full name', required: true },
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
    { field: 'jobTitle', label: 'Job title', required: false },
    { field: 'status', label: 'Status', required: false },
    { field: 'lifecycleStage', label: 'Lifecycle stage', required: false },
    { field: 'leadSource', label: 'Lead source', required: false },
    { field: 'owner', label: 'Owner', required: false },
    { field: 'tags', label: 'Tags (comma-separated)', required: false },
    { field: 'linkedinUrl', label: 'LinkedIn URL', required: false },
    { field: 'notes', label: 'Notes', required: false },
];

function trimOrUndef(v: string | undefined): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length === 0 ? undefined : t;
}

function normalize(row: Record<string, string>): NormalizeResult<ContactImportRow> {
    const name = trimOrUndef(row.name);
    const email = trimOrUndef(row.email)?.toLowerCase();
    if (!name) return { ok: false, error: 'Missing "name"' };
    if (!email) return { ok: false, error: 'Missing "email"' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, error: `Invalid email "${email}"` };
    }
    const tagsRaw = trimOrUndef(row.tags);
    const tags = tagsRaw
        ? tagsRaw
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
        : undefined;
    return {
        ok: true,
        value: {
            name,
            email,
            phone: trimOrUndef(row.phone),
            company: trimOrUndef(row.company),
            jobTitle: trimOrUndef(row.jobTitle),
            status: trimOrUndef(row.status),
            lifecycleStage: trimOrUndef(row.lifecycleStage),
            leadSource: trimOrUndef(row.leadSource),
            owner: trimOrUndef(row.owner),
            tags,
            linkedinUrl: trimOrUndef(row.linkedinUrl),
            notes: trimOrUndef(row.notes),
        },
    };
}

function keyOf(row: ContactImportRow, field: string): string {
    if (field === 'phone') return (row.phone ?? '').toLowerCase();
    return (row.email ?? '').toLowerCase();
}

function dedupe(
    rows: ContactImportRow[],
    existing: ContactImportRow[],
    dedupField: string = 'email',
): DedupeBuckets<ContactImportRow> {
    const out: DedupeBuckets<ContactImportRow> = {
        toCreate: [],
        toUpdate: [],
        skipped: [],
    };
    const existingMap = new Map<string, ContactImportRow & { _id?: string }>();
    for (const e of existing) {
        const k = keyOf(e, dedupField);
        if (k) existingMap.set(k, e as ContactImportRow & { _id?: string });
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
    rows: ContactImportRow[],
    options?: ExecuteOptions,
): Promise<ExecuteResult> {
    const result: ExecuteResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const session = await getSession();
    if (!session?.user) {
        result.errors.push({ rowIndex: 0, error: 'Authentication required.' });
        return result;
    }
    const createGuard = await requirePermission('crm_contact', 'create');
    if (!createGuard.ok) {
        result.errors.push({ rowIndex: 0, error: createGuard.error });
        return result;
    }
    const updateExisting = options?.updateExisting === true;
    if (updateExisting) {
        const editGuard = await requirePermission('crm_contact', 'edit');
        if (!editGuard.ok) {
            result.errors.push({ rowIndex: 0, error: editGuard.error });
            return result;
        }
    }
    const dedupField = options?.dedupField || 'email';

    const { db } = await connectToDatabase();
    const userOid = new ObjectId(String(session.user._id));

    // Pull existing contacts for tenant once to keep this O(N+M).
    const existingDocs = await db
        .collection('crm_contacts')
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
                    name: r.name,
                    email: r.email,
                    phone: r.phone,
                    company: r.company,
                    jobTitle: r.jobTitle,
                    status: r.status,
                    lifecycleStage: r.lifecycleStage,
                    leadSource: r.leadSource,
                    owner: r.owner,
                    tags: r.tags,
                    linkedinUrl: r.linkedinUrl,
                    updatedAt: new Date(),
                };
                await db
                    .collection('crm_contacts')
                    .updateOne(
                        { _id: new ObjectId(existingId), userId: userOid },
                        { $set },
                    );
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'contact',
                    entityId: existingId,
                    reason: 'bulk_import',
                });
                result.updated += 1;
            } else if (existingId && !updateExisting) {
                result.skipped += 1;
            } else {
                const doc = {
                    userId: userOid,
                    name: r.name,
                    email: r.email,
                    phone: r.phone,
                    company: r.company,
                    jobTitle: r.jobTitle,
                    status: r.status ?? 'imported',
                    lifecycleStage: r.lifecycleStage,
                    leadSource: r.leadSource,
                    owner: r.owner,
                    tags: r.tags,
                    linkedinUrl: r.linkedinUrl,
                    notes: r.notes
                        ? [
                              {
                                  content: r.notes,
                                  createdAt: new Date(),
                                  author: 'CSV import',
                              },
                          ]
                        : [],
                    createdAt: new Date(),
                };
                const inserted = await db.collection('crm_contacts').insertOne(doc);
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'contact',
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

export const contactsAdapter: BulkImportAdapterSpec<ContactImportRow> = {
    entityKind: 'contact',
    label: 'Contacts',
    targetSchema: SCHEMA,
    normalize,
    dedupe,
    execute,
};

export default contactsAdapter;

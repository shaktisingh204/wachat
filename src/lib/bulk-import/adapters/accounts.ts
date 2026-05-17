/**
 * Bulk-import adapter — CRM Accounts/Companies (§5.9).
 *
 * Dedup defaults to GSTIN (when present) and falls back to lowercased
 * company name.
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

export interface AccountImportRow {
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    gstin?: string;
    pan?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    annualRevenue?: number;
    employeeCount?: number;
    currency?: string;
}

const SCHEMA: BulkImportField[] = [
    { field: 'name', label: 'Company name', required: true },
    { field: 'industry', label: 'Industry', required: false },
    { field: 'website', label: 'Website', required: false },
    { field: 'phone', label: 'Phone', required: false },
    { field: 'gstin', label: 'GSTIN', required: false },
    { field: 'pan', label: 'PAN', required: false },
    { field: 'address', label: 'Address', required: false },
    { field: 'city', label: 'City', required: false },
    { field: 'state', label: 'State', required: false },
    { field: 'country', label: 'Country', required: false },
    {
        field: 'annualRevenue',
        label: 'Annual revenue',
        required: false,
        validator: (v) =>
            v && !Number.isFinite(Number(v)) ? 'Not a number' : null,
    },
    {
        field: 'employeeCount',
        label: 'Employees',
        required: false,
        validator: (v) =>
            v && !Number.isFinite(Number(v)) ? 'Not a number' : null,
    },
    { field: 'currency', label: 'Currency (ISO)', required: false },
];

function trimOrUndef(v: string | undefined): string | undefined {
    if (typeof v !== 'string') return undefined;
    const t = v.trim();
    return t.length === 0 ? undefined : t;
}

function asNumber(v: string | undefined): number | undefined {
    const t = trimOrUndef(v);
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
}

function normalize(row: Record<string, string>): NormalizeResult<AccountImportRow> {
    const name = trimOrUndef(row.name);
    if (!name) return { ok: false, error: 'Missing "name"' };
    return {
        ok: true,
        value: {
            name,
            industry: trimOrUndef(row.industry),
            website: trimOrUndef(row.website),
            phone: trimOrUndef(row.phone),
            gstin: trimOrUndef(row.gstin)?.toUpperCase(),
            pan: trimOrUndef(row.pan)?.toUpperCase(),
            address: trimOrUndef(row.address),
            city: trimOrUndef(row.city),
            state: trimOrUndef(row.state),
            country: trimOrUndef(row.country),
            annualRevenue: asNumber(row.annualRevenue),
            employeeCount: asNumber(row.employeeCount),
            currency: trimOrUndef(row.currency)?.toUpperCase(),
        },
    };
}

function keyOf(row: AccountImportRow, field: string): string {
    if (field === 'gstin') return (row.gstin ?? '').toLowerCase();
    if (field === 'website') return (row.website ?? '').toLowerCase();
    return (row.name ?? '').toLowerCase();
}

function dedupe(
    rows: AccountImportRow[],
    existing: AccountImportRow[],
    dedupField: string = 'name',
): DedupeBuckets<AccountImportRow> {
    const out: DedupeBuckets<AccountImportRow> = {
        toCreate: [],
        toUpdate: [],
        skipped: [],
    };
    const existingMap = new Map<string, AccountImportRow & { _id?: string }>();
    for (const e of existing) {
        const k = keyOf(e, dedupField);
        if (k) existingMap.set(k, e as AccountImportRow & { _id?: string });
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
    rows: AccountImportRow[],
    options?: ExecuteOptions,
): Promise<ExecuteResult> {
    const result: ExecuteResult = { created: 0, updated: 0, skipped: 0, errors: [] };
    const session = await getSession();
    if (!session?.user) {
        result.errors.push({ rowIndex: 0, error: 'Authentication required.' });
        return result;
    }
    const createGuard = await requirePermission('crm_account', 'create');
    if (!createGuard.ok) {
        result.errors.push({ rowIndex: 0, error: createGuard.error });
        return result;
    }
    const updateExisting = options?.updateExisting === true;
    if (updateExisting) {
        const editGuard = await requirePermission('crm_account', 'edit');
        if (!editGuard.ok) {
            result.errors.push({ rowIndex: 0, error: editGuard.error });
            return result;
        }
    }
    const dedupField = options?.dedupField || 'name';

    const { db } = await connectToDatabase();
    const userOid = new ObjectId(String(session.user._id));

    const existingDocs = await db
        .collection('crm_accounts')
        .find(
            { userId: userOid },
            { projection: { _id: 1, name: 1, gstin: 1, website: 1 } },
        )
        .toArray();
    const existingMap = new Map<string, string>();
    for (const d of existingDocs) {
        const docTyped = d as {
            name?: string;
            gstin?: string;
            website?: string;
        };
        const k =
            dedupField === 'gstin'
                ? String(docTyped.gstin ?? '').toLowerCase()
                : dedupField === 'website'
                  ? String(docTyped.website ?? '').toLowerCase()
                  : String(docTyped.name ?? '').toLowerCase();
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
                    industry: r.industry,
                    website: r.website,
                    phone: r.phone,
                    gstin: r.gstin,
                    pan: r.pan,
                    address: r.address,
                    city: r.city,
                    state: r.state,
                    country: r.country,
                    annualRevenue: r.annualRevenue,
                    employeeCount: r.employeeCount,
                    currency: r.currency,
                    updatedAt: new Date(),
                };
                await db
                    .collection('crm_accounts')
                    .updateOne(
                        { _id: new ObjectId(existingId), userId: userOid },
                        { $set },
                    );
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'update',
                    entityKind: 'account',
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
                    industry: r.industry,
                    website: r.website,
                    phone: r.phone,
                    gstin: r.gstin,
                    pan: r.pan,
                    address: r.address,
                    city: r.city,
                    state: r.state,
                    country: r.country,
                    annualRevenue: r.annualRevenue,
                    employeeCount: r.employeeCount,
                    currency: r.currency,
                    status: 'active',
                    createdAt: new Date(),
                };
                const inserted = await db.collection('crm_accounts').insertOne(doc);
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: 'create',
                    entityKind: 'account',
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

export const accountsAdapter: BulkImportAdapterSpec<AccountImportRow> = {
    entityKind: 'account',
    label: 'Accounts / Companies',
    targetSchema: SCHEMA,
    normalize,
    dedupe,
    execute,
};

export default accountsAdapter;

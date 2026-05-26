'use server';

/**
 * CRM Expense Claims — Mongo-backed (no Rust crate).
 *
 * Employee reimbursement requests against the `crm_expense_claims`
 * collection. Each claim is scoped by tenant `userId`, references a
 * `category_id` from `crm_expense_categories`, and links to a single
 * receipt asset via SabFiles. Claim numbers are auto-generated on
 * create with monthly sequence padding (`EC-YYYYMM-NNNN`).
 *
 * Receipts MUST originate from SabFilePickerButton — no free-text URL
 * paste anywhere in the UI (project policy).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmExpenseClaimsApi } from '@/lib/rust-client/crm-expense-claims';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

const COLLECTION = 'crm_expense_claims';
const BASE_PATH = '/dashboard/hrm/hr/expense-claims';
const RBAC_KEY = 'crm_expense_claim';
const ENTITY_KIND = 'expense_claim';

export type CrmExpenseClaimStatus =
    | 'draft'
    | 'submitted'
    | 'approved'
    | 'rejected'
    | 'reimbursed'
    | 'cancelled'
    | 'archived';

export interface CrmExpenseClaimDoc {
    _id: string;
    userId?: string;
    employee_id: string;
    employee_name?: string;
    claim_number: string;
    category_id?: string;
    category_name?: string;
    amount: number;
    currency?: string;
    expense_date?: string;
    description?: string;
    receipt_url?: string;
    receipt_name?: string;
    status: CrmExpenseClaimStatus;
    approver_id?: string;
    approver_name?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CrmExpenseClaimFilters {
    q?: string;
    status?: CrmExpenseClaimStatus | 'all';
    employeeId?: string;
    categoryId?: string;
}

const VALID_STATUSES: ReadonlySet<CrmExpenseClaimStatus> =
    new Set<CrmExpenseClaimStatus>([
        'draft',
        'submitted',
        'approved',
        'rejected',
        'reimbursed',
        'cancelled',
        'archived',
    ]);

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function serialize<T extends WithId<Record<string, unknown>>>(doc: T): CrmExpenseClaimDoc {
    return JSON.parse(JSON.stringify(doc)) as CrmExpenseClaimDoc;
}

/**
 * Generate `EC-YYYYMM-NNNN` by counting existing claims in the current
 * month for the tenant + adding 1. Best-effort: collisions are rare and
 * the user can edit before submit.
 */
async function nextClaimNumber(
    db: import('mongodb').Db,
    userObjectId: ObjectId,
): Promise<string> {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prefix = `EC-${yyyymm}-`;

    const last = await db
        .collection(COLLECTION)
        .find(
            { userId: userObjectId, claim_number: { $regex: `^${prefix}` } },
            { projection: { claim_number: 1 } },
        )
        .sort({ claim_number: -1 })
        .limit(1)
        .toArray();

    let next = 1;
    if (last.length > 0) {
        const lastNum = String(last[0].claim_number ?? '').slice(prefix.length);
        const n = Number.parseInt(lastNum, 10);
        if (Number.isFinite(n)) next = n + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getExpenseClaims(
    filters?: CrmExpenseClaimFilters,
): Promise<CrmExpenseClaimDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmExpenseClaimsApi.list({
                q: filters?.q,
                status: filters?.status,
                employeeId: filters?.employeeId,
                categoryId: filters?.categoryId,
            });
            return JSON.parse(JSON.stringify(res.items ?? [])) as CrmExpenseClaimDoc[];
        } catch (e) {
            console.error('[getExpenseClaims] rust path failed; falling back:', e);
            recordRustFallback({
                entity: ENTITY_KIND,
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId: new ObjectId(session.user._id as string),
        };

        if (filters?.status && filters.status !== 'all') filter.status = filters.status;
        if (filters?.employeeId) filter.employee_id = filters.employeeId;
        if (filters?.categoryId) filter.category_id = filters.categoryId;

        if (filters?.q) {
            const rx = new RegExp(filters.q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
            filter.$or = [
                { employee_name: { $regex: rx } },
                { employee_id: { $regex: rx } },
                { claim_number: { $regex: rx } },
                { description: { $regex: rx } },
            ];
        }

        const rows = await db
            .collection(COLLECTION)
            .find(filter)
            .sort({ expense_date: -1, createdAt: -1 })
            .limit(200)
            .toArray();

        return rows.map((r) => serialize(r as WithId<Record<string, unknown>>));
    } catch (e) {
        console.error('[getExpenseClaims] failed:', e);
        return [];
    }
}

export async function getExpenseClaimById(
    id: string,
): Promise<CrmExpenseClaimDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission(RBAC_KEY, 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmExpenseClaimsApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as CrmExpenseClaimDoc;
        } catch (e) {
            console.error('[getExpenseClaimById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: ENTITY_KIND,
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (!doc) return null;
        return serialize(doc as WithId<Record<string, unknown>>);
    } catch (e) {
        console.error('[getExpenseClaimById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export interface ClaimPayload {
    employee_id: string;
    employee_name?: string;
    category_id?: string;
    category_name?: string;
    amount: number;
    currency?: string;
    expense_date?: Date;
    description?: string;
    receipt_url?: string;
    receipt_name?: string;
    status: CrmExpenseClaimStatus;
    approver_id?: string;
    approver_name?: string;
}

function readPayload(formData: FormData): {
    payload?: ClaimPayload;
    error?: string;
} {
    const employee_id = asString(formData.get('employee_id'));
    if (!employee_id) return { error: 'Employee is required.' };

    const amount = asNumber(formData.get('amount'));
    if (amount == null) return { error: 'Amount is required.' };
    if (amount < 0) return { error: 'Amount cannot be negative.' };

    const statusRaw = asString(formData.get('status')) ?? 'submitted';
    const status: CrmExpenseClaimStatus = VALID_STATUSES.has(
        statusRaw as CrmExpenseClaimStatus,
    )
        ? (statusRaw as CrmExpenseClaimStatus)
        : 'submitted';

    const expenseDateStr = asString(formData.get('expense_date'));

    const payload: ClaimPayload = {
        employee_id,
        employee_name: asString(formData.get('employee_name')),
        category_id: asString(formData.get('category_id')),
        category_name: asString(formData.get('category_name')),
        amount,
        currency: asString(formData.get('currency')) ?? 'INR',
        ...(expenseDateStr ? { expense_date: new Date(expenseDateStr) } : {}),
        description: asString(formData.get('description')),
        receipt_url: asString(formData.get('receipt_url')),
        receipt_name: asString(formData.get('receipt_name')),
        status,
        approver_id: asString(formData.get('approver_id')),
        approver_name: asString(formData.get('approver_name')),
    };

    return { payload };
}

export async function saveExpenseClaim(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const claimId = asString(formData.get('claimId'));
    const isEditing = !!claimId;

    const guard = await requirePermission(RBAC_KEY, isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error || !payload) return { error: error ?? 'Invalid payload.' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const now = new Date();

        if (isEditing && ObjectId.isValid(claimId!)) {
            const result = await db.collection(COLLECTION).updateOne(
                { _id: new ObjectId(claimId!), userId: userObjectId },
                { $set: { ...payload, updatedAt: now } },
            );
            if (result.matchedCount === 0) return { error: 'Expense claim not found.' };

            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'update',
                entityKind: ENTITY_KIND,
                entityId: claimId!,
                reason: `Expense claim status=${payload.status} amount=${payload.amount}`,
            });
            revalidatePath(BASE_PATH);
            revalidatePath(`${BASE_PATH}/${claimId}`);
            return { message: 'Expense claim updated.', id: claimId! };
        }

        const claim_number = await nextClaimNumber(db, userObjectId);
        const inserted = await db.collection(COLLECTION).insertOne({
            ...payload,
            claim_number,
            userId: userObjectId,
            createdAt: now,
            updatedAt: now,
        });
        const id = inserted.insertedId.toString();

        void writeAuditEntry({
            tenantUserId: session.user._id as string,
            action: 'create',
            entityKind: ENTITY_KIND,
            entityId: id,
            reason: `Expense claim ${claim_number} for employee ${payload.employee_id}`,
        });

        revalidatePath(BASE_PATH);
        return { message: `Expense claim ${claim_number} created.`, id };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveExpenseClaim] failed:', msg);
        return { error: `Failed to save expense claim: ${msg}` };
    }
}

export async function deleteExpenseClaim(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid id.' };

    const guard = await requirePermission(RBAC_KEY, 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        if (result.deletedCount > 0) {
            void writeAuditEntry({
                tenantUserId: session.user._id as string,
                action: 'delete',
                entityKind: ENTITY_KIND,
                entityId: id,
            });
        }
        revalidatePath(BASE_PATH);
        return { success: result.deletedCount > 0 };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteExpenseClaim] failed:', msg);
        return { success: false, error: msg };
    }
}

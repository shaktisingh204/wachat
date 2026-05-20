'use server';

/**
 * CRM Account server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, every action delegates to the Rust BFF
 *    (`/v1/crm/accounts`) via `src/lib/rust-client/crm-accounts.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/crm/accounts/**` and `/dashboard/crm/sales/clients/**` keep
 * working without changes.
 */

import { revalidatePath } from 'next/cache';
import { type Filter, type Document, ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import type { CrmAccount } from '@/lib/definitions';
import { connectToDatabase } from '@/lib/mongodb';
import { accountApi, type CrmAccountDoc } from '@/lib/rust-client/crm-accounts';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { getErrorMessage } from '@/lib/utils';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/** Re-revalidate every dashboard route that lists or detail-renders accounts. */
function revalidateAccountSurfaces(accountId?: string): void {
    revalidatePath('/dashboard/crm/accounts');
    revalidatePath('/dashboard/crm/sales/clients');
    if (accountId) {
        revalidatePath(`/dashboard/crm/accounts/${accountId}`);
    }
}

/* ─── Rust-shape → legacy TS-shape adapter ────────────────────────────── */

function rustDocToLegacy(doc: CrmAccountDoc): WithId<CrmAccount> {
    return {
        ...(doc as unknown as WithId<CrmAccount>),
        _id: doc._id ? (doc._id as unknown as ObjectId) : (undefined as unknown as ObjectId),
        userId: doc.userId as unknown as ObjectId,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
    };
}

/* ─── getCrmAccounts ─────────────────────────────────────────────────── */

export async function getCrmAccounts(
    page: number = 1,
    limit: number = 20,
    query?: string,
    status: 'active' | 'archived' | 'all' = 'active',
): Promise<{ accounts: WithId<CrmAccount>[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { accounts: [], total: 0 };

    if (useRustCrm()) {
        try {
            const result = await accountApi.list({
                q: query,
                page: Math.max(0, page - 1),
                limit,
                filter: status === 'all' ? undefined : { status },
            });
            return {
                accounts: result.items.map(rustDocToLegacy),
                total: result.total ?? result.items.length,
            };
        } catch (e) {
            console.error('[getCrmAccounts] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'account', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const filter: any = { userId: userObjectId };
        if (status === 'active') {
            filter.status = { $ne: 'archived' };
        } else if (status === 'archived') {
            filter.status = 'archived';
        }

        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { industry: queryRegex },
                { website: queryRegex },
            ];
        }

        const skip = (page - 1) * limit;

        const [accounts, total] = await Promise.all([
            db
                .collection<CrmAccount>('crm_accounts')
                .find(filter as Filter<Document>)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_accounts').countDocuments(filter as Filter<Document>),
        ]);

        return {
            accounts: JSON.parse(JSON.stringify(accounts)),
            total,
        };
    } catch (e: any) {
        console.error('Failed to fetch CRM accounts:', e);
        return { accounts: [], total: 0 };
    }
}

/* ─── getCrmAccountById ──────────────────────────────────────────────── */

export async function getCrmAccountById(
    accountId: string,
): Promise<WithId<CrmAccount> | null> {
    if (!accountId) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await accountApi.getById(accountId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            console.error('[getCrmAccountById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'account', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(accountId)) return null;

    try {
        const { db } = await connectToDatabase();
        const account = await db.collection<CrmAccount>('crm_accounts').findOne({
            _id: new ObjectId(accountId),
            userId: new ObjectId(session.user._id),
        });

        return account ? JSON.parse(JSON.stringify(account)) : null;
    } catch {
        return null;
    }
}

/* ─── addCrmAccount ──────────────────────────────────────────────────── */

export async function addCrmAccount(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; newClient?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_account', 'create');
    if (!guard.ok) return { error: guard.error };

    const name =
        (formData.get('businessName') as string | null) ||
        (formData.get('name') as string | null) ||
        '';
    if (!name.trim()) {
        return { error: 'Company Name is required.' };
    }

    const str = (k: string) => (formData.get(k) as string | null) || undefined;
    const num = (k: string) => {
        const v = formData.get(k);
        if (v == null || v === '') return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };
    const cat = (() => {
        const v = str('category');
        return v && ['new', 'strategic', 'key', 'regular'].includes(v)
            ? (v as CrmAccount['category'])
            : undefined;
    })();
    const pt = (() => {
        const v = str('paymentTerms');
        return v &&
            ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Immediate'].includes(v)
            ? (v as CrmAccount['paymentTerms'])
            : undefined;
    })();

    if (useRustCrm()) {
        try {
            const { id, entity } = await accountApi.create({
                name,
                industry: str('industry'),
                website: str('website'),
                phone: str('phone'),
                address: str('address'),
                country: str('country'),
                state: str('state'),
                city: str('city'),
                gstin: str('gstin'),
                pan: str('pan'),
                billingAddress: str('billingAddress'),
                shippingAddress: str('shippingAddress'),
                annualRevenue: num('annualRevenue'),
                employeeCount: num('employeeCount'),
                currency: str('currency'),
                paymentTerms: pt,
                category: cat,
                logoUrl: str('logoUrl'),
            });
            revalidateAccountSurfaces();
            // Phase 7: fire-and-forget webhook fan-out for `account.created`.
            // Wrapped defensively so any failure here can never unwind the
            // user-visible mutation. Same pattern is used by every CRM action
            // that will eventually emit events (this is the wiring example).
            try {
                const { dispatchWebhookEvent } = await import('@/lib/webhooks/dispatch');
                void dispatchWebhookEvent(
                    String(session.user._id),
                    'account.created',
                    {
                        account: entity
                            ? { ...rustDocToLegacy(entity), _id: id }
                            : { _id: id, name },
                    },
                );
            } catch (whErr) {
                console.error('[addCrmAccount] webhook dispatch failed:', whErr);
            }
            return {
                message: 'Account added successfully.',
                newClient: entity
                    ? { ...rustDocToLegacy(entity), _id: id }
                    : { _id: id, name },
            };
        } catch (e) {
            const msg = e instanceof RustApiError ? e.message : getErrorMessage(e);
            console.error('[addCrmAccount] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'account', op: 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through to legacy on failure so users aren't blocked
            void msg;
        }
    }

    try {
        const newAccount: Partial<CrmAccount> = {
            userId: new ObjectId(session.user._id),
            name,
            industry: str('industry'),
            website: str('website'),
            phone: str('phone'),
            address: str('address'),
            country: str('country'),
            state: str('state'),
            city: str('city'),
            gstin: str('gstin'),
            pan: str('pan'),
            billingAddress: str('billingAddress'),
            shippingAddress: str('shippingAddress'),
            annualRevenue: num('annualRevenue'),
            employeeCount: num('employeeCount'),
            currency: str('currency'),
            paymentTerms: pt,
            category: cat,
            logoUrl: str('logoUrl'),
            notes: [],
            createdAt: new Date(),
            status: 'active',
        };

        const { db } = await connectToDatabase();
        const result = await db
            .collection('crm_accounts')
            .insertOne(newAccount as CrmAccount);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'account',
            entityId: String(result.insertedId),
        });

        revalidateAccountSurfaces();
        // Phase 7: webhook fan-out (legacy path).
        try {
            const { dispatchWebhookEvent } = await import('@/lib/webhooks/dispatch');
            void dispatchWebhookEvent(
                String(session.user._id),
                'account.created',
                { account: { ...newAccount, _id: result.insertedId } },
            );
        } catch (whErr) {
            console.error('[addCrmAccount] webhook dispatch failed:', whErr);
        }
        return {
            message: 'Account added successfully.',
            newClient: { ...newAccount, _id: result.insertedId },
        };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── updateCrmAccount ───────────────────────────────────────────────── */

export async function updateCrmAccount(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; accountId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const guard = await requirePermission('crm_account', 'edit');
    if (!guard.ok) return { error: guard.error };

    const accountId = formData.get('accountId') as string;
    if (!accountId) {
        return { error: 'Invalid Account ID.' };
    }
    const name = (formData.get('name') as string | null) || '';
    if (!name.trim()) {
        return { error: 'Company Name is required.' };
    }

    const str = (k: string) => (formData.get(k) as string | null) || undefined;
    const num = (k: string) => {
        const v = formData.get(k);
        if (v == null || v === '') return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
    };
    const cat = (() => {
        const v = str('category');
        return v && ['new', 'strategic', 'key', 'regular'].includes(v)
            ? (v as CrmAccount['category'])
            : undefined;
    })();
    const pt = (() => {
        const v = str('paymentTerms');
        return v &&
            ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Immediate'].includes(v)
            ? (v as CrmAccount['paymentTerms'])
            : undefined;
    })();

    if (useRustCrm()) {
        try {
            await accountApi.update(accountId, {
                name,
                industry: str('industry'),
                website: str('website'),
                phone: str('phone'),
                address: str('address'),
                country: str('country'),
                state: str('state'),
                city: str('city'),
                gstin: str('gstin'),
                pan: str('pan'),
                billingAddress: str('billingAddress'),
                shippingAddress: str('shippingAddress'),
                annualRevenue: num('annualRevenue'),
                employeeCount: num('employeeCount'),
                currency: str('currency'),
                paymentTerms: pt,
                category: cat,
                logoUrl: str('logoUrl'),
            });
            revalidateAccountSurfaces(accountId);
            return { message: 'Account updated successfully.', accountId };
        } catch (e) {
            console.error('[updateCrmAccount] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'account', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(accountId)) {
        return { error: 'Invalid Account ID.' };
    }

    try {
        const accountUpdatesRaw: Record<string, unknown> = {
            name,
            industry: str('industry'),
            website: str('website'),
            phone: str('phone'),
            address: str('address'),
            country: str('country'),
            state: str('state'),
            city: str('city'),
            gstin: str('gstin'),
            pan: str('pan'),
            billingAddress: str('billingAddress'),
            shippingAddress: str('shippingAddress'),
            annualRevenue: num('annualRevenue'),
            employeeCount: num('employeeCount'),
            currency: str('currency'),
            paymentTerms: pt,
            category: cat,
            logoUrl: str('logoUrl'),
            updatedAt: new Date(),
        };
        // Drop undefined keys so $set doesn't blank out existing values
        // when a field wasn't submitted. (`name` is always set above.)
        const accountUpdates = Object.fromEntries(
            Object.entries(accountUpdatesRaw).filter(([, v]) => v !== undefined),
        ) as Partial<CrmAccount>;

        const { db } = await connectToDatabase();
        const result = await db
            .collection('crm_accounts')
            .updateOne(
                {
                    _id: new ObjectId(accountId),
                    userId: new ObjectId(session.user._id),
                },
                { $set: accountUpdates },
            );

        if (result.matchedCount === 0) {
            return { error: 'Account not found or access denied.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'account',
            entityId: accountId,
        });

        revalidateAccountSurfaces(accountId);
        return { message: 'Account updated successfully.', accountId };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── archiveCrmAccount ──────────────────────────────────────────────── */

export async function archiveCrmAccount(
    accountId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    const guard = await requirePermission('crm_account', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!accountId) return { success: false, error: 'Invalid Account ID.' };

    if (useRustCrm()) {
        try {
            // DELETE /v1/crm/accounts/:id is soft-delete (status → archived).
            await accountApi.delete(accountId);
            revalidateAccountSurfaces();
            return { success: true };
        } catch (e) {
            console.error('[archiveCrmAccount] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'account', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(accountId)) {
        return { success: false, error: 'Invalid Account ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_accounts').updateOne(
            { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) },
            { $set: { status: 'archived', updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Account not found or access denied.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'account',
            entityId: accountId,
        });

        revalidateAccountSurfaces();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── unarchiveCrmAccount ────────────────────────────────────────────── */

export async function unarchiveCrmAccount(
    accountId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };

    const guard = await requirePermission('crm_account', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!accountId) return { success: false, error: 'Invalid Account ID.' };

    if (useRustCrm()) {
        try {
            await accountApi.update(accountId, { status: 'active' });
            revalidateAccountSurfaces();
            return { success: true };
        } catch (e) {
            console.error('[unarchiveCrmAccount] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'account', op: 'update', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(accountId)) {
        return { success: false, error: 'Invalid Account ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_accounts').updateOne(
            { _id: new ObjectId(accountId), userId: new ObjectId(session.user._id) },
            { $set: { status: 'active', updatedAt: new Date() } },
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Account not found or access denied.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'restore',
            entityKind: 'account',
            entityId: accountId,
        });

        revalidateAccountSurfaces();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── getAccountRelatedCounts ──────────────────────────────────────────
 * Lightweight aggregate of related-entity counts for the account detail
 * right rail (§1D.2). Returns 0s on any failure so the UI never blocks.
 */

export async function getAccountRelatedCounts(accountId: string): Promise<{
    contacts: number;
    deals: number;
    invoices: number;
    quotations: number;
    tickets: number;
    tasks: number;
}> {
    const zero = {
        contacts: 0,
        deals: 0,
        invoices: 0,
        quotations: 0,
        tickets: 0,
        tasks: 0,
    };

    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(accountId)) return zero;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const accountObjectId = new ObjectId(accountId);

        const baseFilter = (
            field: 'accountId' | 'clientId',
        ): Filter<Document> => ({
            userId: userObjectId,
            [field]: accountObjectId,
        });

        const [contacts, deals, invoices, quotations, tickets, tasks] =
            await Promise.all([
                db
                    .collection('crm_contacts')
                    .countDocuments(baseFilter('accountId')),
                db
                    .collection('crm_deals')
                    .countDocuments(baseFilter('accountId')),
                db
                    .collection('crm_invoices')
                    .countDocuments({
                        userId: userObjectId,
                        $or: [
                            { accountId: accountObjectId },
                            { clientId: accountObjectId },
                        ],
                    }),
                db
                    .collection('crm_quotations')
                    .countDocuments({
                        userId: userObjectId,
                        $or: [
                            { accountId: accountObjectId },
                            { clientId: accountObjectId },
                        ],
                    }),
                db
                    .collection('crm_tickets')
                    .countDocuments(baseFilter('accountId')),
                db
                    .collection('crm_tasks')
                    .countDocuments({
                        userId: userObjectId,
                        $or: [
                            { 'linkedEntity.kind': 'account', 'linkedEntity.id': accountObjectId },
                            { 'linkedEntity.kind': 'account', 'linkedEntity.id': accountId },
                            { accountId: accountObjectId },
                        ],
                    } as Filter<Document>),
            ]);

        return { contacts, deals, invoices, quotations, tickets, tasks };
    } catch (e) {
        console.error('[getAccountRelatedCounts] failed:', e);
        return zero;
    }
}

/* ─── Bulk + KPI actions (referenced by the list page) ─────────── */

export interface CrmAccountKpis {
    total: number;
    active: number;
    strategic: number;
    key: number;
    archived: number;
    /** Sum of `annualRevenue` across non-archived accounts. */
    totalArr: number;
    /** Top 3 industries by account count, non-archived. */
    topIndustries: { industry: string; count: number }[];
}

export async function getCrmAccountKpis(): Promise<CrmAccountKpis> {
    const zero: CrmAccountKpis = {
        total: 0,
        active: 0,
        strategic: 0,
        key: 0,
        archived: 0,
        totalArr: 0,
        topIndustries: [],
    };

    const session = await getSession();
    if (!session?.user) return zero;

    const guard = await requirePermission('crm_account', 'view');
    if (!guard.ok) return zero;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const base: Filter<Document> = { userId: userObjectId };
        const active: Filter<Document> = { ...base, archived: { $ne: true } };

        const [total, activeCount, strategic, key, archived, arrAgg, industriesAgg] =
            await Promise.all([
                db.collection('crm_accounts').countDocuments(base),
                db.collection('crm_accounts').countDocuments(active),
                db.collection('crm_accounts').countDocuments({ ...base, category: 'strategic' }),
                db.collection('crm_accounts').countDocuments({ ...base, category: 'key' }),
                db.collection('crm_accounts').countDocuments({ ...base, archived: true }),
                db
                    .collection('crm_accounts')
                    .aggregate([
                        { $match: active },
                        { $group: { _id: null, sum: { $sum: { $ifNull: ['$annualRevenue', 0] } } } },
                    ])
                    .toArray(),
                db
                    .collection('crm_accounts')
                    .aggregate([
                        { $match: { ...active, industry: { $exists: true, $ne: null } } },
                        { $group: { _id: '$industry', count: { $sum: 1 } } },
                        { $sort: { count: -1 } },
                        { $limit: 3 },
                    ])
                    .toArray(),
            ]);

        const totalArr = Number((arrAgg[0] as { sum?: number } | undefined)?.sum ?? 0) || 0;
        const topIndustries = (industriesAgg as Array<{ _id: unknown; count: number }>)
            .filter((row) => typeof row._id === 'string' && (row._id as string).trim() !== '')
            .map((row) => ({ industry: String(row._id), count: Number(row.count) || 0 }));

        return {
            total,
            active: activeCount,
            strategic,
            key,
            archived,
            totalArr,
            topIndustries,
        };
    } catch (e) {
        console.error('[getCrmAccountKpis] failed:', e);
        return zero;
    }
}

export async function setCrmAccountCategory(
    ids: string[],
    category: 'new' | 'strategic' | 'key' | 'regular',
): Promise<{ success: boolean; modifiedCount?: number; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Unauthorized' };

    const guard = await requirePermission('crm_account', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    const validIds = (ids ?? []).filter((id) => typeof id === 'string' && ObjectId.isValid(id));
    if (validIds.length === 0) {
        return { success: false, error: 'No valid account ids.' };
    }

    // TODO P3: route through rustAccountsApi.setCategory once the Rust endpoint ships.

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        const result = await db.collection('crm_accounts').updateMany(
            { _id: { $in: validIds.map((id) => new ObjectId(id)) }, userId: userObjectId },
            { $set: { category, updatedAt: new Date() } },
        );

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'bulk_set_category',
                entityKind: 'account',
                entityId: validIds[0],
                reason: `bulk:${validIds.length} accounts → ${category}`,
                diff: { category: { after: category } },
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/crm/accounts');
        return { success: true, modifiedCount: result.modifiedCount };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

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

    if (useRustCrm()) {
        try {
            const { id, entity } = await accountApi.create({
                name,
                industry: (formData.get('industry') as string | null) || undefined,
                website: (formData.get('website') as string | null) || undefined,
                phone: (formData.get('phone') as string | null) || undefined,
                country: (formData.get('country') as string | null) || undefined,
                state: (formData.get('state') as string | null) || undefined,
                city: (formData.get('city') as string | null) || undefined,
            });
            revalidateAccountSurfaces();
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
            industry: (formData.get('industry') as string | null) || undefined,
            website: (formData.get('website') as string | null) || undefined,
            phone: (formData.get('phone') as string | null) || undefined,
            country: (formData.get('country') as string | null) || undefined,
            state: (formData.get('state') as string | null) || undefined,
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

    if (useRustCrm()) {
        try {
            await accountApi.update(accountId, {
                name,
                industry: (formData.get('industry') as string | null) || undefined,
                website: (formData.get('website') as string | null) || undefined,
                phone: (formData.get('phone') as string | null) || undefined,
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
        const accountUpdates: Partial<CrmAccount> = {
            name,
            industry: (formData.get('industry') as string | null) || undefined,
            website: (formData.get('website') as string | null) || undefined,
            phone: (formData.get('phone') as string | null) || undefined,
            updatedAt: new Date(),
        };

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

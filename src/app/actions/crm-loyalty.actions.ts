'use server';

/**
 * CRM Loyalty Program server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/loyalty-programs` on the Rust BFF; otherwise legacy
 * direct-Mongo runs. Failures record via `recordRustFallback` and fall
 * through to the legacy path.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmLoyaltyProgramsApi } from '@/lib/rust-client/crm-loyalty-programs';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

export async function getLoyaltyProgramById(
    loyaltyId: string,
): Promise<Record<string, any> | null> {
    if (!loyaltyId || !ObjectId.isValid(loyaltyId)) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmLoyaltyProgramsApi.getById(loyaltyId);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getLoyaltyProgramById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'loyalty_program',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_loyalty_programs').findOne({
            _id: new ObjectId(loyaltyId),
            userId: new ObjectId(session.user._id),
        });
        return doc ? JSON.parse(JSON.stringify(doc)) : null;
    } catch (e) {
        console.error('getLoyaltyProgramById error:', e);
        return null;
    }
}

export async function updateLoyaltyProgram(
    _prev: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_loyalty_program', 'edit');
    if (!guard.ok) return { error: guard.error };

    const loyaltyId = (formData.get('loyaltyId') as string | null) || '';
    if (!loyaltyId || !ObjectId.isValid(loyaltyId)) {
        return { error: 'Invalid loyalty program id.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const name = (formData.get('name') as string | null)?.trim() || '';
        if (!name) return { error: 'Program name is required.' };

        const pointsPerCurrencyUnit = parseFloat(formData.get('pointsPerCurrencyUnit') as string) || 1;
        const redemptionRatio = parseFloat(formData.get('redemptionRatio') as string) || 100;

        const expiryDaysRaw = formData.get('expiryDays') as string;
        const expiryDays = expiryDaysRaw ? parseInt(expiryDaysRaw, 10) : undefined;

        const minRedemptionPointsRaw = formData.get('minRedemptionPoints') as string;
        const minRedemptionPoints = minRedemptionPointsRaw
            ? parseInt(minRedemptionPointsRaw, 10)
            : undefined;

        const welcomeBonusRaw = formData.get('welcomeBonus') as string;
        const welcomeBonus = welcomeBonusRaw ? parseInt(welcomeBonusRaw, 10) : undefined;

        const notes = (formData.get('notes') as string) || undefined;
        const status = (formData.get('status') as string) || undefined;

        const $set: Record<string, any> = {
            name,
            pointsPerCurrencyUnit,
            redemptionRatio,
            updatedAt: new Date(),
        };
        if (expiryDays !== undefined) $set.expiryDays = expiryDays;
        if (minRedemptionPoints !== undefined) $set.minRedemptionPoints = minRedemptionPoints;
        if (welcomeBonus !== undefined) $set.welcomeBonus = welcomeBonus;
        if (notes !== undefined) $set.notes = notes;
        if (status) $set.status = status;

        const result = await db.collection('crm_loyalty_programs').updateOne(
            { _id: new ObjectId(loyaltyId), userId: userObjectId },
            { $set },
        );

        if (result.matchedCount === 0) {
            return { error: 'Loyalty program not found.' };
        }

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'loyalty_program',
                entityId: loyaltyId,
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/sabthrive/loyalty');
        revalidatePath(`/dashboard/sabthrive/loyalty/${loyaltyId}`);
        return { message: 'Loyalty program updated successfully.', id: loyaltyId };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveLoyaltyProgram(
    _prev: any,
    formData: FormData
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_loyalty_program', 'create');
    if (!guard.ok) return { error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);

        const name = formData.get('name') as string;
        if (!name?.trim()) {
            return { error: 'Program name is required.' };
        }

        const pointsPerCurrencyUnit = parseFloat(formData.get('pointsPerCurrencyUnit') as string) || 1;
        const redemptionRatio = parseFloat(formData.get('redemptionRatio') as string) || 100;

        const expiryDaysRaw = formData.get('expiryDays') as string;
        const expiryDays = expiryDaysRaw ? parseInt(expiryDaysRaw, 10) : undefined;

        const minRedemptionPointsRaw = formData.get('minRedemptionPoints') as string;
        const minRedemptionPoints = minRedemptionPointsRaw
            ? parseInt(minRedemptionPointsRaw, 10)
            : undefined;

        const welcomeBonusRaw = formData.get('welcomeBonus') as string;
        const welcomeBonus = welcomeBonusRaw ? parseInt(welcomeBonusRaw, 10) : undefined;

        const notes = (formData.get('notes') as string) || undefined;

        const tiersRaw = formData.get('tiers') as string;
        let tiers: Array<{ name: string; threshold: number; multiplier: number; perks: string }> = [];
        if (tiersRaw) {
            try {
                tiers = JSON.parse(tiersRaw);
            } catch {
                tiers = [];
            }
        }

        const doc: Record<string, any> = {
            userId: userObjectId,
            name: name.trim(),
            pointsPerCurrencyUnit,
            redemptionRatio,
            tiers,
            status: 'active' as const,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        if (expiryDays !== undefined) doc.expiryDays = expiryDays;
        if (minRedemptionPoints !== undefined) doc.minRedemptionPoints = minRedemptionPoints;
        if (welcomeBonus !== undefined) doc.welcomeBonus = welcomeBonus;
        if (notes) doc.notes = notes;

        const result = await db.collection('crm_loyalty_programs').insertOne(doc);

        try {
            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'loyalty_program',
                entityId: result.insertedId.toString(),
            });
        } catch {
            /* non-fatal */
        }

        revalidatePath('/dashboard/sabthrive/loyalty');
        return {
            message: 'Loyalty program created successfully.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ──────────────────────────────────────────────────────────────────────
 * Deep-list additions (KPIs, filtered list, bulk ops).
 *
 * Member/transaction collections are not yet modelled, so KPIs derive
 * from the program documents themselves: total members from a `members`
 * array (when present), points outstanding from a `pointsOutstanding`
 * accumulator, top-tier members from the last tier's `memberCount`
 * (when present), and redemption rate from `redemptionRatio`.
 * ──────────────────────────────────────────────────────────────────── */

interface CrmLoyaltyKpis {
    totalMembers: number;
    pointsOutstanding: number;
    topTierMembers: number;
    redemptionRate: number;
}

interface CrmLoyaltyListFilters {
    search?: string;
    status?: string;
    createdAfter?: Date | string;
    createdBefore?: Date | string;
}

export async function getLoyaltyKpis(): Promise<CrmLoyaltyKpis> {
    const empty: CrmLoyaltyKpis = {
        totalMembers: 0,
        pointsOutstanding: 0,
        topTierMembers: 0,
        redemptionRate: 0,
    };
    const session = await getSession();
    if (!session?.user?._id) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const docs = await db
            .collection('crm_loyalty_programs')
            .find({ userId } as never)
            .toArray();

        let totalMembers = 0;
        let pointsOutstanding = 0;
        let topTierMembers = 0;
        let weightedRedemption = 0;
        let redemptionDenominator = 0;

        for (const d of docs) {
            const members = Array.isArray((d as any).members)
                ? (d as any).members.length
                : Number((d as any).memberCount ?? 0);
            totalMembers += members;

            pointsOutstanding += Number((d as any).pointsOutstanding ?? 0);

            const tiers = Array.isArray((d as any).tiers) ? (d as any).tiers : [];
            const top = tiers[tiers.length - 1];
            if (top && typeof top.memberCount === 'number') {
                topTierMembers += Number(top.memberCount);
            }

            const ratio = Number((d as any).redemptionRatio ?? 0);
            if (ratio > 0) {
                weightedRedemption += ratio;
                redemptionDenominator += 1;
            }
        }

        const redemptionRate =
            redemptionDenominator > 0
                ? Math.round((weightedRedemption / redemptionDenominator) * 10) / 10
                : 0;

        return { totalMembers, pointsOutstanding, topTierMembers, redemptionRate };
    } catch (e) {
        console.error('[getLoyaltyKpis] failed:', e);
        return empty;
    }
}

export async function listLoyaltyPrograms(
    page = 1,
    limit = 20,
    filters: CrmLoyaltyListFilters = {},
): Promise<{ rows: Array<Record<string, unknown>>; total: number }> {
    const session = await getSession();
    if (!session?.user?._id) return { rows: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const query: Record<string, unknown> = { userId };

        if (filters.status && filters.status !== 'all') query.status = filters.status;
        if (filters.search) {
            const safe = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.name = { $regex: safe, $options: 'i' };
        }
        if (filters.createdAfter || filters.createdBefore) {
            const range: Record<string, Date> = {};
            if (filters.createdAfter) range.$gte = new Date(filters.createdAfter);
            if (filters.createdBefore) range.$lte = new Date(filters.createdBefore);
            query.createdAt = range;
        }

        const skip = Math.max(0, (page - 1) * limit);
        const [docs, total] = await Promise.all([
            db
                .collection('crm_loyalty_programs')
                .find(query as never)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_loyalty_programs').countDocuments(query as never),
        ]);

        return { rows: JSON.parse(JSON.stringify(docs)), total };
    } catch (e) {
        console.error('[listLoyaltyPrograms] failed:', e);
        return { rows: [], total: 0 };
    }
}

export async function bulkLoyaltyAction(
    ids: string[],
    op: 'delete' | 'status',
    payload?: string,
): Promise<{ success: boolean; processed: number; error?: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { success: false, processed: 0, error: 'Unauthorized.' };

    const guard = await requirePermission(
        'crm_loyalty_program',
        op === 'delete' ? 'delete' : 'edit',
    );
    if (!guard.ok) return { success: false, processed: 0, error: guard.error };

    const valid = (ids ?? []).filter((id) => typeof id === 'string' && ObjectId.isValid(id));
    if (valid.length === 0) {
        return { success: false, processed: 0, error: 'No valid programs selected.' };
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const oids = valid.map((id) => new ObjectId(id));
        const baseFilter = { _id: { $in: oids }, userId };

        let processed = 0;
        if (op === 'delete') {
            const r = await db.collection('crm_loyalty_programs').deleteMany(baseFilter);
            processed = r.deletedCount ?? 0;
        } else {
            const status = String(payload ?? '').trim();
            if (!status) {
                return { success: false, processed: 0, error: 'Status is required.' };
            }
            const r = await db.collection('crm_loyalty_programs').updateMany(baseFilter, {
                $set: { status, updatedAt: new Date() },
            });
            processed = r.modifiedCount ?? 0;
        }

        for (const id of valid) {
            try {
                await writeAuditEntry({
                    tenantUserId: String(session.user._id),
                    actorId: String(session.user._id),
                    action: op === 'delete' ? 'delete' : 'status_change',
                    entityKind: 'loyalty_program',
                    entityId: id,
                    reason: payload ? `bulk:${payload}` : `bulk:${op}`,
                });
            } catch {
                /* non-fatal */
            }
        }

        revalidatePath('/dashboard/sabthrive/loyalty');
        return { success: true, processed };
    } catch (e) {
        return { success: false, processed: 0, error: getErrorMessage(e) };
    }
}

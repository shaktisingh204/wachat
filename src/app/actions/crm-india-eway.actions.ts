'use server';

/**
 * CRM India e-way-bill server actions (§6.10).
 *
 * Persists each generated bill on a new `crm_eway_bills` collection
 * keyed on `(userId, ewbNo)` with a `linkedInvoiceId` ref back to the
 * source invoice. Generation is the only action that creates rows; the
 * rest mutate state on the existing row plus append a history entry.
 *
 * Gated `requirePermission('crm_invoice', 'edit')` for mutating ops,
 * `'view'` for reads — we piggyback on the invoice permission because
 * e-way bills are an invoice-adjacent concept.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { requirePermission } from '@/lib/rbac-server';
import { getErrorMessage } from '@/lib/utils';
import {
    getEWayBillProvider,
    type EWayBillRequest,
} from '@/lib/india-tax/eway-bill-providers';
import {
    getTenantEwbCredentials,
    getTenantProviderIds,
} from '@/lib/india-tax/credentials';

// ──────────────────────────────────────────────────────────────────
// Stored shape
// ──────────────────────────────────────────────────────────────────

interface StoredEWayBill {
    _id?: ObjectId;
    userId: ObjectId;
    /** 12-digit EWB number — unique within tenant. */
    ewbNo: string;
    /** Source invoice. */
    linkedInvoiceId?: ObjectId;
    ewbDate: Date;
    validUpto: Date;
    fromGstin: string;
    toGstin?: string;
    fromPincode: string;
    toPincode: string;
    fromStateCode: string;
    toStateCode: string;
    totalValue: number;
    distanceKm: number;
    transporterId?: string;
    vehicleNumber?: string;
    transactionType?: number;
    provider: string;
    status: 'active' | 'cancelled' | 'expired';
    cancelReason?: string;
    cancelledAt?: Date;
    /** Append-only history of vehicle updates + validity extensions. */
    history?: Array<{
        at: Date;
        kind: 'generated' | 'cancelled' | 'updateVehicle' | 'extendValidity';
        by?: string;
        reason?: string;
        details?: Record<string, unknown>;
    }>;
    rawResponse?: unknown;
    createdAt: Date;
    updatedAt: Date;
}

interface EWayBillSummary {
    _id: string;
    ewbNo: string;
    linkedInvoiceId?: string;
    ewbDate: string;
    validUpto: string;
    fromGstin: string;
    toGstin?: string;
    totalValue: number;
    distanceKm: number;
    vehicleNumber?: string;
    transporterId?: string;
    provider: string;
    status: 'active' | 'cancelled' | 'expired';
}

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function fail(error: string): { ok: false; error: string } {
    return { ok: false, error };
}

function toSummary(doc: WithId<StoredEWayBill>): EWayBillSummary {
    return {
        _id: String(doc._id),
        ewbNo: doc.ewbNo,
        linkedInvoiceId: doc.linkedInvoiceId ? String(doc.linkedInvoiceId) : undefined,
        ewbDate: (doc.ewbDate instanceof Date ? doc.ewbDate : new Date(doc.ewbDate)).toISOString(),
        validUpto: (doc.validUpto instanceof Date ? doc.validUpto : new Date(doc.validUpto)).toISOString(),
        fromGstin: doc.fromGstin,
        toGstin: doc.toGstin,
        totalValue: doc.totalValue,
        distanceKm: doc.distanceKm,
        vehicleNumber: doc.vehicleNumber,
        transporterId: doc.transporterId,
        provider: doc.provider,
        status: doc.status,
    };
}

/** Lazy "is expired" reconciliation — bills past validUpto get reported
 *  as `expired` without an active mutation. */
function liveStatus(doc: StoredEWayBill): StoredEWayBill['status'] {
    if (doc.status === 'cancelled') return 'cancelled';
    const validUpto = doc.validUpto instanceof Date ? doc.validUpto : new Date(doc.validUpto);
    if (validUpto.getTime() < Date.now()) return 'expired';
    return 'active';
}

interface GenerateEWayBillInput {
    invoiceId?: string;
    fromGstin: string;
    toGstin?: string;
    fromPincode: string;
    fromStateCode: string;
    toPincode: string;
    toStateCode: string;
    totalValue: number;
    distanceKm: number;
    transporterId?: string;
    vehicleNumber?: string;
    transactionType?: number;
}

// ──────────────────────────────────────────────────────────────────
// Public actions
// ──────────────────────────────────────────────────────────────────

export async function generateEWayBill(
    input: GenerateEWayBillInput,
): Promise<
    | { ok: true; data: EWayBillSummary }
    | { ok: false; error: string }
> {
    const session = await getSession();
    if (!session?.user) return fail('Authentication required.');

    const guard = await requirePermission('crm_invoice', 'edit');
    if (!guard.ok) return fail(guard.error);

    try {
        const tenantUserId = String(session.user._id);
        if (!input.fromGstin) return fail('Missing fromGstin.');
        if (!input.totalValue || input.totalValue <= 0) return fail('Missing totalValue.');
        if (!input.distanceKm || input.distanceKm <= 0) return fail('Missing distanceKm.');

        const providerIds = await getTenantProviderIds(tenantUserId);
        const credentials = await getTenantEwbCredentials(tenantUserId);
        const provider = getEWayBillProvider(providerIds.eWayBill);

        const req: EWayBillRequest = {
            invoiceId: input.invoiceId,
            fromGstin: input.fromGstin,
            toGstin: input.toGstin,
            fromPincode: input.fromPincode,
            fromStateCode: input.fromStateCode,
            toPincode: input.toPincode,
            toStateCode: input.toStateCode,
            totalValue: input.totalValue,
            distanceKm: input.distanceKm,
            transporterId: input.transporterId,
            vehicleNumber: input.vehicleNumber,
            transactionType: input.transactionType,
        };

        let resp;
        try {
            resp = await provider.generate(req, credentials);
        } catch (e: any) {
            return fail(getErrorMessage(e));
        }
        if (resp.status !== 'success') return fail('Provider returned failure.');

        const now = new Date();
        const doc: StoredEWayBill = {
            userId: new ObjectId(tenantUserId),
            ewbNo: resp.ewbNo,
            linkedInvoiceId:
                input.invoiceId && ObjectId.isValid(input.invoiceId)
                    ? new ObjectId(input.invoiceId)
                    : undefined,
            ewbDate: new Date(resp.ewbDate),
            validUpto: new Date(resp.validUpto),
            fromGstin: input.fromGstin,
            toGstin: input.toGstin,
            fromPincode: input.fromPincode,
            toPincode: input.toPincode,
            fromStateCode: input.fromStateCode,
            toStateCode: input.toStateCode,
            totalValue: input.totalValue,
            distanceKm: input.distanceKm,
            transporterId: input.transporterId,
            vehicleNumber: input.vehicleNumber,
            transactionType: input.transactionType,
            provider: provider.id,
            status: 'active',
            history: [
                {
                    at: now,
                    kind: 'generated',
                    by: tenantUserId,
                    details: { via: provider.id },
                },
            ],
            rawResponse: resp.rawResponse,
            createdAt: now,
            updatedAt: now,
        };

        const { db } = await connectToDatabase();
        const insert = await db.collection<StoredEWayBill>('crm_eway_bills').insertOne(doc);
        const persisted: WithId<StoredEWayBill> = { ...doc, _id: insert.insertedId };

        await writeAuditEntry({
            tenantUserId,
            action: 'create',
            entityKind: 'eway_bill',
            entityId: String(insert.insertedId),
            reason: `EWB ${resp.ewbNo} via ${provider.id}`,
        });

        revalidatePath('/dashboard/crm/tax/eway-bills');
        return { ok: true, data: toSummary(persisted) };
    } catch (e: any) {
        console.error('[generateEWayBill] failed:', e);
        return fail(getErrorMessage(e));
    }
}

export async function listEWayBills(): Promise<EWayBillSummary[]> {
    const session = await getSession();
    if (!session?.user) return [];
    const guard = await requirePermission('crm_invoice', 'view');
    if (!guard.ok) return [];

    try {
        const tenantUserId = String(session.user._id);
        const { db } = await connectToDatabase();
        const rows = await db
            .collection<StoredEWayBill>('crm_eway_bills')
            .find({ userId: new ObjectId(tenantUserId) })
            .sort({ createdAt: -1 })
            .limit(200)
            .toArray();
        return rows.map((r) => toSummary({ ...r, status: liveStatus(r) }));
    } catch (e) {
        console.error('[listEWayBills] failed:', e);
        return [];
    }
}

export async function getEWayBill(id: string): Promise<WithId<StoredEWayBill> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    const guard = await requirePermission('crm_invoice', 'view');
    if (!guard.ok) return null;
    if (!ObjectId.isValid(id)) return null;

    try {
        const tenantUserId = String(session.user._id);
        const { db } = await connectToDatabase();
        const doc = await db.collection<StoredEWayBill>('crm_eway_bills').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(tenantUserId),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify({ ...doc, status: liveStatus(doc) }));
    } catch (e) {
        console.error('[getEWayBill] failed:', e);
        return null;
    }
}

export async function cancelEWayBill(
    id: string,
    reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return fail('Authentication required.');
    const guard = await requirePermission('crm_invoice', 'edit');
    if (!guard.ok) return fail(guard.error);
    if (!ObjectId.isValid(id)) return fail('Invalid id.');

    try {
        const tenantUserId = String(session.user._id);
        const { db } = await connectToDatabase();
        const existing = await db.collection<StoredEWayBill>('crm_eway_bills').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(tenantUserId),
        });
        if (!existing) return fail('E-way bill not found.');
        if (existing.status === 'cancelled') return fail('Already cancelled.');

        const credentials = await getTenantEwbCredentials(tenantUserId);
        const provider = getEWayBillProvider(existing.provider);
        try {
            const r = await provider.cancel(existing.ewbNo, reason, credentials);
            if (!r.ok) return fail(r.error || 'Cancel failed at provider.');
        } catch (e: any) {
            return fail(getErrorMessage(e));
        }

        const now = new Date();
        await db.collection<StoredEWayBill>('crm_eway_bills').updateOne(
            { _id: existing._id },
            {
                $set: {
                    status: 'cancelled',
                    cancelReason: reason,
                    cancelledAt: now,
                    updatedAt: now,
                },
                $push: {
                    history: { at: now, kind: 'cancelled', by: tenantUserId, reason },
                },
            },
        );

        await writeAuditEntry({
            tenantUserId,
            action: 'void',
            entityKind: 'eway_bill',
            entityId: id,
            reason,
        });

        revalidatePath('/dashboard/crm/tax/eway-bills');
        revalidatePath(`/dashboard/crm/tax/eway-bills/${id}`);
        return { ok: true };
    } catch (e: any) {
        console.error('[cancelEWayBill] failed:', e);
        return fail(getErrorMessage(e));
    }
}

export async function updateEWayBillVehicle(
    id: string,
    vehicleNumber: string,
    reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return fail('Authentication required.');
    const guard = await requirePermission('crm_invoice', 'edit');
    if (!guard.ok) return fail(guard.error);
    if (!ObjectId.isValid(id)) return fail('Invalid id.');

    try {
        const tenantUserId = String(session.user._id);
        const { db } = await connectToDatabase();
        const existing = await db.collection<StoredEWayBill>('crm_eway_bills').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(tenantUserId),
        });
        if (!existing) return fail('E-way bill not found.');
        if (existing.status === 'cancelled') return fail('Cannot update a cancelled bill.');

        const credentials = await getTenantEwbCredentials(tenantUserId);
        const provider = getEWayBillProvider(existing.provider);
        try {
            const r = await provider.updateVehicle(
                { ewbNo: existing.ewbNo, vehicleNumber, reason },
                credentials,
            );
            if (!r.ok) return fail(r.error || 'Update vehicle failed.');
        } catch (e: any) {
            return fail(getErrorMessage(e));
        }

        const now = new Date();
        await db.collection<StoredEWayBill>('crm_eway_bills').updateOne(
            { _id: existing._id },
            {
                $set: { vehicleNumber, updatedAt: now },
                $push: {
                    history: {
                        at: now,
                        kind: 'updateVehicle',
                        by: tenantUserId,
                        reason,
                        details: { vehicleNumber, previousVehicleNumber: existing.vehicleNumber },
                    },
                },
            },
        );

        await writeAuditEntry({
            tenantUserId,
            action: 'update',
            entityKind: 'eway_bill',
            entityId: id,
            reason: `Vehicle → ${vehicleNumber}`,
        });

        revalidatePath('/dashboard/crm/tax/eway-bills');
        revalidatePath(`/dashboard/crm/tax/eway-bills/${id}`);
        return { ok: true };
    } catch (e: any) {
        console.error('[updateEWayBillVehicle] failed:', e);
        return fail(getErrorMessage(e));
    }
}

export async function extendEWayBillValidity(
    id: string,
    additionalKm: number,
    reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user) return fail('Authentication required.');
    const guard = await requirePermission('crm_invoice', 'edit');
    if (!guard.ok) return fail(guard.error);
    if (!ObjectId.isValid(id)) return fail('Invalid id.');
    if (!Number.isFinite(additionalKm) || additionalKm <= 0) {
        return fail('additionalKm must be > 0.');
    }

    try {
        const tenantUserId = String(session.user._id);
        const { db } = await connectToDatabase();
        const existing = await db.collection<StoredEWayBill>('crm_eway_bills').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(tenantUserId),
        });
        if (!existing) return fail('E-way bill not found.');
        if (existing.status === 'cancelled') return fail('Cannot extend a cancelled bill.');

        const credentials = await getTenantEwbCredentials(tenantUserId);
        const provider = getEWayBillProvider(existing.provider);
        try {
            const r = await provider.extendValidity(
                { ewbNo: existing.ewbNo, additionalKm, reason },
                credentials,
            );
            if (!r.ok) return fail(r.error || 'Extend validity failed.');
        } catch (e: any) {
            return fail(getErrorMessage(e));
        }

        // 1 day per 200km, min 1 day. Extend from the *current* validUpto.
        const days = Math.max(1, Math.ceil(additionalKm / 200));
        const previousValid =
            existing.validUpto instanceof Date ? existing.validUpto : new Date(existing.validUpto);
        const newValid = new Date(previousValid.getTime());
        newValid.setDate(newValid.getDate() + days);

        const now = new Date();
        await db.collection<StoredEWayBill>('crm_eway_bills').updateOne(
            { _id: existing._id },
            {
                $set: {
                    validUpto: newValid,
                    distanceKm: existing.distanceKm + additionalKm,
                    updatedAt: now,
                },
                $push: {
                    history: {
                        at: now,
                        kind: 'extendValidity',
                        by: tenantUserId,
                        reason,
                        details: { additionalKm, addedDays: days, newValidUpto: newValid.toISOString() },
                    },
                },
            },
        );

        await writeAuditEntry({
            tenantUserId,
            action: 'update',
            entityKind: 'eway_bill',
            entityId: id,
            reason: `Validity extended by ${days}d (+${additionalKm}km)`,
        });

        revalidatePath('/dashboard/crm/tax/eway-bills');
        revalidatePath(`/dashboard/crm/tax/eway-bills/${id}`);
        return { ok: true };
    } catch (e: any) {
        console.error('[extendEWayBillValidity] failed:', e);
        return fail(getErrorMessage(e));
    }
}

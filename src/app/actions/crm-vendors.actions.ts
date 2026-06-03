'use server';

/**
 * CRM Vendor server actions.
 *
 * **Dual implementation:**
 *  - When `USE_RUST_CRM === 'true'`, every action delegates to the Rust BFF
 *    (`/v1/crm/vendors`) via `src/lib/rust-client/crm-vendors.ts`.
 *  - Otherwise (default), the legacy direct-Mongo path runs.
 *
 * Export shapes are identical across both paths so the existing pages at
 * `/dashboard/crm/purchases/vendors/**` and `/dashboard/crm/inventory/vendors/**`
 * keep working without changes.
 *
 * `getCrmVendorTypes` / `saveCrmVendorType` operate on the separate
 * `crm_vendor_types` collection — out of scope for the Rust vendor entity
 * port, so they remain legacy-only.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import type { BankAccountDetails, CrmVendor, CrmVendorType } from '@/lib/definitions';
import { vendorApi, type CrmVendorDoc } from '@/lib/rust-client/crm-vendors';
import { crmVendorTypesApi } from '@/lib/rust-client/crm-vendor-types';
import { RustApiError } from '@/lib/rust-client/fetcher';
import { getErrorMessage } from '@/lib/utils';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/** Re-revalidate every dashboard route that lists or detail-renders vendors. */
function revalidateVendorSurfaces(vendorId?: string): void {
    revalidatePath('/dashboard/crm/purchases/vendors');
    revalidatePath('/dashboard/crm/purchases/orders');
    revalidatePath('/dashboard/crm/inventory/vendors');
    if (vendorId) {
        revalidatePath(`/dashboard/crm/purchases/vendors/${vendorId}`);
    }
}

/* ─── Rust-shape → legacy TS-shape adapter ────────────────────────────── */

function rustDocToLegacy(doc: CrmVendorDoc): WithId<CrmVendor> {
    return {
        ...(doc as unknown as WithId<CrmVendor>),
        _id: doc._id ? (doc._id as unknown as ObjectId) : (undefined as unknown as ObjectId),
        userId: doc.userId as unknown as ObjectId,
        industryId: doc.industryId
            ? (doc.industryId as unknown as ObjectId)
            : (undefined as unknown as ObjectId | undefined),
        createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : (new Date() as Date),
    };
}

/* ─── getCrmVendors ──────────────────────────────────────────────────── */

export async function getCrmVendors(): Promise<WithId<CrmVendor>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    if (useRustCrm()) {
        try {
            // Single page big enough for the legacy "give me everything" semantics.
            const result = await vendorApi.list({ page: 0, limit: 100 });
            return result.items.map(rustDocToLegacy);
        } catch (e) {
            console.error('[getCrmVendors] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'vendor', op: 'list', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    try {
        const { db } = await connectToDatabase();
        const vendors = await db
            .collection<CrmVendor>('crm_vendors')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(vendors));
    } catch (e) {
        console.error('Failed to fetch CRM vendors:', e);
        return [];
    }
}

/* ─── getCrmVendorById ───────────────────────────────────────────────── */

export async function getCrmVendorById(vendorId: string): Promise<WithId<CrmVendor> | null> {
    if (!vendorId) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await vendorApi.getById(vendorId);
            return doc ? rustDocToLegacy(doc) : null;
        } catch (e) {
            console.error('[getCrmVendorById] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'vendor', op: 'get', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(vendorId)) return null;
    try {
        const { db } = await connectToDatabase();
        const v = await db.collection<CrmVendor>('crm_vendors').findOne({
            _id: new ObjectId(vendorId),
            userId: new ObjectId(session.user._id),
        });
        if (!v) return null;
        return JSON.parse(JSON.stringify(v));
    } catch (e) {
        console.error('Failed to fetch vendor by id:', e);
        return null;
    }
}

/* ─── saveCrmVendor ──────────────────────────────────────────────────── */

/** Parse the FormData fields into a shape both Rust + Mongo paths can consume. */
function parseAttachments(raw: string | null): string[] | undefined {
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            const urls = parsed.filter((u): u is string => typeof u === 'string' && !!u);
            return urls.length ? urls : undefined;
        }
    } catch {
        // ignore malformed JSON
    }
    return undefined;
}

function parseBankAccountDetails(raw: string | null): BankAccountDetails | undefined {
    if (!raw) return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as BankAccountDetails;
        }
    } catch {
        // ignore malformed JSON
    }
    return undefined;
}

export async function saveCrmVendor(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; newVendor?: any }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const vendorId = formData.get('vendorId') as string | null;
    const isEditing = !!vendorId;

    const guard = await requirePermission('crm_vendor', isEditing ? 'edit' : 'create');
    if (!guard.ok) return { error: guard.error };

    const name = (formData.get('name') as string | null) || '';
    if (!name.trim()) {
        return { error: 'Vendor name is required.' };
    }

    const country = (formData.get('country') as string | null) || '';
    if (!country.trim()) {
        return { error: 'Country is required.' };
    }

    const logoUrlRaw = formData.get('logoUrl') as string | null;
    const attachmentsRaw = formData.get('attachmentUrls') as string | null;
    const bankRaw = formData.get('bankAccountDetails') as string | null;

    const attachments = parseAttachments(attachmentsRaw);
    const bankAccountDetails = parseBankAccountDetails(bankRaw);
    const industryIdStr = (formData.get('industryId') as string | null) || undefined;

    // MSME / IT §43B(h) compliance fields (§6.10). All additive — legacy
    // vendor rows without these stay non-MSME on read.
    const isMsmeRaw = (formData.get('isMsme') as string | null) ?? '';
    const isMsme = isMsmeRaw === 'true' || isMsmeRaw === 'on' || isMsmeRaw === '1';
    const udyamRegistrationNumber =
        ((formData.get('udyamRegistrationNumber') as string | null) || '').trim() || undefined;
    const msmeCategoryRaw =
        ((formData.get('msmeCategory') as string | null) || '').trim() || undefined;
    const msmeCategory: 'Micro' | 'Small' | 'Medium' | undefined =
        msmeCategoryRaw === 'Micro' || msmeCategoryRaw === 'Small' || msmeCategoryRaw === 'Medium'
            ? msmeCategoryRaw
            : undefined;
    const msmeTermsRaw = (formData.get('msmePaymentTermsDays') as string | null) || '';
    const msmePaymentTermsDaysParsed = Number(msmeTermsRaw);
    const msmePaymentTermsDays =
        Number.isFinite(msmePaymentTermsDaysParsed) && msmePaymentTermsDaysParsed > 0
            ? Math.min(180, Math.floor(msmePaymentTermsDaysParsed))
            : undefined;

    if (useRustCrm()) {
        try {
            // Shape shared by create + update so both branches stay aligned.
            const payload = {
                name,
                displayName: (formData.get('displayName') as string | null) || undefined,
                industryId: industryIdStr || undefined,
                email: (formData.get('email') as string | null) || undefined,
                phone: (formData.get('phone') as string | null) || undefined,
                country: (formData.get('country') as string | null) || undefined,
                state: (formData.get('state') as string | null) || undefined,
                city: (formData.get('city') as string | null) || undefined,
                pincode: (formData.get('pincode') as string | null) || undefined,
                street: (formData.get('street') as string | null) || undefined,
                gstin: (formData.get('gstin') as string | null) || undefined,
                pan: (formData.get('pan') as string | null) || undefined,
                panName: (formData.get('panName') as string | null) || undefined,
                vendorType: (formData.get('vendorType') as string | null) || undefined,
                taxTreatment: (formData.get('taxTreatment') as string | null) || undefined,
                subject: (formData.get('subject') as string | null) || undefined,
                bankAccountDetails,
                logoUrl: logoUrlRaw || undefined,
                attachments,
                // MSME compliance — Rust BFF accepts extra fields and
                // round-trips them; if/when the Rust DTO catches up
                // these will be typed properly.
                isMsme: isMsme || undefined,
                udyamRegistrationNumber,
                msmeCategory,
                msmePaymentTermsDays,
            };

            if (isEditing && vendorId) {
                const updated = await vendorApi.update(vendorId, payload);
                revalidateVendorSurfaces(vendorId);
                return {
                    message: `Vendor "${name}" saved successfully!`,
                    newVendor: rustDocToLegacy(updated),
                };
            }

            const { id, entity } = await vendorApi.create(payload);
            revalidateVendorSurfaces();
            return {
                message: `Vendor "${name}" saved successfully!`,
                newVendor: entity
                    ? { ...rustDocToLegacy(entity), _id: id }
                    : { _id: id, name },
            };
        } catch (e) {
            const msg = e instanceof RustApiError ? e.message : getErrorMessage(e);
            console.error('[saveCrmVendor] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'vendor', op: isEditing ? 'update' : 'create', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through to legacy on failure so users aren't blocked
            void msg;
        }
    }

    try {
        const vendorData: Partial<Omit<CrmVendor, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name,
            industryId:
                industryIdStr && ObjectId.isValid(industryIdStr)
                    ? new ObjectId(industryIdStr)
                    : undefined,
            email: (formData.get('email') as string | null) || undefined,
            phone: (formData.get('phone') as string | null) || undefined,
            country: (formData.get('country') as string | null) || undefined,
            state: (formData.get('state') as string | null) || undefined,
            city: (formData.get('city') as string | null) || undefined,
            pincode: (formData.get('pincode') as string | null) || undefined,
            street: (formData.get('street') as string | null) || undefined,
            gstin: (formData.get('gstin') as string | null) || undefined,
            pan: (formData.get('pan') as string | null) || undefined,
            panName: (formData.get('panName') as string | null) || undefined,
            vendorType:
                (formData.get('vendorType') as CrmVendor['vendorType']) || undefined,
            taxTreatment: (formData.get('taxTreatment') as string | null) || undefined,
            displayName: (formData.get('displayName') as string | null) || undefined,
            subject: (formData.get('subject') as string | null) || undefined,
            bankAccountDetails: bankAccountDetails ?? ({} as BankAccountDetails),
            logoUrl: logoUrlRaw || undefined,
            attachments: attachments && attachments.length ? attachments : undefined,
            // MSME compliance — see §6.10 in CRM_REBUILD_PLAN.md.
            isMsme: isMsme || undefined,
            udyamRegistrationNumber,
            msmeCategory,
            msmePaymentTermsDays,
            updatedAt: new Date(),
        };

        let savedId: ObjectId | null = isEditing && vendorId ? new ObjectId(vendorId) : null;

        const { db } = await connectToDatabase();
        if (isEditing && vendorId && ObjectId.isValid(vendorId)) {
            await db
                .collection('crm_vendors')
                .updateOne(
                    { _id: new ObjectId(vendorId), userId: new ObjectId(session.user._id) },
                    { $set: vendorData },
                );

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'vendor',
                entityId: vendorId,
            });
        } else {
            vendorData.createdAt = new Date();
            const result = await db.collection('crm_vendors').insertOne(vendorData as CrmVendor);
            savedId = result.insertedId;

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'create',
                entityKind: 'vendor',
                entityId: String(result.insertedId),
            });
        }

        const savedVendor = { ...vendorData, _id: savedId };

        revalidateVendorSurfaces(savedId ? String(savedId) : undefined);

        return {
            message: `Vendor "${name}" saved successfully!`,
            newVendor: JSON.parse(JSON.stringify(savedVendor)),
        };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── deleteCrmVendor ────────────────────────────────────────────────── */

export async function deleteCrmVendor(
    vendorId: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_vendor', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!vendorId) return { success: false, error: 'Invalid Vendor ID.' };

    if (useRustCrm()) {
        try {
            // DELETE /v1/crm/vendors/:id is hard-delete (no status column).
            await vendorApi.delete(vendorId);
            revalidateVendorSurfaces();
            return { success: true };
        } catch (e) {
            console.error('[deleteCrmVendor] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'vendor', op: 'delete', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
            // fall through
        }
    }

    if (!ObjectId.isValid(vendorId)) {
        return { success: false, error: 'Invalid Vendor ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const vendor = await db
            .collection('crm_vendors')
            .findOne({ _id: new ObjectId(vendorId), userId: new ObjectId(session.user._id) });
        if (!vendor) return { success: false, error: 'Vendor not found or you do not have permission.' };

        await db.collection('crm_vendors').deleteOne({ _id: new ObjectId(vendorId) });

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'delete',
            entityKind: 'vendor',
            entityId: vendorId,
        });

        revalidateVendorSurfaces();
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ─── getCrmVendorTypes (legacy-only — different collection) ─────────── */

export async function getCrmVendorTypes(): Promise<WithId<CrmVendorType>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const types = await db
            .collection('crm_vendor_types')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();

        const defaultTypes = [
            'Goods Supplier', 'Service Provider', 'Contractor', 'Freelancer', 'Consultant',
            'Manufacturer', 'Distributor', 'Wholesaler', 'Retailer', 'Dropshipper',
            'Raw Materials Supplier', 'Office Supplies Provider', 'Logistics Partner', 'Transport & Shipping',
            'Utilities Provider', 'Rent/Lease Provider', 'Real Estate Agent', 'Facilities Management',
            'Legal Counsel', 'Marketing Agency', 'Advertising Agency', 'PR Firm', 'Media Production',
            'Software Vendor (SaaS)', 'Hardware Supplier', 'IT Support Services', 'Cloud Infrastructure',
            'Cyber Security Firm', 'Web Development Agency', 'Data Analytics Provider',
            'Maintenance & Repair Services', 'Cleaning Services', 'Security Services', 'Waste Management',
            'Event Planner', 'Catering Service', 'Travel Agency', 'Accommodation/Hotel',
            'Training & Coaching', 'HR & Recruitment Agency', 'Payroll Services', 'Staffing Firm',
            'Accounting Firm', 'Tax Consultant', 'Audit Services', 'Insurance Provider',
            'Bank/Financial Institution', 'Investment Advisor', 'Payment Gateway Provider',
            'Printing & Publishing', 'Packaging Supplier', 'Telecommunications', 'Internet Service Provider (ISP)',
            'Construction Firm', 'Engineering Consultant', 'Architect', 'Sub-contractor', 'Affiliate Partner',
            'Other',
        ];

        const existingNames = new Set(types.map((t: any) => t.name.toLowerCase()));

        const defaultTypeObjects = defaultTypes
            .filter((name) => !existingNames.has(name.toLowerCase()))
            .map((name) => ({
                _id: new ObjectId().toString(),
                userId: session.user._id,
                name,
                description: 'Default Vendor Type',
                updatedAt: new Date(),
                createdAt: new Date(),
                isDefault: true,
            }));

        const allTypes = [...types, ...defaultTypeObjects].sort((a: any, b: any) =>
            a.name.localeCompare(b.name),
        );
        return JSON.parse(JSON.stringify(allTypes));
    } catch (e) {
        return [];
    }
}

/* ─── getVendorTypeById ──────────────────────────────────────────────── */

/**
 * Fetch a single vendor-type master row scoped to the current user.
 *
 * Dual-impl: when `USE_RUST_CRM === 'true'` we go through the Rust BFF
 * (`/v1/crm/vendor-types/:id`); on failure or when the flag is off we
 * fall back to the direct Mongo read on `crm_vendor_types`.
 */
export async function getVendorTypeById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    if (!id) return null;

    const session = await getSession();
    if (!session?.user) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmVendorTypesApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getVendorTypeById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'vendor_type',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
            // fall through
        }
    }

    if (!ObjectId.isValid(id)) return null;
    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_vendor_types').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch vendor type by id:', e);
        return null;
    }
}

/* ─── saveCrmVendorType (legacy-only — different collection) ─────────── */

export async function saveCrmVendorType(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string; topic?: WithId<CrmVendorType> }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    try {
        const { db } = await connectToDatabase();
        const name = formData.get('name') as string;
        if (!name) return { error: 'Name is required' };

        const typeData = {
            userId: new ObjectId(session.user._id),
            name,
            description: formData.get('description') as string,
            updatedAt: new Date(),
        };

        let result;
        const id = formData.get('_id') as string;
        if (id) {
            await db
                .collection('crm_vendor_types')
                .updateOne({ _id: new ObjectId(id) }, { $set: typeData });
            result = { ...typeData, _id: new ObjectId(id) };
        } else {
            const res = await db
                .collection('crm_vendor_types')
                .insertOne({ ...typeData, createdAt: new Date() });
            result = { ...typeData, createdAt: new Date(), _id: res.insertedId };
        }

        revalidatePath('/dashboard/crm/purchases/vendors');
        return { message: 'Vendor Type saved.', topic: JSON.parse(JSON.stringify(result)) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/* ─── Vendor KPIs (list page strip) ──────────────────────────────── */

interface CrmVendorKpis {
    /** Total vendors for the tenant (all types). */
    total: number;
    /** Active vendors — at least one purchase order in the last 12 months. */
    active: number;
    /** Total purchase order value across all vendors, all-time, INR (or mixed currency sum). */
    totalPurchaseValue: number;
    /** Top vendor by total PO value. */
    topVendor: { name: string; value: number } | null;
    /** Currency hint for the totals — best-effort, defaults to INR. */
    currency: string;
}

/**
 * Aggregate KPI counts for the vendors list page strip.
 * Tenant-scoped via `getSession()`. Returns zero-filled object on error
 * so callers never need to handle a thrown exception.
 */
export async function getCrmVendorKpis(): Promise<CrmVendorKpis> {
    const empty: CrmVendorKpis = {
        total: 0,
        active: 0,
        totalPurchaseValue: 0,
        topVendor: null,
        currency: 'INR',
    };
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

        const [total, perVendorAgg, activeIdsAgg] = await Promise.all([
            db
                .collection('crm_vendors')
                .countDocuments({ userId } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_purchase_orders')
                .aggregate([
                    { $match: { userId } },
                    {
                        $group: {
                            _id: '$vendorId',
                            total: { $sum: { $ifNull: ['$total', 0] } },
                        },
                    },
                    { $sort: { total: -1 } },
                    { $limit: 25 },
                ])
                .toArray()
                .catch(() => [] as Array<{ _id: unknown; total: number }>),
            db
                .collection('crm_purchase_orders')
                .aggregate([
                    {
                        $match: {
                            userId,
                            orderDate: { $gte: twelveMonthsAgo },
                        },
                    },
                    { $group: { _id: '$vendorId' } },
                ])
                .toArray()
                .catch(() => [] as Array<{ _id: unknown }>),
        ]);

        let totalPurchaseValue = 0;
        let topVendorId: unknown = null;
        let topVendorValue = 0;
        for (const row of perVendorAgg) {
            const val = Number((row as { total?: number }).total ?? 0);
            totalPurchaseValue += val;
            if (val > topVendorValue) {
                topVendorValue = val;
                topVendorId = (row as { _id: unknown })._id;
            }
        }

        let topVendor: CrmVendorKpis['topVendor'] = null;
        if (topVendorId) {
            const candidates: unknown[] = [topVendorId];
            if (
                typeof topVendorId === 'string' &&
                ObjectId.isValid(topVendorId)
            ) {
                candidates.push(new ObjectId(topVendorId));
            }
            const vendorDoc = await db
                .collection('crm_vendors')
                .findOne(
                    { userId, _id: { $in: candidates } } as Record<string, unknown>,
                    { projection: { name: 1 } },
                )
                .catch(() => null);
            if (vendorDoc) {
                topVendor = {
                    name: String((vendorDoc as { name?: string }).name ?? 'Unknown'),
                    value: topVendorValue,
                };
            }
        }

        return {
            total: Number(total) || 0,
            active: activeIdsAgg.length,
            totalPurchaseValue,
            topVendor,
            currency: 'INR',
        };
    } catch (e) {
        console.error('[getCrmVendorKpis] failed:', e);
        return empty;
    }
}

/* ─── Related counts (vendor detail right rail) ──────────────────── */

/**
 * Live related-entity counts for the vendor detail page right rail
 * (P1.1B Wave 3 — Purchases rebuild · §1D.2). Reads directly from
 * Mongo: POs, bills, payouts, debit-notes, RFQs, vendor-bids, items
 * supplied, tickets raised against the vendor.
 *
 * Mirrors `getCrmAccountRelatedCounts` for the customer side — one
 * `Promise.all` of `countDocuments` queries (async-parallel best
 * practice). All counts are scoped to the current tenant via `userId`.
 */
export async function getCrmVendorRelatedCounts(vendorId: string): Promise<{
    purchaseOrders: number;
    bills: number;
    payouts: number;
    debitNotes: number;
    rfqs: number;
    vendorBids: number;
    items: number;
    tickets: number;
}> {
    const empty = {
        purchaseOrders: 0,
        bills: 0,
        payouts: 0,
        debitNotes: 0,
        rfqs: 0,
        vendorBids: 0,
        items: 0,
        tickets: 0,
    };
    if (!vendorId) return empty;
    const session = await getSession();
    if (!session?.user) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(String(session.user._id));
        const idCandidates: unknown[] = [vendorId];
        if (ObjectId.isValid(vendorId)) idCandidates.push(new ObjectId(vendorId));

        const [
            purchaseOrders,
            bills,
            payouts,
            debitNotes,
            rfqs,
            vendorBids,
            items,
            tickets,
        ] = await Promise.all([
            db
                .collection('crm_purchase_orders')
                .countDocuments({
                    userId,
                    vendorId: { $in: idCandidates },
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_bills')
                .countDocuments({
                    userId,
                    vendorId: { $in: idCandidates },
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_payouts')
                .countDocuments({
                    userId,
                    vendorId: { $in: idCandidates },
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_debit_notes')
                .countDocuments({
                    userId,
                    vendorId: { $in: idCandidates },
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_rfqs')
                .countDocuments({
                    userId,
                    vendorsInvited: { $in: idCandidates as string[] },
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_vendor_bids')
                .countDocuments({
                    userId,
                    vendorId: { $in: idCandidates },
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_items')
                .countDocuments({
                    userId,
                    $or: [
                        { defaultVendorId: { $in: idCandidates } },
                        { preferredVendorId: { $in: idCandidates } },
                    ],
                } as Record<string, unknown>)
                .catch(() => 0),
            db
                .collection('crm_tickets')
                .countDocuments({
                    userId,
                    vendorId: { $in: idCandidates },
                } as Record<string, unknown>)
                .catch(() => 0),
        ]);

        return {
            purchaseOrders: Number(purchaseOrders) || 0,
            bills: Number(bills) || 0,
            payouts: Number(payouts) || 0,
            debitNotes: Number(debitNotes) || 0,
            rfqs: Number(rfqs) || 0,
            vendorBids: Number(vendorBids) || 0,
            items: Number(items) || 0,
            tickets: Number(tickets) || 0,
        };
    } catch (e) {
        console.error('[getCrmVendorRelatedCounts] failed:', e);
        return empty;
    }
}

export async function patchCrmVendor(
    vendorId: string,
    fields: Partial<CrmVendor>,
): Promise<{ success: boolean; message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_vendor', 'edit');
    if (!guard.ok) return { success: false, error: guard.error };

    if (!vendorId) return { success: false, error: 'Vendor ID is required.' };

    if (useRustCrm()) {
        try {
            const doc = await vendorApi.getById(vendorId);
            if (!doc) return { success: false, error: 'Vendor not found.' };
            const payload = {
                name: doc.name,
                ...doc,
                ...fields,
            };
            delete (payload as any)._id;
            delete (payload as any).userId;
            delete (payload as any).createdAt;
            delete (payload as any).updatedAt;
            
            await vendorApi.update(vendorId, payload as any);
            revalidateVendorSurfaces(vendorId);
            return { success: true, message: 'Vendor updated successfully.' };
        } catch (e) {
            console.error('[patchCrmVendor] rust path failed; falling back:', e);
            recordRustFallback({ entity: 'vendor', op: 'patch', errorCode: e instanceof RustApiError ? e.code : undefined, status: e instanceof RustApiError ? e.status : undefined });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const updateData = {
            ...fields,
            updatedAt: new Date(),
        };
        delete (updateData as any)._id;
        delete (updateData as any).userId;
        delete (updateData as any).createdAt;

        const result = await db
            .collection('crm_vendors')
            .updateOne(
                { _id: new ObjectId(vendorId), userId: new ObjectId(session.user._id) },
                { $set: updateData },
            );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Vendor not found or access denied.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'update',
            entityKind: 'vendor',
            entityId: vendorId,
        });

        revalidateVendorSurfaces(vendorId);
        return { success: true, message: 'Vendor updated successfully.' };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getVendorNamesByIds(vendorIds: string[]): Promise<Record<string, string>> {
    const session = await getSession();
    if (!session?.user || !vendorIds.length) return {};
    const { db } = await connectToDatabase();
    const docs = await db.collection('crm_vendors').find({
        userId: new ObjectId(session.user._id),
        _id: { $in: vendorIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) }
    }).project({ name: 1, displayName: 1 }).toArray();
    
    const map: Record<string, string> = {};
    for (const d of docs) {
        map[d._id.toString()] = d.displayName || d.name || 'Vendor';
    }
    return map;
}

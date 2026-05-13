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
import { RustApiError } from '@/lib/rust-client/fetcher';
import { getErrorMessage } from '@/lib/utils';

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

    const name = (formData.get('name') as string | null) || '';
    if (!name.trim()) {
        return { error: 'Vendor name is required.' };
    }

    const logoUrlRaw = formData.get('logoUrl') as string | null;
    const attachmentsRaw = formData.get('attachmentUrls') as string | null;
    const bankRaw = formData.get('bankAccountDetails') as string | null;

    const attachments = parseAttachments(attachmentsRaw);
    const bankAccountDetails = parseBankAccountDetails(bankRaw);
    const industryIdStr = (formData.get('industryId') as string | null) || undefined;

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
    if (!vendorId) return { success: false, error: 'Invalid Vendor ID.' };

    if (useRustCrm()) {
        try {
            // DELETE /v1/crm/vendors/:id is hard-delete (no status column).
            await vendorApi.delete(vendorId);
            revalidateVendorSurfaces();
            return { success: true };
        } catch (e) {
            console.error('[deleteCrmVendor] rust path failed; falling back:', e);
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

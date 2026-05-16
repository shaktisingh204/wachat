'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { CrmProductCategory, CrmBrand, CrmUnit, CrmIndustry } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmUnitsApi } from '@/lib/rust-client/crm-units';
import { crmProductCategoriesApi } from '@/lib/rust-client/crm-product-categories';
import { crmTaxesApi } from '@/lib/rust-client/crm-taxes';
import { crmIndustriesApi } from '@/lib/rust-client/crm-industries';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

// --- Categories ---
export async function getCrmCategories(): Promise<WithId<CrmProductCategory>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const categories = await db.collection('crm_product_categories')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(categories));
    } catch (e) {
        return [];
    }
}

export async function saveCrmCategory(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; topic?: WithId<CrmProductCategory> }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_inventory_settings', 'create');
    if (!guard.ok) return { error: guard.error };
    try {
        const { db } = await connectToDatabase();
        const name = formData.get('name') as string;
        if (!name) return { error: 'Name is required' };

        const categoryData = {
            userId: new ObjectId(session.user._id),
            name,
            description: formData.get('description') as string,
            updatedAt: new Date()
        };

        let result;
        const id = formData.get('_id') as string;
        if (id) {
            await db.collection('crm_product_categories').updateOne(
                { _id: new ObjectId(id) },
                { $set: categoryData }
            );
            result = { ...categoryData, _id: new ObjectId(id) };
        } else {
            const res = await db.collection('crm_product_categories').insertOne({ ...categoryData, createdAt: new Date() });
            result = { ...categoryData, createdAt: new Date(), _id: res.insertedId };
        }

        revalidatePath('/dashboard/crm/inventory/items');
        // Return object for smart select
        return { message: 'Category saved.', topic: JSON.parse(JSON.stringify(result)) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Fetch a single product category document scoped to the current user.
 *
 * Mirrors the canonical loader shape used elsewhere in the CRM. Dual-impl
 * gated by `USE_RUST_CRM=true`; falls back to direct Mongo on Rust error.
 */
export async function getProductCategoryById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmProductCategoriesApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getProductCategoryById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'product_category',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_product_categories').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch product category by id:', e);
        return null;
    }
}

// --- Brands ---
export async function getCrmBrands(): Promise<WithId<CrmBrand>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const brands = await db.collection('crm_brands')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(brands));
    } catch (e) {
        return [];
    }
}

export async function saveCrmBrand(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; topic?: WithId<CrmBrand> }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_inventory_settings', 'create');
    if (!guard.ok) return { error: guard.error };
    try {
        const { db } = await connectToDatabase();
        const name = formData.get('name') as string;
        if (!name) return { error: 'Name is required' };

        const brandData = {
            userId: new ObjectId(session.user._id),
            name,
            description: formData.get('description') as string,
            updatedAt: new Date()
        };

        let result;
        const id = formData.get('_id') as string;
        if (id) {
            await db.collection('crm_brands').updateOne(
                { _id: new ObjectId(id) },
                { $set: brandData }
            );
            result = { ...brandData, _id: new ObjectId(id) };
        } else {
            const res = await db.collection('crm_brands').insertOne({ ...brandData, createdAt: new Date() });
            result = { ...brandData, createdAt: new Date(), _id: res.insertedId };
        }

        revalidatePath('/dashboard/crm/inventory/items');
        return { message: 'Brand saved.', topic: JSON.parse(JSON.stringify(result)) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

// --- Units ---
export async function getCrmUnits(): Promise<WithId<CrmUnit>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const units = await db.collection('crm_units')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();
        return JSON.parse(JSON.stringify(units));
    } catch (e) {
        return [];
    }
}

export async function saveCrmUnit(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; topic?: WithId<CrmUnit> }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_inventory_settings', 'create');
    if (!guard.ok) return { error: guard.error };
    try {
        const { db } = await connectToDatabase();
        const name = formData.get('name') as string;
        const symbol = formData.get('symbol') as string;
        if (!name || !symbol) return { error: 'Name and Symbol are required' };

        const unitData = {
            userId: new ObjectId(session.user._id),
            name,
            symbol,
            updatedAt: new Date()
        };

        let result;
        const id = formData.get('_id') as string;
        if (id) {
            await db.collection('crm_units').updateOne(
                { _id: new ObjectId(id) },
                { $set: unitData }
            );
            result = { ...unitData, _id: new ObjectId(id) };
        } else {
            const res = await db.collection('crm_units').insertOne({ ...unitData, createdAt: new Date() });
            result = { ...unitData, createdAt: new Date(), _id: res.insertedId };
        }

        revalidatePath('/dashboard/crm/inventory/items');
        return { message: 'Unit saved.', topic: JSON.parse(JSON.stringify(result)) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Fetch a single unit-of-measure document scoped to the current tenant.
 *
 * Dual-impl: when `USE_RUST_CRM=true` we hit the Rust BFF first and fall
 * back to Mongo on any error (network, decode, RBAC mismatch, etc.).
 */
export async function getUnitById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmUnitsApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getUnitById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'unit',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_units').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch unit by id:', e);
        return null;
    }
}

// --- Industries ---
export async function getCrmIndustries(): Promise<WithId<CrmIndustry>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const industries = await db.collection('crm_industries')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ name: 1 })
            .toArray();

        const defaultIndustries = [
            'Accounting', 'Airlines/Aviation', 'Alternative Dispute Resolution', 'Alternative Medicine', 'Animation', 'Apparel & Fashion',
            'Architecture & Planning', 'Arts and Crafts', 'Automotive', 'Aviation & Aerospace', 'Banking', 'Biotechnology', 'Broadcast Media',
            'Building Materials', 'Business Supplies and Equipment', 'Capital Markets', 'Chemicals', 'Civic & Social Organization',
            'Civil Engineering', 'Commercial Real Estate', 'Computer & Network Security', 'Computer Games', 'Computer Hardware',
            'Computer Networking', 'Computer Software', 'Construction', 'Consumer Electronics', 'Consumer Goods', 'Consumer Services',
            'Cosmetics', 'Dairy', 'Defense & Space', 'Design', 'Education Management', 'E-Learning', 'Electrical/Electronic Manufacturing',
            'Entertainment', 'Environmental Services', 'Events Services', 'Executive Office', 'Facilities Services', 'Farming',
            'Financial Services', 'Fine Art', 'Fishery', 'Food & Beverages', 'Food Production', 'Fund-Raising', 'Furniture',
            'Gambling & Casinos', 'Glass, Ceramics & Concrete', 'Government Administration', 'Government Relations', 'Graphic Design',
            'Health, Wellness and Fitness', 'Higher Education', 'Hospital & Health Care', 'Hospitality', 'Human Resources',
            'Import and Export', 'Individual & Family Services', 'Industrial Automation', 'Information Services',
            'Information Technology and Services', 'Insurance', 'International Affairs', 'International Trade and Development',
            'Internet', 'Investment Banking', 'Investment Management', 'Judiciary', 'Law Enforcement', 'Law Practice', 'Legal Services',
            'Legislative Office', 'Leisure, Travel & Tourism', 'Libraries', 'Logistics and Supply Chain', 'Luxury Goods & Jewelry',
            'Machinery', 'Management Consulting', 'Maritime', 'Marketing and Advertising', 'Market Research',
            'Mechanical or Industrial Engineering', 'Media Production', 'Medical Devices', 'Medical Practice', 'Mental Health Care',
            'Military', 'Mining & Metals', 'Motion Pictures and Film', 'Museums and Institutions', 'Music', 'Nanotechnology',
            'Newspapers', 'Nonprofit Organization Management', 'Oil & Energy', 'Online Media', 'Outsourcing/Offshoring',
            'Package/Freight Delivery', 'Packaging and Containers', 'Paper & Forest Products', 'Performing Arts', 'Pharmaceuticals',
            'Philanthropy', 'Photography', 'Plastics', 'Political Organization', 'Primary/Secondary Education', 'Printing',
            'Professional Training & Coaching', 'Program Development', 'Public Policy', 'Public Relations and Communications',
            'Public Safety', 'Publishing', 'Railroad Manufacture', 'Ranching', 'Real Estate', 'Recreational Facilities and Services',
            'Religious Institutions', 'Renewables & Environment', 'Research', 'Restaurants', 'Retail', 'Security and Investigations',
            'Semiconductors', 'Shipbuilding', 'Sporting Goods', 'Sports', 'Staffing and Recruiting', 'Supermarkets',
            'Telecommunications', 'Textiles', 'Think Tanks', 'Tobacco', 'Translation and Localization', 'Transportation/Trucking/Railroad',
            'Utilities', 'Venture Capital & Private Equity', 'Veterinary', 'Warehousing', 'Wholesale', 'Wine and Spirits',
            'Wireless', 'Writing and Editing', 'Other'
        ];

        // Create a Set of existing names for fast lookup
        const existingNames = new Set(industries.map((ind: any) => ind.name.toLowerCase()));

        // Add defaults that don't exist
        const defaultIndustryObjects = defaultIndustries
            .filter(name => !existingNames.has(name.toLowerCase()))
            .map((name, index) => ({
                _id: new ObjectId().toString(), // Dummy ID for defaults
                userId: session.user._id, // Just to satisfy type, though they are virtual
                name: name,
                description: 'Default Industry',
                updatedAt: new Date(),
                createdAt: new Date(),
                isDefault: true // Marker for UI if needed
            }));

        // Combine user industries with remaining defaults
        const allIndustries = [...industries, ...defaultIndustryObjects].sort((a: any, b: any) => a.name.localeCompare(b.name));

        return JSON.parse(JSON.stringify(allIndustries));
    } catch (e) {
        return [];
    }
}

export async function saveCrmIndustry(prevState: any, formData: FormData): Promise<{ message?: string; error?: string; topic?: WithId<CrmIndustry> }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    const guard = await requirePermission('crm_inventory_settings', 'create');
    if (!guard.ok) return { error: guard.error };
    try {
        const { db } = await connectToDatabase();
        const name = formData.get('name') as string;
        if (!name) return { error: 'Name is required' };

        const industryData = {
            userId: new ObjectId(session.user._id),
            name,
            description: formData.get('description') as string,
            updatedAt: new Date()
        };

        let result;
        const id = formData.get('_id') as string;
        if (id) {
            await db.collection('crm_industries').updateOne(
                { _id: new ObjectId(id) },
                { $set: industryData }
            );
            result = { ...industryData, _id: new ObjectId(id) };
        } else {
            const res = await db.collection('crm_industries').insertOne({ ...industryData, createdAt: new Date() });
            result = { ...industryData, createdAt: new Date(), _id: res.insertedId };
        }

        revalidatePath('/dashboard/crm/inventory/items');
        return { message: 'Industry saved.', topic: JSON.parse(JSON.stringify(result)) };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

/**
 * Fetch a single industry document scoped to the current user.
 *
 * Dual-implementation: when `USE_RUST_CRM=true` we go through the
 * `crm-industries` BFF, then fall back to the legacy Mongo path on any
 * error so an outage of the Rust service never breaks the UI.
 */
export async function getIndustryById(
    id: string,
): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmIndustriesApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getIndustryById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'industry',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_industries').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch industry by id:', e);
        return null;
    }
}

// --- Taxes ---
/**
 * Fetch a single tax-rate document (from `crm_taxes`) scoped to the
 * current user. Mirrors the canonical loader shape used elsewhere in
 * the CRM and dual-implements through the Rust BFF when
 * `USE_RUST_CRM=true`, falling back to Mongo on error.
 */
export async function getTaxById(id: string): Promise<WithId<Record<string, unknown>> | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmTaxesApi.getById(id);
            return JSON.parse(JSON.stringify(doc));
        } catch (e) {
            console.error('[getTaxById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'tax',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('crm_taxes').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc));
    } catch (e) {
        console.error('Failed to fetch tax by id:', e);
        return null;
    }
}

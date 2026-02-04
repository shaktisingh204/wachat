'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index';
import type { CrmProductCategory, CrmBrand, CrmUnit, CrmIndustry } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

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

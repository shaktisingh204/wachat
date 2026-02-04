'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index';
import type { CrmProductCategory, CrmBrand, CrmUnit } from '@/lib/definitions';
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

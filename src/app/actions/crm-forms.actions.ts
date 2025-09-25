
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmForm, CrmContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmForms(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ forms: WithId<CrmForm>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { forms: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmForm> = { userId: userObjectId };
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        const skip = (page - 1) * limit;

        const [forms, total] = await Promise.all([
            db.collection<CrmForm>('crm_forms').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_forms').countDocuments(filter)
        ]);

        return {
            forms: JSON.parse(JSON.stringify(forms)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM forms:", e);
        return { forms: [], total: 0 };
    }
}


export async function saveCrmForm(data: {
    formId?: string;
    name: string;
    settings: any;
}): Promise<{ message?: string; error?: string; formId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    if (!data.name) return { error: 'Form Name is required.' };
    
    const isNew = !data.formId;
    
    const formData: Omit<CrmForm, '_id' | 'createdAt'> = {
        name: data.name,
        userId: new ObjectId(session.user._id),
        fields: data.settings.fields || [],
        settings: data.settings,
        submissionCount: 0,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('crm_forms').insertOne({ ...formData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/crm/sales/forms');
            return { message: 'Form created successfully.', formId: result.insertedId.toString() };
        } else {
            await db.collection('crm_forms').updateOne(
                { _id: new ObjectId(data.formId), userId: new ObjectId(session.user._id) },
                { $set: formData }
            );
            revalidatePath('/dashboard/crm/sales/forms');
            return { message: 'Form updated successfully.', formId: data.formId };
        }
    } catch (e: any) {
        return { error: 'Failed to save form.' };
    }
}

export async function getCrmFormById(formId: string): Promise<WithId<CrmForm> | null> {
    if (!ObjectId.isValid(formId)) return null;

    try {
        const { db } = await connectToDatabase();
        const form = await db.collection<CrmForm>('crm_forms').findOne({ _id: new ObjectId(formId) });
        // Publicly accessible for embedding, no session check needed here.
        return form ? JSON.parse(JSON.stringify(form)) : null;
    } catch (e) {
        return null;
    }
}

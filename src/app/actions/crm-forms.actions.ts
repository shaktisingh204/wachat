
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmForm } from '@/lib/definitions';
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

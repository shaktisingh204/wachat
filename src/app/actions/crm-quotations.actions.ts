
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
// import type { CrmQuotation } from '@/lib/definitions'; // Will be added later
import { getErrorMessage } from '@/lib/utils';

// Placeholder type
type CrmQuotation = any;

export async function getQuotations(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<WithId<CrmQuotation>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmQuotation> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const quotations = await db.collection('crm_quotations')
            .find(filter)
            .sort({ date: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        return JSON.parse(JSON.stringify(quotations));
    } catch (e: any) {
        console.error("Failed to fetch CRM quotations:", e);
        return [];
    }
}

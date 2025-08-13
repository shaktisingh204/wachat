
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
): Promise<{ quotations: WithId<CrmQuotation>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { quotations: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmQuotation> = { userId: userObjectId };
        
        const skip = (page - 1) * limit;

        const [quotations, total] = await Promise.all([
            db.collection('crm_quotations')
                .find(filter)
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_quotations').countDocuments(filter)
        ]);

        return {
            quotations: JSON.parse(JSON.stringify(quotations)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM quotations:", e);
        return { quotations: [], total: 0 };
    }
}

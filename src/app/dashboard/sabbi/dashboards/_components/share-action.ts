'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { revalidatePath } from 'next/cache';

export async function setDashboardVisibility(id: string, isPublic: boolean) {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    if (!id || !ObjectId.isValid(id)) {
        return { error: 'Invalid dashboard ID.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        
        const visibility = isPublic ? 'public' : 'private';
        
        await db.collection('crm_dashboards').updateOne(
            { _id: new ObjectId(id), userId: userObjectId },
            { 
                $set: { 
                    sharedWith: visibility,
                    visibility: visibility,
                    shareScope: visibility
                } 
            }
        );
        
        revalidatePath('/dashboard/sabbi/dashboards');
        revalidatePath(`/dashboard/sabbi/dashboards/${id}`);
        return { success: true };
    } catch (e: any) {
        return { error: e.message || 'Failed to update visibility' };
    }
}

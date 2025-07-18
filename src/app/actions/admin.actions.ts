
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getAdminSession } from '@/app/actions';
import { connectToDatabase } from '@/lib/mongodb';

export async function updateProjectCreditsByAdmin(projectId: string, credits: number): Promise<{ success: boolean, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || isNaN(credits) || credits < 0) {
        return { success: false, error: 'Invalid project ID or credit amount.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { credits: credits } }
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Project not found.' };
        }
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to update project credits:", error);
        return { success: false, error: 'An unexpected database error occurred.' };
    }
}

export async function updateProjectPlanByAdmin(projectId: string, planId: string): Promise<{ success: boolean, error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { success: false, error: 'Permission denied.' };

    if (!ObjectId.isValid(projectId) || !ObjectId.isValid(planId)) {
        return { success: false, error: 'Invalid project or plan ID.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { planId: new ObjectId(planId) } }
        );
        if (result.matchedCount === 0) {
            return { success: false, error: 'Project not found.' };
        }
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Failed to update project plan:", error);
        return { success: false, error: 'An unexpected database error occurred.' };
    }
}

export async function handleDeleteProjectByAdmin(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const { isAdmin } = await getAdminSession();
    if (!isAdmin) return { error: 'Permission denied.' };
    
    const projectId = formData.get('projectId') as string;
    
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: 'Invalid Project ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        const broadcastIds = await db.collection('broadcasts').find({ projectId: projectObjectId }).map(b => b._id).toArray();
        
        const deletePromises = [
            db.collection('projects').deleteOne({ _id: projectObjectId }),
            db.collection('templates').deleteMany({ projectId: projectObjectId }),
            db.collection('broadcasts').deleteMany({ projectId: projectObjectId }),
            db.collection('broadcast_contacts').deleteMany({ broadcastId: { $in: broadcastIds } }),
            db.collection('notifications').deleteMany({ projectId: projectObjectId }),
            db.collection('contacts').deleteMany({ projectId: projectObjectId }),
            db.collection('incoming_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('outgoing_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('flows').deleteMany({ projectId: projectObjectId }),
            db.collection('canned_messages').deleteMany({ projectId: projectObjectId }),
            db.collection('flow_logs').deleteMany({ projectId: projectObjectId }),
            db.collection('meta_flows').deleteMany({ projectId: projectObjectId }),
            db.collection('ad_campaigns').deleteMany({ projectId: projectObjectId }),
            db.collection('ecomm_flows').deleteMany({ projectId: projectObjectId }),
        ];

        await Promise.all(deletePromises);
        
        revalidatePath('/admin/dashboard');

        return { message: 'Project and all associated data have been permanently deleted.' };

    } catch (e: any) {
        console.error('Failed to delete project:', e);
        return { error: e.message || 'An unexpected error occurred while deleting the project.' };
    }
}

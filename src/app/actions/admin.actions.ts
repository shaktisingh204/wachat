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

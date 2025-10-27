
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmPipeline } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { v4 as uuidv4 } from 'uuid';

export async function getCrmPipelines(): Promise<CrmPipeline[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        return user?.crmPipelines || [];
    } catch (e) {
        console.error("Failed to fetch CRM pipelines:", e);
        return [];
    }
}

export async function saveCrmPipelines(pipelines: Omit<CrmPipeline, 'id'>[]): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied' };
    
    // Add unique IDs to any new pipelines or stages that don't have them
    const pipelinesWithIds = pipelines.map(p => ({
        ...p,
        id: p.id || uuidv4(),
        stages: p.stages.map(s => ({...s, id: s.id || uuidv4()}))
    }));

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { crmPipelines: pipelinesWithIds } }
        );
        
        revalidatePath('/dashboard/crm/sales-crm/pipelines');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

    
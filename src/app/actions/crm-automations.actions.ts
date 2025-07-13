

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';

export async function getCrmAutomations(): Promise<WithId<CrmAutomation>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const automations = await db.collection<CrmAutomation>('crm_automations')
            .find({ userId: new ObjectId(session.user._id) })
            .project({ name: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(automations));
    } catch (e) {
        return [];
    }
}

export async function getCrmAutomationById(automationId: string): Promise<WithId<CrmAutomation> | null> {
    if (!ObjectId.isValid(automationId)) return null;
    
    const session = await getSession();
    if (!session?.user) return null;

    const { db } = await connectToDatabase();
    const automation = await db.collection<CrmAutomation>('crm_automations').findOne({ 
        _id: new ObjectId(automationId),
        userId: new ObjectId(session.user._id) 
    });

    return automation ? JSON.parse(JSON.stringify(automation)) : null;
}

export async function saveCrmAutomation(data: {
    flowId?: string;
    name: string;
    nodes: CrmAutomationNode[];
    edges: CrmAutomationEdge[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const { flowId, name, nodes, edges } = data;
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    if (!name) return { error: 'Automation Name is required.' };
    
    const isNew = !flowId;
    
    const automationData: Omit<CrmAutomation, '_id' | 'createdAt'> = {
        name,
        userId: new ObjectId(session.user._id),
        nodes,
        edges,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('crm_automations').insertOne({ ...automationData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/crm/automations');
            return { message: 'Automation created successfully.', flowId: result.insertedId.toString() };
        } else {
            await db.collection('crm_automations').updateOne(
                { _id: new ObjectId(flowId), userId: new ObjectId(session.user._id) },
                { $set: automationData }
            );
            revalidatePath('/dashboard/crm/automations');
            return { message: 'Automation updated successfully.', flowId };
        }
    } catch (e: any) {
        return { error: 'Failed to save automation.' };
    }
}

export async function deleteCrmAutomation(automationId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(automationId)) return { error: 'Invalid Automation ID.' };
    
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    const { db } = await connectToDatabase();
    const automation = await db.collection('crm_automations').findOne({ _id: new ObjectId(automationId), userId: new ObjectId(session.user._id) });
    if (!automation) return { error: 'Automation not found or you do not have access.' };

    try {
        await db.collection('crm_automations').deleteOne({ _id: new ObjectId(automationId) });
        revalidatePath('/dashboard/crm/automations');
        return { message: 'Automation deleted.' };
    } catch (e) {
        return { error: 'Failed to delete automation.' };
    }
}


'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { CrmAutomation, CrmAutomationNode, CrmAutomationEdge } from '@/lib/definitions';

export async function getCrmAutomations(projectId: string): Promise<WithId<CrmAutomation>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const automations = await db.collection<CrmAutomation>('crm_automations')
            .find({ projectId: new ObjectId(projectId) })
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
    const { db } = await connectToDatabase();
    const automation = await db.collection<CrmAutomation>('crm_automations').findOne({ _id: new ObjectId(automationId) });
    if (!automation) return null;

    const hasAccess = await getProjectById(automation.projectId.toString());
    if (!hasAccess) return null;

    return automation ? JSON.parse(JSON.stringify(automation)) : null;
}

export async function saveCrmAutomation(data: {
    flowId?: string;
    projectId: string;
    name: string;
    nodes: CrmAutomationNode[];
    edges: CrmAutomationEdge[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const { flowId, projectId, name, nodes, edges } = data;
    if (!projectId || !name) return { error: 'Project ID and Automation Name are required.' };
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied' };
    
    const isNew = !flowId;
    
    const automationData: Omit<CrmAutomation, '_id' | 'createdAt'> = {
        name,
        projectId: new ObjectId(projectId),
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
                { _id: new ObjectId(flowId) },
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

    const { db } = await connectToDatabase();
    const automation = await db.collection('crm_automations').findOne({ _id: new ObjectId(automationId) });
    if (!automation) return { error: 'Automation not found.' };

    const hasAccess = await getProjectById(automation.projectId.toString());
    if (!hasAccess) return { error: 'Access denied' };

    try {
        await db.collection('crm_automations').deleteOne({ _id: new ObjectId(automationId) });
        revalidatePath('/dashboard/crm/automations');
        return { message: 'Automation deleted.' };
    } catch (e) {
        return { error: 'Failed to delete automation.' };
    }
}

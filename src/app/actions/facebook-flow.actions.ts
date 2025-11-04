
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import type { FacebookFlow, FacebookFlowNode, FacebookFlowEdge } from '@/lib/definitions';

export async function getFacebookFlows(projectId: string): Promise<WithId<FacebookFlow>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection<FacebookFlow>('facebook_flows')
            .find({ projectId: new ObjectId(projectId) })
            .project({ name: 1, triggerKeywords: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch (e) {
        return [];
    }
}

export async function getFacebookFlowById(flowId: string): Promise<WithId<FacebookFlow> | null> {
    if (!ObjectId.isValid(flowId)) return null;
    const { db } = await connectToDatabase();
    const flow = await db.collection<FacebookFlow>('facebook_flows').findOne({ _id: new ObjectId(flowId) });
    if (!flow) return null;

    const hasAccess = await getProjectById(flow.projectId.toString());
    if (!hasAccess) return null;

    return flow ? JSON.parse(JSON.stringify(flow)) : null;
}

export async function saveFacebookFlow(data: {
    flowId?: string;
    projectId: string;
    name: string;
    nodes: FacebookFlowNode[];
    edges: FacebookFlowEdge[];
    triggerKeywords: string[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const { flowId, projectId, name, nodes, edges, triggerKeywords } = data;
    if (!projectId || !name) return { error: 'Project ID and Flow Name are required.' };
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied' };
    
    const isNew = !flowId;
    
    const flowData: Omit<FacebookFlow, '_id' | 'createdAt'> = {
        name,
        projectId: new ObjectId(projectId),
        nodes,
        edges,
        triggerKeywords,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('facebook_flows').insertOne({ ...flowData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/facebook/flow-builder');
            return { message: 'Flow created successfully.', flowId: result.insertedId.toString() };
        } else {
            await db.collection('facebook_flows').updateOne(
                { _id: new ObjectId(flowId) },
                { $set: flowData }
            );
            revalidatePath('/dashboard/facebook/flow-builder');
            return { message: 'Flow updated successfully.', flowId };
        }
    } catch (e: any) {
        return { error: 'Failed to save flow.' };
    }
}

export async function deleteFlow(flowId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(flowId)) return { error: 'Invalid Flow ID.' };

    const { db } = await connectToDatabase();
    const flow = await db.collection<FacebookFlow>('facebook_flows').findOne({ _id: new ObjectId(flowId) });
    if (!flow) return { error: 'Flow not found.' };

    const hasAccess = await getProjectById(flow.projectId.toString());
    if (!hasAccess) return { error: 'Access denied' };

    try {
        await db.collection('facebook_flows').deleteOne({ _id: new ObjectId(flowId) });
        revalidatePath('/dashboard/facebook/flow-builder');
        return { message: 'Flow deleted.' };
    } catch (e) {
        return { error: 'Failed to delete flow.' };
    }
}

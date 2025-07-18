
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { Flow, FlowNode, FlowEdge } from '@/lib/definitions';

export async function getFlowsForProject(projectId: string): Promise<WithId<Flow>[]> {
    if (!ObjectId.isValid(projectId)) return [];
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection<Flow>('flows')
            .find({ projectId: new ObjectId(projectId) })
            .project({ name: 1, triggerKeywords: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch (e) {
        return [];
    }
}

export async function getFlowById(flowId: string): Promise<WithId<Flow> | null> {
    if (!ObjectId.isValid(flowId)) return null;
    const { db } = await connectToDatabase();
    const flow = await db.collection<Flow>('flows').findOne({ _id: new ObjectId(flowId) });
    if (!flow) return null;

    const hasAccess = await getProjectById(flow.projectId.toString());
    if (!hasAccess) return null;

    return flow ? JSON.parse(JSON.stringify(flow)) : null;
}

export async function saveFlow(data: {
    flowId?: string;
    projectId: string;
    name: string;
    nodes: FlowNode[];
    edges: FlowEdge[];
    triggerKeywords: string[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const { flowId, projectId, name, nodes, edges, triggerKeywords } = data;
    if (!projectId || !name) return { error: 'Project ID and Flow Name are required.' };
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied' };
    
    const isNew = !flowId;
    
    const flowData: Omit<Flow, '_id' | 'createdAt'> = {
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
            const result = await db.collection('flows').insertOne({ ...flowData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/flow-builder');
            return { message: 'Flow created successfully.', flowId: result.insertedId.toString() };
        } else {
            await db.collection('flows').updateOne(
                { _id: new ObjectId(flowId), projectId: new ObjectId(projectId) },
                { $set: flowData }
            );
            revalidatePath('/dashboard/flow-builder');
            return { message: 'Flow updated successfully.', flowId };
        }
    } catch (e: any) {
        return { error: 'Failed to save flow.' };
    }
}

export async function deleteFlow(flowId: string): Promise<{ message?: string; error?: string }> {
    if (!ObjectId.isValid(flowId)) return { error: 'Invalid Flow ID.' };

    const { db } = await connectToDatabase();
    const flow = await db.collection('flows').findOne({ _id: new ObjectId(flowId) });
    if (!flow) return { error: 'Flow not found.' };

    const hasAccess = await getProjectById(flow.projectId.toString());
    if (!hasAccess) return { error: 'Access denied' };


    try {
        await db.collection('flows').deleteOne({ _id: new ObjectId(flowId) });
        revalidatePath('/dashboard/flow-builder');
        return { message: 'Flow deleted.' };
    } catch (e) {
        return { error: 'Failed to delete flow.' };
    }
}

export async function getFlowBuilderPageData(projectId: string): Promise<{
    flows: WithId<Flow>[];
    initialFlow: WithId<Flow> | null;
}> {
    const flows = await getFlowsForProject(projectId);
    const initialFlow = flows.length > 0 ? await getFlowById(flows[0]._id.toString()) : null;
    return { flows, initialFlow };
}

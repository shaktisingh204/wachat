
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getSabFlows(): Promise<WithId<SabFlow>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const flows = await db.collection<SabFlow>('sabflows')
            .find({ userId: new ObjectId(session.user._id) })
            .project({ name: 1, trigger: 1, updatedAt: 1 })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(flows));
    } catch (e) {
        return [];
    }
}

export async function getSabFlowById(flowId: string): Promise<WithId<SabFlow> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(flowId)) return null;
    
    const { db } = await connectToDatabase();
    const flow = await db.collection<SabFlow>('sabflows').findOne({ 
        _id: new ObjectId(flowId),
        userId: new ObjectId(session.user._id)
    });

    return flow ? JSON.parse(JSON.stringify(flow)) : null;
}

export async function saveSabFlow(data: {
    flowId?: string;
    name: string;
    trigger: any;
    nodes: SabFlowNode[];
    edges: SabFlowEdge[];
}): Promise<{ message?: string, error?: string, flowId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const { flowId, name, trigger, nodes, edges } = data;
    if (!name) return { error: 'Flow Name is required.' };
    
    const isNew = !flowId;
    
    const flowData: Omit<SabFlow, '_id' | 'createdAt'> = {
        name,
        userId: new ObjectId(session.user._id),
        trigger,
        nodes,
        edges,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('sabflows').insertOne({ ...flowData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/sabflow/flow-builder');
            return { message: 'Flow created successfully.', flowId: result.insertedId.toString() };
        } else {
            await db.collection('sabflows').updateOne(
                { _id: new ObjectId(flowId), userId: new ObjectId(session.user._id) },
                { $set: flowData }
            );
            revalidatePath('/dashboard/sabflow/flow-builder');
            return { message: 'Flow updated successfully.', flowId };
        }
    } catch (e: any) {
        return { error: 'Failed to save flow.' };
    }
}

export async function deleteSabFlow(flowId: string): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(flowId)) return { error: 'Invalid request.' };

    const { db } = await connectToDatabase();
    const flow = await db.collection('sabflows').findOne({ 
        _id: new ObjectId(flowId),
        userId: new ObjectId(session.user._id)
    });
    
    if (!flow) return { error: 'Flow not found or access denied.' };

    try {
        await db.collection('sabflows').deleteOne({ _id: new ObjectId(flowId) });
        revalidatePath('/dashboard/sabflow/flow-builder');
        return { message: 'Flow deleted.' };
    } catch (e) {
        return { error: 'Failed to delete flow.' };
    }
}

export async function saveSabFlowConnection(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };

    try {
        const appId = formData.get('appId') as string;
        const appName = formData.get('appName') as string;
        const connectionName = formData.get('connectionName') as string;
        const credentialKeys = (formData.get('credentialKeys') as string)?.split(',') || [];

        const credentials: Record<string, any> = {};
        for (const key of credentialKeys) {
            credentials[key] = formData.get(key) as string;
        }

        if (formData.get('credentials')) {
            try {
                Object.assign(credentials, JSON.parse(formData.get('credentials') as string));
            } catch {
                // ignore if it's not valid json
            }
        }


        const connectionData = {
            appId,
            appName,
            connectionName,
            credentials,
            createdAt: new Date(),
        };

        if (!connectionData.appId || !connectionData.connectionName) {
            return { error: 'Missing required connection details.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { sabFlowConnections: connectionData } }
        );
        
        revalidatePath('/dashboard/sabflow/connections');
        return { message: `${connectionData.appName} account connected successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

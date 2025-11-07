
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge, WithId as SabWithId, Project, Contact, SabChatSession } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { handleSendMessage, findOrCreateContact } from './whatsapp.actions';
import { sabnodeAppActions } from '@/lib/sabflow-actions';
import * as sabChatActions from './sabchat.actions';
import * as crmActions from './crm.actions';

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

export async function saveSabFlow(prevState: any, data: FormData): Promise<{ message?: string, error?: string, flowId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const flowId = data.get('flowId') as string | undefined;
    const name = data.get('name') as string;
    const trigger = JSON.parse(data.get('trigger') as string);
    const nodes = JSON.parse(data.get('nodes') as string);
    const edges = JSON.parse(data.get('edges') as string);

    if (!name) return { error: 'Flow Name is required.' };
    
    const isNew = !flowId || flowId === 'new';
    
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
        
        let credentials: Record<string, any> = {};
        if (formData.get('credentials')) {
            try {
                credentials = JSON.parse(formData.get('credentials') as string);
            } catch { /* ignore invalid json */ }
        }
        
        const credentialKeysStr = formData.get('credentialKeys') as string | null;
        if(credentialKeysStr) {
             const credentialKeys = credentialKeysStr.split(',');
             for (const key of credentialKeys) {
                if (formData.has(key)) {
                    credentials[key] = formData.get(key) as string;
                }
            }
        }

        const connectionData = {
            _id: new ObjectId(),
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


// --- Flow Execution Engine ---

async function executeAction(node: SabFlowNode, context: any, project: WithId<Project>) {
    const { actionName, inputs } = node.data;
    const interpolatedInputs: Record<string, any> = {};

    // Interpolate all input values from the context
    for(const key in inputs) {
        if(typeof inputs[key] === 'string') {
            interpolatedInputs[key] = inputs[key].replace(/{{\s*([^}]+)\s*}}/g, (match: any, varName: string) => {
                // Simple dot notation accessor for context
                const keys = varName.split('.');
                let value = context;
                for (const k of keys) {
                    if (value && typeof value === 'object' && k in value) {
                        value = value[k];
                    } else {
                        return match; // Variable not found, return placeholder
                    }
                }
                return value;
            });
        } else {
            interpolatedInputs[key] = inputs[key];
        }
    }
    
    // Find the app and action definition to know which function to call
    const actionApp = sabnodeAppActions.find(app => app.actions.some(a => a.name === actionName));
    if (!actionApp) {
        console.error(`Action app not found for action: ${actionName}`);
        return;
    }

    if (actionApp.appId === 'wachat') {
        const { db } = await connectToDatabase();
        const contactResult = await findOrCreateContact(project._id.toString(), project.phoneNumbers[0].id, interpolatedInputs.recipient);
        if (contactResult.error || !contactResult.contact) {
            console.error('Failed to find or create contact for SMS action');
            return;
        }

        const formData = new FormData();
        formData.append('contactId', contactResult.contact._id.toString());
        formData.append('projectId', project._id.toString());
        formData.append('phoneNumberId', project.phoneNumbers[0].id);
        formData.append('waId', interpolatedInputs.recipient);

        switch(actionName) {
            case 'send_text':
                formData.append('messageText', interpolatedInputs.message);
                await handleSendMessage(null, formData);
                break;
            // Additional Wachat actions would be implemented here
            default:
                console.log(`Wachat action "${actionName}" is defined but not yet implemented in the executor.`);
        }
    } else if (actionApp.appId === 'sabchat') {
        switch(actionName) {
            case 'send_message':
                await sabChatActions.postChatMessage(interpolatedInputs.sessionId, 'agent', interpolatedInputs.content);
                break;
            case 'close_session':
                await sabChatActions.closeChatSession(interpolatedInputs.sessionId);
                break;
            case 'add_tag_to_session':
                await sabChatActions.addTagToSession(interpolatedInputs.sessionId, interpolatedInputs.tagName);
                break;
            case 'create_crm_contact':
                const session = await sabChatActions.getFullChatSession(interpolatedInputs.sessionId);
                if (session && session.visitorInfo?.email) {
                    const crmFormData = new FormData();
                    crmFormData.append('name', session.visitorInfo.name || session.visitorInfo.email);
                    crmFormData.append('email', session.visitorInfo.email);
                    if(session.visitorInfo.phone) crmFormData.append('phone', session.visitorInfo.phone);
                    await crmActions.addCrmContact(null, crmFormData);
                }
                break;
            // Other sabChat actions
            default:
                 console.log(`sabChat action "${actionName}" is defined but not yet implemented in the executor.`);
        }
    } else {
        console.log(`Action app "${actionApp.name}" is defined but not yet implemented in the executor.`);
    }
}

export async function runSabFlow(flowId: string, triggerPayload: any) {
    const flow = await getSabFlowById(flowId);
    if (!flow) throw new Error("Flow not found.");

    const { db } = await connectToDatabase();
    // Assuming the flow is tied to a user's first project for simplicity
    const project = await db.collection<Project>('projects').findOne({ userId: flow.userId });
    if (!project) throw new Error("Could not find a project to execute this flow against.");

    let context = { ...triggerPayload };
    let currentNodeId: string | null = flow.nodes.find(n => n.type === 'trigger')?.id || null;

    if(!currentNodeId && flow.nodes.length > 0) {
        // If no trigger node, start with the first node for manual runs
        currentNodeId = flow.nodes[0].id;
    }

    while (currentNodeId) {
        const currentNode = flow.nodes.find(n => n.id === currentNodeId);
        if (!currentNode) break;

        if (currentNode.type === 'action') {
            await executeAction(currentNode, context, project);
        }

        // Move to the next node based on edges
        const edge = flow.edges.find(e => e.source === currentNodeId);
        currentNodeId = edge ? edge.target : null;
    }
}

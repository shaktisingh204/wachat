
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge, WithId as SabWithId, Project, Contact, SabChatSession, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { sabnodeAppActions } from '@/lib/sabflow-actions';

// Dynamically import all action files
async function importActionModule(appId: string) {
    // A mapping from appId to the actual action file path
    const appActionFiles: Record<string, string> = {
        'wachat': './whatsapp.actions.ts',
        'crm': './crm.actions.ts',
        'email': './email.actions.ts',
        'sms': './sms.actions.ts',
        'meta': './facebook.actions.ts',
        'instagram': './instagram.actions.ts',
        'sabchat': './sabchat.actions.ts',
        'url-shortener': './url-shortener.actions.ts',
        'qr-code-maker': './qr-code.actions.ts',
        'seo-suite': './seo.actions.ts',
    };
    
    if (appActionFiles[appId]) {
        try {
            return await import(`${appActionFiles[appId]}`);
        } catch (e) {
             console.error(`Could not import action module for ${appId}:`, e);
            return null;
        }
    }
    return null;
}

async function executeAction(node: SabFlowNode, context: any, user: WithId<User>, logger: any) {
    const { actionName, inputs } = node.data;
    const interpolatedInputs: Record<string, any> = {};

    logger.log(`Preparing to execute action: ${actionName}`);

    // Interpolate all input values from the context
    for(const key in inputs) {
        if(typeof inputs[key] === 'string') {
            interpolatedInputs[key] = inputs[key].replace(/{{\s*([^}]+)\s*}}/g, (match: any, varName: string) => {
                const keys = varName.split('.');
                let value = context;
                for (const k of keys) {
                    if (value && typeof value === 'object' && k in value) {
                        value = value[k];
                    } else {
                        return match; 
                    }
                }
                return value;
            });
        } else {
            interpolatedInputs[key] = inputs[key];
        }
    }
    
    const actionApp = sabnodeAppActions.find(app => app.actions.some(a => a.name === actionName));
    if (!actionApp) {
        const errorMsg = `Action app not found for action: ${actionName}`;
        logger.log(errorMsg);
        console.error(errorMsg);
        return { error: errorMsg };
    }
    
    const connection = user.sabFlowConnections?.find(c => c.connectionName === node.data.connectionId);
    
    try {
        const actionModule = await importActionModule(actionApp.appId);
        if(!actionModule) {
            throw new Error(`Action module for app "${actionApp.name}" could not be loaded.`);
        }
        
        const actionFunction = actionModule[actionName];
        if (typeof actionFunction !== 'function') {
             const errorMsg = `Action function "${actionName}" not found in module.`;
             logger.log(errorMsg);
             console.error(errorMsg);
             return { error: errorMsg };
        }
        
        const formData = new FormData();
        Object.entries(interpolatedInputs).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
            }
        });

        logger.log(`Executing action "${actionName}" with inputs:`, interpolatedInputs);
        const result = await actionFunction(null, formData); // Using null for prevState
        logger.log(`Action "${actionName}" completed.`, { result });
        
        // Return the full result so the flow can access message, error, or other specific fields.
        return { output: result };
        
    } catch (e: any) {
        const errorMsg = `Error executing action "${actionName}": ${getErrorMessage(e)}`;
        logger.log(errorMsg, { stack: e.stack });
        console.error(errorMsg, e);
        return { error: errorMsg };
    }
}

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

export async function runSabFlow(flowId: string, triggerPayload: any) {
    const { db } = await connectToDatabase();
    
    // This is a dummy logger for now. In a real scenario, this would write to a DB.
    const logger = { log: (msg: string, data?: any) => console.log(`[SabFlow] ${msg}`, data ? JSON.stringify(data) : '') };

    logger.log(`Starting flow ID: ${flowId}`);

    const flow = await getSabFlowById(flowId);
    if (!flow) {
        logger.log(`Error: Flow ${flowId} not found.`);
        return;
    }

    const user = await db.collection<User>('users').findOne({ _id: flow.userId });
    if (!user) {
        logger.log(`Error: User ${flow.userId} for flow not found.`);
        return;
    }

    let context = { trigger: triggerPayload };
    let currentNodeId: string | null = flow.nodes.find(n => n.type === 'trigger')?.id || null;
    
    if (!currentNodeId && flow.nodes.length > 0) {
        currentNodeId = flow.nodes[0].id;
    }

    while (currentNodeId) {
        const currentNode = flow.nodes.find(n => n.id === currentNodeId);
        if (!currentNode) {
            logger.log(`Error: Node ${currentNodeId} not found. Terminating.`);
            break;
        }

        let result: { output?: any; error?: string } = {};

        if (currentNode.type === 'action') {
            result = await executeAction(currentNode, context, user, logger);
            if (result.error) {
                // For conditions, we might want to branch on error. For now, stop.
                logger.log(`Action failed. Stopping flow.`, { error: result.error });
                break;
            }
            // Add the output of the current node to the context for the next node
            // e.g. context['Create_CRM_Lead'] = { success: true, contactId: '...' }
            context = { ...context, [currentNode.data.name]: result.output };
        }
        
        if (currentNode.type === 'condition') {
            const rules = currentNode.data.rules || [];
            const logicType = currentNode.data.logicType || 'AND';
            let overallConditionMet = logicType === 'AND';

            for(const rule of rules) {
                const interpolatedField = interpolate(rule.field, context);
                const interpolatedValue = interpolate(rule.value, context);
                let ruleMet = false;

                switch(rule.operator) {
                    case 'equals': ruleMet = interpolatedField == interpolatedValue; break;
                    case 'not_equals': ruleMet = interpolatedField != interpolatedValue; break;
                    case 'contains': ruleMet = String(interpolatedField).includes(String(interpolatedValue)); break;
                    // Add other operators here...
                }
                
                if (logicType === 'AND' && !ruleMet) {
                    overallConditionMet = false;
                    break;
                }
                if (logicType === 'OR' && ruleMet) {
                    overallConditionMet = true;
                    break;
                }
            }

            logger.log(`Condition result: ${overallConditionMet ? 'Yes' : 'No'}`);
            const handleId = overallConditionMet ? `${currentNodeId}-output-yes` : `${currentNodeId}-output-no`;
            const conditionalEdge = flow.edges.find(e => e.sourceHandle === handleId);
            currentNodeId = conditionalEdge ? conditionalEdge.target : null;
        } else {
            // For non-condition nodes, find the single outgoing edge
            const edge = flow.edges.find(e => e.source === currentNodeId);
            currentNodeId = edge ? edge.target : null;
        }
    }
    
    logger.log(`Flow execution finished.`);
}

    


'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { executeWachatAction } from '@/lib/sabflow/actions/wachat';
import { executeCrmAction } from '@/lib/sabflow/actions/crm';
import { executeApiAction } from '@/lib/sabflow/actions/api';
import { executeSmsAction } from '@/lib/sabflow/actions/sms';
import { executeEmailAction } from '@/lib/sabflow/actions/email';
import { executeUrlShortenerAction } from '@/lib/sabflow/actions/url-shortener';
import { executeQrCodeAction } from '@/lib/sabflow/actions/qr-code';
import { executeSabChatAction } from '@/lib/sabflow/actions/sabchat';
import { executeMetaAction } from '@/lib/sabflow/actions/meta';
import { sabnodeAppActions } from '@/lib/sabflow/apps';

// Helper to interpolate context variables into strings
function interpolate(text: string | undefined, context: any): string {
    if (typeof text !== 'string') {
        return '';
    }
    return text.replace(/{{\s*([^}]+)\s*}}/g, (match: any, varName: string) => {
        const keys = varName.split('.');
        let value = context;
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return match; 
            }
        }
        return value !== undefined && value !== null ? String(value) : match;
    });
};


async function executeAction(node: SabFlowNode, context: any, user: WithId<User>, logger: any) {
    const { actionName, appId, inputs } = node.data;
    const interpolatedInputs: Record<string, any> = {};

    logger.log(`Preparing to execute action: ${actionName} for app: ${appId}`, { inputs, context });

    // Interpolate all input values from the context
    if (inputs) {
        for(const key in inputs) {
            interpolatedInputs[key] = interpolate(inputs[key], context);
        }
    }
    
    try {
        let result: { output?: any, error?: string };

        switch(appId) {
            case 'wachat':
                result = await executeWachatAction(actionName, interpolatedInputs, user, logger);
                break;
            case 'sabchat':
                result = await executeSabChatAction(actionName, interpolatedInputs, user, logger);
                break;
            case 'crm':
                result = await executeCrmAction(actionName, interpolatedInputs, user, logger);
                break;
            case 'meta':
                result = await executeMetaAction(actionName, interpolatedInputs, user, logger);
                break;
            case 'api':
                 result = await executeApiAction(node, context, logger);
                 break;
            case 'sms':
                result = await executeSmsAction(actionName, interpolatedInputs, user, logger);
                break;
            case 'email':
                result = await executeEmailAction(actionName, interpolatedInputs, user, logger);
                break;
            case 'url-shortener':
                result = await executeUrlShortenerAction(actionName, interpolatedInputs, user, logger);
                break;
             case 'qr-code-maker':
                result = await executeQrCodeAction(actionName, interpolatedInputs, user, logger);
                break;
            default:
                throw new Error(`Action app "${appId}" is not implemented.`);
        }
        
        logger.log(`Action "${actionName}" completed.`, { result });
        
        if (result.error) {
            logger.log(`Error during action execution: ${result.error}`);
            return { error: result.error };
        }
        
        // Save output to context
        const responseVarName = node.data.name.replace(/ /g, '_');
        context[responseVarName] = result;

        logger.log(`Saved action output to context variable "${responseVarName}"`);

        return { output: result };

    } catch(e: any) {
        const errorMsg = `Error executing action "${actionName}": ${getErrorMessage(e)}`;
        logger.log(errorMsg, { stack: e.stack, context: { ...context, interpolatedInputs } });
        return { error: errorMsg };
    }
}

async function executeNode(db: Db, user: WithId<User>, flow: WithId<SabFlow>, nodeId: string, context: any, logger: any): Promise<string | null> {
    const node = flow.nodes.find(n => n.id === nodeId);
    if (!node) {
        logger.log(`Error: Node ${nodeId} not found. Terminating.`);
        return null;
    }

    logger.log(`Executing node "${node.data.name}" (Type: ${node.type})`);
    
    if (node.type === 'action') {
        const result = await executeAction(node, context, user, logger);
        if (result.error) {
            logger.log(`Action failed. Stopping flow.`, { error: result.error, context });
            return null; // Stop execution on error
        }
        // The action's output is added to the context inside executeAction
    } else if (node.type === 'condition') {
        const rules = node.data.rules || [];
        const logicType = node.data.logicType || 'AND';
        let finalResult = logicType === 'AND';

        for (const rule of rules) {
            const leftValue = interpolate(rule.field, context);
            const rightValue = interpolate(rule.value, context);
            let ruleResult = false;
            switch(rule.operator) {
                case 'equals': ruleResult = leftValue === rightValue; break;
                case 'not_equals': ruleResult = leftValue !== rightValue; break;
                case 'contains': ruleResult = leftValue.includes(rightValue); break;
                // Add other operators here
            }
            if (logicType === 'AND' && !ruleResult) {
                finalResult = false;
                break;
            }
            if (logicType === 'OR' && ruleResult) {
                finalResult = true;
                break;
            }
        }
        
        logger.log(`Condition result: ${finalResult ? 'Yes' : 'No'}`);
        const sourceHandle = finalResult ? 'output-yes' : 'output-no';
        const edge = flow.edges.find(e => e.source === nodeId && e.sourceHandle === sourceHandle);
        return edge ? edge.target : null;
    }
    
    // For trigger and simple actions, find the single outgoing edge
    const edge = flow.edges.find(e => e.source === nodeId);
    return edge ? edge.target : null;
}

export async function runSabFlow(flowId: string, triggerPayload: any) {
    const { db } = await connectToDatabase();
    
    const logger = { log: (msg: string, data?: any) => console.log(`[SabFlow:${flowId}] ${msg}`, data ? JSON.stringify(data, null, 2) : '') };

    logger.log(`Starting flow execution.`);

    const flow = await db.collection<SabFlow>('sabflows').findOne({ _id: new ObjectId(flowId) });
    if (!flow) {
        logger.log(`Error: Flow ${flowId} not found.`);
        return { error: `Flow with ID ${flowId} not found.`};
    }

    const user = await db.collection<User>('users').findOne({ _id: flow.userId });
    if (!user) {
        logger.log(`Error: User ${flow.userId} for flow not found.`);
        return { error: `User for flow ${flowId} not found.`};
    }

    // Set the webhook payload directly as the 'trigger' object in the context
    let context: any = { trigger: triggerPayload };

    let currentNodeId: string | null = flow.nodes.find(n => n.type === 'trigger')?.id || null;
    
    while (currentNodeId) {
        const nextNodeId = await executeNode(db, user, flow, currentNodeId, context, logger);
        currentNodeId = nextNodeId;
    }
    
    logger.log(`Flow execution finished.`);
    return { success: true, message: 'Flow executed.' };
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

export async function saveSabFlow(prevState: any, formData: FormData): Promise<{ message?: string, error?: string, flowId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    const flowId = formData.get('flowId') as string | undefined;
    const name = formData.get('name') as string;
    const trigger = JSON.parse(formData.get('trigger') as string);
    const nodes = JSON.parse(formData.get('nodes') as string);
    const edges = JSON.parse(formData.get('edges') as string);

    if (!name) return { error: 'Flow Name is required.' };
    
    const isNew = !flowId || flowId === 'new-flow';
    
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
            revalidatePath(`/dashboard/sabflow/flow-builder/${flowId}`);
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
            { $push: { sabFlowConnections: connectionData as any } }
        );
        
        revalidatePath('/dashboard/sabflow/connections');
        return { message: `${connectionData.appName} account connected successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

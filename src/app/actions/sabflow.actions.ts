
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge, WithId as SabWithId, Project, Contact, SabChatSession, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { sabnodeAppActions } from '@/lib/sabflow-actions';
import { addCrmLeadAndDeal } from '@/app/actions/crm-deals.actions';

// Dynamically import all action files
async function importActionModule(appId: string) {
    const appActionFiles: Record<string, string> = {
        'wachat': './whatsapp.actions',
        'crm': './crm.actions',
        'email': './email.actions',
        'sms': './sms.actions',
        'meta': './facebook.actions',
        'instagram': './instagram.actions',
        'sabchat': './sabchat.actions',
        'url-shortener': './url-shortener.actions',
        'qr-code-maker': './qr-code.actions',
        'seo-suite': './seo.actions',
    };
    
    if (appActionFiles[appId]) {
        try {
            return await import(`@/app/actions/${appId}.actions`);
        } catch (e) {
             console.error(`Could not import action module for ${appId}:`, e);
            return null;
        }
    }
    return null;
}

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
    const { actionName, inputs } = node.data;
    const interpolatedInputs: Record<string, any> = {};

    logger.log(`Preparing to execute action: ${actionName}`);

    // Interpolate all input values from the context
    for(const key in inputs) {
        interpolatedInputs[key] = interpolate(inputs[key], context);
    }
    
     // Special handling for CRM lead creation
    if (actionName === 'createCrmLead') {
        try {
            const formData = new FormData();
            Object.entries(interpolatedInputs).forEach(([key, value]) => {
                formData.append(key, String(value));
            });
            const result = await addCrmLeadAndDeal(null, formData);
            logger.log(`Action "${actionName}" completed.`, { result });
            return { output: result };
        } catch(e: any) {
            const errorMsg = `Error executing action "${actionName}": ${getErrorMessage(e)}`;
            logger.log(errorMsg, { stack: e.stack });
            return { error: errorMsg };
        }
    }
    
    const actionApp = sabnodeAppActions.find(app => app.actions.some(a => a.name === actionName));
    if (!actionApp) {
        const errorMsg = `Action app not found for action: ${actionName}`;
        logger.log(errorMsg);
        console.error(errorMsg);
        return { error: errorMsg };
    }
    
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
        
        logger.log(`Executing action "${actionName}" with inputs:`, interpolatedInputs);
        const result = await actionFunction(interpolatedInputs, user);
        logger.log(`Action "${actionName}" completed.`, { result });
        
        return { output: result };
        
    } catch (e: any) {
        const errorMsg = `Error executing action "${actionName}": ${getErrorMessage(e)}`;
        logger.log(errorMsg, { stack: e.stack });
        console.error(errorMsg, e);
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
            logger.log(`Action failed. Stopping flow.`, { error: result.error });
            return null; // Stop execution on error
        }
        const actionKey = node.data.actionName.replace(/\s+/g, '_');
        context[actionKey] = result.output;
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

    let context: any = { trigger: triggerPayload };
    if (triggerPayload?.sessionId) context.sessionId = triggerPayload.sessionId;
    if (triggerPayload?.visitorId) context.visitorId = triggerPayload.visitorId;

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
            { $push: { sabFlowConnections: connectionData } }
        );
        
        revalidatePath('/dashboard/sabflow/connections');
        return { message: `${connectionData.appName} account connected successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

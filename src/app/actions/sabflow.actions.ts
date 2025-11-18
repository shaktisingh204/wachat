

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { executeSabFlowAction } from '@/lib/sabflow/actions';


async function executeNode(db: Db, user: WithId<User>, flow: WithId<SabFlow>, execution: WithId<any>, logger: any): Promise<string | null> {
    const currentNodeId = execution.currentNodeId;
    const node = flow.nodes.find(n => n.id === currentNodeId);
    if (!node) {
        logger.log(`Error: Node ${currentNodeId} not found. Terminating.`);
        await db.collection('sabflow_executions').updateOne({ _id: execution._id }, { $set: { status: 'FAILED', error: 'Node not found', finishedAt: new Date() }});
        return null;
    }

    logger.log(`Executing node "${node.data.name}" (Type: ${node.type})`);
    
    let nextNodeId: string | null = flow.edges.find(e => e.source === currentNodeId && (e.sourceHandle === `${node.id}-output-main` || !e.sourceHandle))?.target || null;

    if (node.type === 'action') {
        const result = await executeSabFlowAction(execution._id, node, user, logger);
        
        const stepName = node.data.name.replace(/\s+/g, '_');
        
        if (result.error) {
            logger.log(`Action failed. Stopping flow.`, { error: result.error });
            await db.collection('sabflow_executions').updateOne({ _id: execution._id }, { $set: { status: 'FAILED', error: result.error, finishedAt: new Date(), [`history.${stepName}`]: result  }});
            return null; // Stop execution on error
        }
        
        const newContext = { ...execution.context, [stepName]: result };
        await db.collection('sabflow_executions').updateOne(
            { _id: execution._id }, 
            { $set: { context: newContext, [`history.${stepName}`]: result } }
        );
        logger.log(`Saved action output to context under "${stepName}"`);

    } else if (node.type === 'condition') {
        const rules = node.data.rules || [];
        const logicType = node.data.logicType || 'AND';
        let finalResult = logicType === 'AND';

        // Custom interpolation for conditions as it's simpler
        const interpolateCondition = (text: string | undefined, context: any): string => {
            if (typeof text !== 'string') return '';
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

        for (const rule of rules) {
            const leftValue = interpolateCondition(rule.field, execution.context);
            const rightValue = interpolateCondition(rule.value, execution.context);
            let ruleResult = false;
            switch(rule.operator) {
                case 'equals': ruleResult = leftValue === rightValue; break;
                case 'not_equals': ruleResult = leftValue !== rightValue; break;
                case 'contains': ruleResult = String(leftValue).includes(String(rightValue)); break;
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
        const sourceHandle = finalResult ? `${node.id}-output-yes` : `${node.id}-output-no`;
        const edge = flow.edges.find(e => e.sourceHandle === sourceHandle);
        nextNodeId = edge ? edge.target : null;
    }
    
    return nextNodeId;
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
    
    const startNode = flow.nodes.find(n => n.type === 'trigger');
    if (!startNode) {
        return { error: `Flow has no trigger node.` };
    }

    const executionResult = await db.collection('sabflow_executions').insertOne({
        flowId: flow._id,
        userId: user._id,
        status: 'RUNNING',
        startedAt: new Date(),
        context: { trigger: triggerPayload },
        history: {},
        currentNodeId: startNode.id,
    });
    const executionId = executionResult.insertedId;
    
    let currentNodeId: string | null = startNode.id;
    let executionCount = 0;
    const maxSteps = 50;

    while (currentNodeId && executionCount < maxSteps) {
        executionCount++;
        const executionDoc = await db.collection('sabflow_executions').findOne({ _id: executionId });
        if (!executionDoc) {
            logger.log("Execution document not found. Terminating.");
            break;
        }

        const nextNodeId = await executeNode(db, user, flow, executionDoc, logger);
        
        if (nextNodeId) {
            await db.collection('sabflow_executions').updateOne({ _id: executionId }, { $set: { currentNodeId: nextNodeId } });
        }
        currentNodeId = nextNodeId;
    }
    
    await db.collection('sabflow_executions').updateOne(
        { _id: executionId, status: 'RUNNING' }, 
        { $set: { status: 'COMPLETED', finishedAt: new Date() } }
    );
    
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

export async function testApiRequest(apiRequest: any) {
    try {
        if (!apiRequest || !apiRequest.url) {
            throw new Error("API Request node is not configured with a URL.");
        }
        
        const requestConfig: any = {
            method: apiRequest.method || 'GET',
            url: apiRequest.url,
        };
        
        const response = await axios(requestConfig);
        
        return { data: { status: response.status, headers: response.headers, data: response.data } };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

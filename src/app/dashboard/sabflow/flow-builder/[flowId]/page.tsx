
'use client';

import React, { useState, useActionState, useEffect, useRef, useTransition, useCallback } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { saveSabFlow, getSabFlowById } from '@/app/actions/sabflow.actions';
import { getSession } from '@/app/actions';
import type { WithId, SabFlow, User, SabFlowNode, SabFlowEdge } from '@/lib/definitions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

import {
  ArrowLeft,
  Save,
  LoaderCircle,
  Plus,
  PlayCircle,
  Zap,
  Trash2,
  Settings,
  GitFork,
  BookOpen
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow-actions';

const initialState = { message: null, error: null };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save Flow
    </Button>
  );
}

const triggers = [
    { id: 'webhook', name: 'Webhook Received', icon: Zap },
    { id: 'app_event', name: 'App Event', icon: PlayCircle },
];

function BuilderPageSkeleton() {
    return (
        <div className="flex flex-col gap-8">
            <Skeleton className="h-10 w-48"/>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Skeleton className="h-32 w-full"/>
                    <Skeleton className="h-48 w-full"/>
                </div>
                 <div className="lg:col-span-1">
                     <Skeleton className="h-64 w-full sticky top-24"/>
                 </div>
            </div>
        </div>
    )
}

function NodeInput({ input, value, onChange }: { input: any, value: any, onChange: (val: any) => void }) {
    switch (input.type) {
        case 'textarea':
            return <Textarea placeholder={input.placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
        case 'select':
            return (
                <Select value={value || ''} onValueChange={onChange}>
                    <SelectTrigger><SelectValue placeholder={input.placeholder} /></SelectTrigger>
                    <SelectContent>
                        {input.options?.map((opt: string) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                </Select>
            );
        default:
            return <Input type={input.type || 'text'} placeholder={input.placeholder} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    }
}

export default function EditSabFlowPage() {
    const params = useParams();
    const flowId = params.flowId as string;
    
    const [state, formAction] = useActionState(saveSabFlow, initialState);
    const router = useRouter();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [user, setUser] = useState<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [flowName, setFlowName] = useState('');
    const [trigger, setTrigger] = useState({ type: 'webhook', details: {} });
    const [nodes, setNodes] = useState<SabFlowNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const isNew = flowId === 'new';

    const handleCreateNewFlow = () => {
        setFlowName('New Automation Flow');
        setTrigger({ type: 'webhook', details: {} });
        setNodes([]);
        setSelectedNodeId(null);
    };

    useEffect(() => {
        getSession().then(session => setUser(session?.user));
        if (isNew) {
            handleCreateNewFlow();
            setIsLoading(false);
        } else {
            getSabFlowById(flowId).then(flow => {
                if(flow) {
                    setFlowName(flow.name);
                    setTrigger(flow.trigger);
                    setNodes(flow.nodes);
                }
                setIsLoading(false);
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowId, isNew]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            if (isNew && state.flowId) {
                 router.push(`/dashboard/sabflow/flow-builder/${state.flowId}`);
            } else if (!isNew) {
                router.refresh();
            }
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, isNew]);

    const handleAddNode = () => {
        const newNodeId = `action_${Date.now()}`;
        const newNode: SabFlowNode = {
            id: newNodeId,
            type: 'action',
            data: {
                name: `Action ${nodes.length + 1}`,
                connectionId: '',
                actionName: '',
                inputs: {}
            },
            position: { x: 0, y: (nodes.length + 1) * 120 }
        };
        setNodes([...nodes, newNode]);
        setSelectedNodeId(newNodeId);
    };
    
    const handleRemoveNode = (nodeId: string) => {
        setNodes(nodes.filter(n => n.id !== nodeId));
        if(selectedNodeId === nodeId) setSelectedNodeId(null);
    };

    const handleNodeChange = (nodeId: string, data: any) => {
        setNodes(nodes.map(n => n.id === nodeId ? {...n, data: {...n.data, ...data}} : n));
    };
    
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    const selectedApp = user?.sabFlowConnections?.find((c: any) => c.connectionName === selectedNode?.data.connectionId);
    const selectedAppActions = sabnodeAppActions.find(app => app.appId === selectedApp?.appId)?.actions || [];
    const selectedAction = selectedAppActions.find(a => a.name === selectedNode?.data.actionName);

     if (isLoading) {
        return <BuilderPageSkeleton />;
    }
    
    return (
        <form action={formAction}>
            <input type="hidden" name="flowId" value={isNew ? 'new' : flowId} />
            <input type="hidden" name="name" value={flowName} />
            <input type="hidden" name="trigger" value={JSON.stringify(trigger)} />
            <input type="hidden" name="nodes" value={JSON.stringify(nodes)} />
            <input type="hidden" name="edges" value={JSON.stringify([])} />
            
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
                 <SheetContent className="w-full max-w-sm p-0">
                    <Card className="h-full border-none rounded-none">
                        <CardHeader><CardTitle>Configure Step</CardTitle></CardHeader>
                        <CardContent>
                            {selectedNode ? (
                                <div className="space-y-4">
                                    <div className="space-y-2"><Label>Step Name</Label><Input value={selectedNode.data.name} onChange={e => handleNodeChange(selectedNode.id, { name: e.target.value })}/></div>
                                    <div className="space-y-2">
                                        <Label>App</Label>
                                        <Select value={selectedNode.data.connectionId} onValueChange={val => handleNodeChange(selectedNode.id, { connectionId: val, actionName: '', inputs: {} })}>
                                            <SelectTrigger><SelectValue placeholder="Select a connected app..."/></SelectTrigger>
                                            <SelectContent>
                                                {(user?.sabFlowConnections || []).map((conn: any) => (
                                                    <SelectItem key={conn.connectionName} value={conn.connectionName}>{conn.connectionName}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                     <div className="space-y-2">
                                        <Label>Action</Label>
                                        <Select value={selectedNode.data.actionName} onValueChange={val => handleNodeChange(selectedNode.id, { actionName: val, inputs: {} })}>
                                            <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                            <SelectContent>
                                                {selectedAppActions.map((action: any) => (
                                                    <SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {selectedAction && selectedAction.inputs.map((input: any) => (
                                        <div key={input.name} className="space-y-2">
                                            <Label>{input.label}</Label>
                                            <NodeInput 
                                                input={input}
                                                value={selectedNode.data.inputs[input.name]}
                                                onChange={val => handleNodeChange(selectedNode.id, { inputs: {...selectedNode.data.inputs, [input.name]: val} })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground p-8">Select a step to configure it.</div>
                            )}
                        </CardContent>
                    </Card>
                </SheetContent>
            </Sheet>

            <div className="flex flex-col gap-8">
                 <div className="flex justify-between items-center">
                    <div>
                        <Button variant="ghost" asChild className="-ml-4">
                            <Link href="/dashboard/sabflow/flow-builder"><ArrowLeft className="mr-2 h-4 w-4" />Back to Flows</Link>
                        </Button>
                        <Input 
                            value={flowName} 
                            onChange={(e) => setFlowName(e.target.value)}
                            className="text-3xl font-bold font-headline border-0 shadow-none -ml-3 p-0 h-auto"
                        />
                    </div>
                     <div className="flex items-center gap-2">
                        <Button variant="outline" asChild><Link href="/dashboard/sabflow/docs"><BookOpen className="mr-2 h-4 w-4" />Docs</Link></Button>
                        <SaveButton />
                    </div>
                 </div>

                <div className="grid grid-cols-1 lg:grid-cols-1 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="card-gradient card-gradient-purple">
                            <CardHeader><CardTitle>1. Trigger</CardTitle><CardDescription>Select what starts this automation.</CardDescription></CardHeader>
                            <CardContent>
                                <Select value={trigger.type} onValueChange={(val) => setTrigger({ ...trigger, type: val })}>
                                    <SelectTrigger><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {triggers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>
                        
                        <div className="flex items-center justify-center">
                            <div className="h-8 w-px bg-border"/>
                        </div>
                        
                        {nodes.map((node, index) => (
                            <React.Fragment key={node.id}>
                                 <Card onClick={() => { setSelectedNodeId(node.id); setIsSidebarOpen(true); }} className={`cursor-pointer ${selectedNodeId === node.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}>
                                    <CardHeader className="flex flex-row items-start justify-between">
                                        <div>
                                            <CardTitle>Action {index + 1}: {node.data.name || 'Untitled'}</CardTitle>
                                            <CardDescription>
                                                {user?.sabFlowConnections?.find((c: any) => c.connectionName === node.data.connectionId)?.appName || 'No app selected'}
                                            </CardDescription>
                                        </div>
                                         <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleRemoveNode(node.id) }}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </CardHeader>
                                </Card>
                                 <div className="flex items-center justify-center">
                                    <div className="h-8 w-px bg-border"/>
                                </div>
                            </React.Fragment>
                        ))}
                        
                        <div className="flex justify-center">
                             <Button variant="outline" className="rounded-full" onClick={handleAddNode}>
                                <Plus className="h-5 w-5"/>
                            </Button>
                        </div>
                    </div>
                 </div>
            </div>
        </form>
    );
}
```,
  <change>
    <file>src/app/actions/sabflow.actions.ts</file>
    <content><![CDATA[
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { SabFlow, SabFlowNode, SabFlowEdge, WithId as SabWithId, Project, Contact, SabChatSession, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { sabnodeAppActions } from '@/lib/sabflow-actions';

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
    
    // Find the connection for this action
    const connection = user.sabFlowConnections?.find(c => c.connectionName === node.data.connectionId);
    
    // Lazy-load action modules only when needed
    try {
        const actionModule = await import(`./${actionApp.appId}.actions.ts`);
        const actionFunction = actionModule[actionName];
        
        if (typeof actionFunction !== 'function') {
             const errorMsg = `Action function "${actionName}" not found in module.`;
             logger.log(errorMsg);
             console.error(errorMsg);
             return { error: errorMsg };
        }

        logger.log(`Executing action "${actionName}" with inputs:`, interpolatedInputs);
        const result = await actionFunction({ ...interpolatedInputs, connection });
        logger.log(`Action "${actionName}" completed.`, { result });
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
                // Decide if the flow should stop on error
                break;
            }
            // Add the output of the current node to the context for the next node
            context = { ...context, ...result.output };
        }

        // Logic to determine the next node
        const edge = flow.edges.find(e => e.source === currentNodeId);
        if (currentNode.type === 'condition') {
             const conditionResult = result.output?.conditionMet ?? false; // Assuming the action returns this
             const handle = conditionResult ? `${currentNodeId}-output-yes` : `${currentNodeId}-output-no`;
             const conditionalEdge = flow.edges.find(e => e.sourceHandle === handle);
             currentNodeId = conditionalEdge ? conditionalEdge.target : null;
        } else {
             currentNodeId = edge ? edge.target : null;
        }
    }
    
    logger.log(`Flow execution finished.`);
}

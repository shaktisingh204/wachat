
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

    const handleCreateNewFlow = useCallback(() => {
        setFlowName('New Automation Flow');
        setTrigger({ type: 'webhook', details: {} });
        setNodes([]);
        setSelectedNodeId(null);
    }, []);

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
    }, [flowId, isNew, handleCreateNewFlow]);

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

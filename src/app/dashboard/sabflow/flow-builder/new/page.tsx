'use client';

import { useState, useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { saveSabFlow } from '@/app/actions/sabflow.actions';
import { getSession } from '@/app/actions';
import type { WithId, SabFlow, User, SabFlowNode, SabFlowEdge } from '@/lib/definitions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

import {
  ArrowLeft,
  Save,
  LoaderCircle,
  Plus,
  PlayCircle,
  Zap,
  Trash2,
  MousePointerClick,
  FileUp,
  Settings,
  MoreVertical,
  GripVertical
} from 'lucide-react';


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

const availableConnections: { id: string; name: string }[] = []; // This would be fetched

export default function NewSabFlowPage() {
    const [state, formAction] = useActionState(saveSabFlow, initialState);
    const router = useRouter();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [user, setUser] = useState<any>(null);

    const [flowName, setFlowName] = useState('New Automation Flow');
    const [trigger, setTrigger] = useState({ type: 'webhook', details: {} });
    const [nodes, setNodes] = useState<SabFlowNode[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    useEffect(() => {
        getSession().then(session => {
            setUser(session?.user);
        });
    }, []);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            router.push('/dashboard/sabflow/flow-builder');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router]);

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

    return (
        <form action={formAction}>
            <input type="hidden" name="name" value={flowName} />
            <input type="hidden" name="trigger" value={JSON.stringify(trigger)} />
            <input type="hidden" name="nodes" value={JSON.stringify(nodes)} />
            <input type="hidden" name="edges" value={JSON.stringify([])} />
            
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
                    <SaveButton />
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
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
                                 <Card onClick={() => setSelectedNodeId(node.id)} className={`cursor-pointer ${selectedNodeId === node.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'}`}>
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

                    <div className="lg:col-span-1 sticky top-24">
                        <Card>
                            <CardHeader><CardTitle>Configure Step</CardTitle></CardHeader>
                            <CardContent>
                                {selectedNode ? (
                                    <div className="space-y-4">
                                        <div className="space-y-2"><Label>Step Name</Label><Input value={selectedNode.data.name} onChange={e => handleNodeChange(selectedNode.id, { name: e.target.value })}/></div>
                                        <div className="space-y-2">
                                            <Label>App</Label>
                                            <Select value={selectedNode.data.connectionId} onValueChange={val => handleNodeChange(selectedNode.id, { connectionId: val })}>
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
                                            <Select value={selectedNode.data.actionName} onValueChange={val => handleNodeChange(selectedNode.id, { actionName: val })}>
                                                <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                                <SelectContent>
                                                    {/* This would be dynamically populated */}
                                                     <SelectItem value="send_message">Send WhatsApp Message</SelectItem>
                                                     <SelectItem value="create_deal">Create CRM Deal</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground p-8">Select a step to configure it.</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                 </div>
            </div>
        </form>
    );
}


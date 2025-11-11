
'use client';

import React, { useState, useActionState, useEffect, useRef, useTransition, useCallback, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

import { saveSabFlow, getSabFlowById } from '@/app/actions/sabflow.actions';
import { getSession } from '@/app/actions';
import type { WithId, SabFlow, User, SabFlowNode, SabFlowEdge } from '@/lib/definitions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  BookOpen,
  PanelLeft,
  Maximize,
  Minimize,
  ZoomIn,
  ZoomOut,
  Frame,
  X,
  RefreshCw,
  Copy,
  MoreVertical,
  Webhook,
  Calendar,
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { AppConnectionSetup } from '@/components/wabasimplify/connections/app-connection-setup';


const triggers = [
    { id: 'webhook', name: 'Webhook', icon: Webhook, description: 'Trigger this flow by sending a POST request to a unique URL.' },
    { id: 'manual', name: 'Manual', icon: PlayCircle, description: 'Trigger this flow manually from the UI.' },
    { id: 'schedule', name: 'Schedule', icon: Calendar, description: 'Run this flow on a recurring schedule (e.g., every day).' },
    { id: 'app', name: 'App Trigger', icon: Zap, description: 'Start this flow based on an event from another app.' },
];

function NodeInput({ input, value, onChange }: { input: any, value: any, onChange: (val: any) => void }) {
    switch (input.type) {
        case 'textarea':
            return <Textarea placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
        default:
            return <Input type={input.type || 'text'} placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
    }
}

function BuilderPageSkeleton() {
    return (
      <div className="flex h-screen w-screen bg-background p-2 gap-2">
        <div className="w-60 rounded-lg bg-card p-2">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-16 rounded-lg bg-card p-4">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="flex-1 rounded-lg bg-card p-4">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
}

const PropertiesPanel = ({ user, selectedNode, onNodeChange, onNodeRemove, onConnectionSaved, params }: { user: any, selectedNode: SabFlowNode, onNodeChange: (id: string, data: any) => void, onNodeRemove: (id: string) => void, onConnectionSaved: () => void, params: any }) => {
    if (!selectedNode) return null;
    
    const handleDataChange = (data: any) => {
        onNodeChange(selectedNode.id, { ...selectedNode.data, ...data });
    };

    let selectedConnection = null;
    if (selectedNode.data.connectionId?.endsWith(' Connection')) {
        const appName = selectedNode.data.connectionId.replace(' Connection', '');
        selectedConnection = { appId: sabnodeAppActions.find(a => a.name === appName)?.appId, appName };
    } else {
        selectedConnection = user?.sabFlowConnections?.find((c: any) => c.connectionName === selectedNode.data.connectionId);
    }
    const selectedApp = sabnodeAppActions.find(app => app.appId === (selectedNode.data.appId || selectedConnection?.appId));
    const selectedAction = selectedApp?.actions.find(a => a.name === selectedNode.data.actionName);
    const Icon = selectedApp?.icon || Zap;


    const renderEditorContent = () => {
        const isAction = selectedNode.type === 'action';
        const isCondition = selectedNode.type === 'condition';
        const isTrigger = selectedNode.type === 'trigger';

        if (isAction || (isTrigger && selectedNode.data.triggerType === 'app')) {
            if (!selectedNode.data.connectionId) {
                 const connectedAppIds = new Set(user?.sabFlowConnections?.map((c: any) => c.appId));
                
                 const groupedApps = Object.entries(sabnodeAppActions.reduce((acc, app) => {
                    if (isTrigger && !app.actions.some(a => a.isTrigger)) return acc;
                    const category = app.category || 'SabNode Apps';
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(app);
                    return acc;
                }, {} as Record<string, any[]>));

                return (
                    <div className="space-y-4">
                        <h3 className="font-semibold">{isTrigger ? 'Choose a Trigger App' : 'Choose an App'}</h3>
                         <Accordion type="multiple" defaultValue={['SabNode Apps', 'Core Apps']} className="w-full">
                            {groupedApps.map(([category, apps]: [string, any[]]) => (
                                <AccordionItem key={category} value={category}>
                                    <AccordionTrigger>{category}</AccordionTrigger>
                                    <AccordionContent className="p-2">
                                        <div className="grid grid-cols-5 gap-2">
                                            {apps.map(app => {
                                                const AppIcon = app.icon || Zap;
                                                const isConnected = connectedAppIds.has(app.appId) || app.connectionType === 'internal';
                                                return (
                                                     <button type="button" key={app.appId} 
                                                        className={cn("h-120 w-120 p-2 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center justify-start gap-2 transition-colors")} style={{
                                                            transition: 'box-shadow 300ms cubic-bezier(0.4, 0, 0.2, 1)',
                                                            boxShadow:
                                                              'rgba(145, 158, 171, 0.2) 0px 0px 2px 0px, rgba(145, 158, 171, 0.12) 0px 12px 24px -4px',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            justifyContent: 'center',
                                                            maxWidth: '120px', minHeight: '120px'
                                                          }} 
                                                        onClick={() => {
                                                            if (app.connectionType === 'internal') {
                                                                handleDataChange({ connectionId: `${app.name} Connection`, appId: app.appId, actionName: '', inputs: {} });
                                                            } else if (isConnected) {
                                                                const firstConn = user.sabFlowConnections.find((c: any) => c.appId === app.appId);
                                                                if (firstConn) {
                                                                    handleDataChange({ connectionId: firstConn.connectionName, appId: app.appId, actionName: '', inputs: {} });
                                                                }
                                                            } else {
                                                               handleDataChange({ connectionId: 'new', appId: app.appId });
                                                            }
                                                        }}
                                                    >
                                                        <div className={cn("w-full h-full  flex items-center justify-center bg-white border") } style={{borderRadius: '16px', display: 'contents', maxWidth: '120px', minHeight: '120px' }}>
                                                            <AppIcon className={cn("h-8 w-8", app.iconColor)}/>
                                                        <p className="text-[10px] font-bold text-foreground break-words whitespace-normal leading-tight">{app.name}</p>
                                                            
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                );
            } else if (selectedNode.data.connectionId === 'new' && selectedApp) {
                return <AppConnectionSetup app={selectedApp} onConnectionSaved={onConnectionSaved} flowId={params.flowId} />;
            }
            else {
                const actionOptions = selectedApp?.actions.filter(a => isTrigger ? a.isTrigger : !a.isTrigger) || [];
                return (
                    <>
                        <div className="space-y-2">
                            <Label>Action</Label>
                            <Select value={selectedNode.data.actionName} onValueChange={val => handleDataChange({ actionName: val, inputs: {} })}>
                                <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                                <SelectContent>
                                    {actionOptions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedAction && (
                             <div className="space-y-4 pt-4 border-t">
                                <h4 className="font-semibold">{selectedAction.label}</h4>
                                <p className="text-sm text-muted-foreground">{selectedAction.description}</p>
                                {selectedAction.inputs.map((input: any) => (<div key={input.name} className="space-y-2"><Label>{input.label}</Label><NodeInput input={input} value={selectedNode.data.inputs[input.name] || ''} onChange={val => handleDataChange({ inputs: {...selectedNode.data.inputs, [input.name]: val} })}/></div>))}
                            </div>
                        )}
                    </>
                );
            }
        }

        if (isTrigger) {
             const selectedTrigger = triggers.find(t => t.id === selectedNode.data.triggerType);
             
             return (
                <div className="space-y-2">
                    <Label>Trigger Type</Label>
                    <Select value={selectedNode.data.triggerType} onValueChange={val => handleDataChange({ triggerType: val, connectionId: '', appId: '', actionName: '', inputs: {} })}>
                        <SelectTrigger><SelectValue placeholder="Select a trigger"/></SelectTrigger>
                        <SelectContent>
                            {triggers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {selectedTrigger && <p className="text-xs text-muted-foreground">{selectedTrigger.description}</p>}
                    {selectedTrigger?.id === 'webhook' && (
                        <div className="pt-4">
                            <Label>Webhook URL</Label>
                            <CodeBlock code={`${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${params.flowId}`} />
                        </div>
                    )}
                </div>
            );
        }

        if (isCondition) {
            const rules = selectedNode.data.rules || [{ field: '', operator: 'equals', value: '' }];
            const handleRuleChange = (index: number, field: string, value: string) => {
                const newRules = [...rules];
                newRules[index] = { ...newRules[index], [field]: value };
                handleDataChange({ rules: newRules });
            };
            const addRule = () => handleDataChange({ rules: [...rules, { field: '', operator: 'equals', value: '' }]});
            const removeRule = (index: number) => handleDataChange({ rules: rules.filter((_: any, i: number) => i !== index) });

            return (
                <div className="space-y-4">
                    <RadioGroup value={selectedNode.data.logicType || 'AND'} onValueChange={(val) => handleDataChange({ logicType: val })} className="flex gap-4"><div className="flex items-center space-x-2"><RadioGroupItem value="AND" id="logic-and"/><Label htmlFor="logic-and">Match ALL conditions (AND)</Label></div><div className="flex items-center space-x-2"><RadioGroupItem value="OR" id="logic-or"/><Label htmlFor="logic-or">Match ANY condition (OR)</Label></div></RadioGroup>
                    
                    <div className="space-y-3">
                        {rules.map((rule: any, index: number) => (<div key={index} className="p-3 border rounded-md space-y-2 relative">
                            <Button variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6" onClick={() => removeRule(index)}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                            <Input placeholder="Variable e.g. {{trigger.name}}" value={rule.field} onChange={e => handleRuleChange(index, 'field', e.target.value)} />
                            <Select value={rule.operator} onValueChange={val => handleRuleChange(index, 'operator', val)}>
                                <SelectTrigger><SelectValue placeholder="Select operator..."/></SelectTrigger>
                                <SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="not_equals">Not Equals</SelectItem><SelectItem value="contains">Contains</SelectItem></SelectContent>
                            </Select>
                            <Input placeholder="Value" value={rule.value} onChange={e => handleRuleChange(index, 'value', e.target.value)} />
                        </div>))}
                    </div>
                    <Button variant="outline" size="sm" onClick={addRule}><Plus className="mr-2 h-4 w-4"/>Add Condition</Button>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="h-full flex flex-col " style={{ minWidth: '35%', background: 'white' }}>
            <div className="p-4 border-b flex-shrink-0">
                <h3 className="text-lg font-semibold">Properties</h3>
                <p className="text-sm text-muted-foreground">Configure the selected step.</p>
            </div>
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                    <div className="space-y-2">
                        <Label>Step Name</Label>
                        <Input value={selectedNode.data.name} onChange={e => handleDataChange({ name: e.target.value })}/>
                    </div>
                    <Separator />
                    {selectedApp && selectedNode.type === 'action' && (
                        <div className="flex items-center gap-2">
                             <Button variant="ghost" size="sm" onClick={() => handleDataChange({ connectionId: '', actionName: '', inputs: {} })}>
                                <ArrowLeft className="mr-2 h-4 w-4"/> Change App
                            </Button>
                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-sm">
                                <Icon className={cn("h-5 w-5", selectedApp.iconColor)} />
                                <span className="font-semibold">{selectedApp.name}</span>
                            </div>
                        </div>
                    )}
                    {renderEditorContent()}
                </div>
            </ScrollArea>
            {selectedNode?.type !== 'trigger' && (
                <div className="p-4 border-t flex-shrink-0">
                    <Button variant="destructive" className="w-full" onClick={() => onNodeRemove(selectedNode.id)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Step
                    </Button>
                </div>
            )}
        </div>
    );
};

const NodeComponent = ({ user, node, onSelectNode, isSelected, onNodeMouseDown, onAddNode }: { user: any, node: SabFlowNode; onSelectNode: (id: string) => void; isSelected: boolean; onNodeMouseDown: (e: React.MouseEvent, nodeId: string) => void; onAddNode: (type: 'action' | 'condition', sourceNodeId: string, sourceHandle?: string) => void; }) => {
    
    const subText = useMemo(() => {
        if (node.type === 'trigger') {
            const triggerType = triggers.find(t => t.id === node.data.triggerType);
            return triggerType?.name || 'Trigger';
        }
        if (node.type === 'condition') {
            return 'Branching Logic';
        }
        
        let appConfig;
        if (node.data.connectionId?.endsWith(' Connection')) {
            const appName = node.data.connectionId.replace(' Connection', '');
            appConfig = sabnodeAppActions.find(a => a.name === appName);
        } else {
            const app = user?.sabFlowConnections?.find((c: any) => c.connectionName === node.data.connectionId);
            appConfig = sabnodeAppActions.find(a => a.appId === app?.appId);
        }
        
        if (appConfig) {
            if (node.data.actionName) {
                 const action = appConfig.actions.find(a => a.name === node.data.actionName);
                 if(action) return action.label;
            }
            return appConfig.name;
        }
        
        return 'Select action';
    }, [node, user?.sabFlowConnections]);


    let appConfig;
    if (node.data.connectionId?.endsWith(' Connection')) {
        const appName = node.data.connectionId.replace(' Connection', '');
        appConfig = sabnodeAppActions.find(a => a.name === appName);
    } else {
        const app = user?.sabFlowConnections?.find((c: any) => c.connectionName === node.data.connectionId);
        appConfig = sabnodeAppActions.find(a => a.appId === app?.appId);
    }
    
    const Icon = node.type === 'trigger'
        ? triggers.find(t => t.id === node.data.triggerType)?.icon || Zap
        : appConfig?.icon || (node.type === 'condition' ? GitFork : Zap);
    
    return (
        <div
            key={node.id}
            data-node-id={node.id}
            className="absolute transition-all text-center flex flex-col items-center"
            style={{ left: node.position.x, top: node.position.y }}
        >
            {node.type === 'trigger' && (
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Start of Flow</div>
            )}
            <div
                className="relative"
                onMouseDown={e => onNodeMouseDown(e, node.id)}
                onClick={e => { e.stopPropagation(); onSelectNode(node.id) }}
            >
                 <div
                    className={cn(
                        "w-32 h-32 rounded-[40px] cursor-pointer flex flex-col items-center justify-center p-4 bg-white",
                        isSelected && 'ring-2 ring-primary'
                    )}
                    style={{ filter: 'drop-shadow(rgba(0, 0, 0, 0.15) 0px 5px 6px)' }}
                >
                    <div className={cn("w-16 h-16 rounded-full flex items-center justify-center")}>
                        <Icon className={cn("h-8 w-8 text-primary", appConfig?.iconColor)}/>
                    </div>
                </div>
                {node.type !== 'start' && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border shadow-md flex items-center justify-center">
                        <div className="w-5 h-5 rounded-full bg-gray-300 hover:bg-primary transition-colors cursor-pointer" />
                    </div>
                )}
            </div>
            
            <div className="mt-2 w-32">
                <p className="font-bold text-sm text-black truncate">{node.data.name || 'Untitled'}</p>
                <p className="text-xs text-muted-foreground truncate">{subText}</p>
            </div>

            {node.type !== 'end' && (
                <div className="w-full flex justify-center mt-2">
                    <div className="w-0.5 h-6 bg-gray-300"></div>
                </div>
            )}

            {node.type !== 'end' && (
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="h-8 w-8 rounded-full bg-white border shadow-md flex items-center justify-center hover:bg-gray-100 transition-all cursor-pointer z-10">
                            <Plus className="h-5 w-5 text-gray-500"/>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2">
                        <div className="space-y-1">
                            <Button variant="ghost" className="w-full justify-start" onClick={() => onAddNode('action', node.id)}>Action</Button>
                            <Button variant="ghost" className="w-full justify-start" onClick={() => onAddNode('condition', node.id)}>Condition</Button>
                        </div>
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
};

export default function EditSabFlowPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const flowId = params.flowId as string;
    
    const initialState = { message: null, error: null, flowId: undefined };
    const [state, formAction] = useActionState(saveSabFlow, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const [user, setUser] = useState<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [flowName, setFlowName] = useState('');
    const [nodes, setNodes] = useState<SabFlowNode[]>([]);
    const [edges, setEdges] = useState<SabFlowEdge[]>([]);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [pan, setPan] = useState({ x: 200, y: 150 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [draggingNode, setDraggingNode] = useState<string | null>(null);
    const [isFullScreen, setIsFullScreen] = useState(false);
    
    const fetchConnections = useCallback(async () => {
        const session = await getSession();
        setUser(session?.user);
    }, []);

    useEffect(() => {
        fetchConnections();
        getSabFlowById(flowId).then(flow => {
            if(flow) {
                setFlowName(flow.name);
                setNodes(flow.nodes || []);
                setEdges(flow.edges || []);
            }
            setIsLoading(false);
        });
    }, [flowId, fetchConnections]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            if (state.flowId && flowId === 'new-flow') {
                 router.replace(`/dashboard/sabflow/flow-builder/${state.flowId}`, { scroll: false });
            } else {
                router.refresh();
            }
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, router, flowId]);
    
    useEffect(() => {
        if (selectedNodeId) {
            setIsSidebarOpen(true);
        }
    }, [selectedNodeId]);

    const handleAddNode = async (type: 'action' | 'condition', sourceNodeId: string, sourceHandle?: string) => {
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        const newNodeId = `${type}_${Date.now()}`;
        const newNode: SabFlowNode = {
            id: newNodeId,
            type: type,
            data: { name: `New ${type}`, connectionId: '', actionName: '', inputs: {} },
            position: { x: sourceNode.position.x, y: sourceNode.position.y + 200 }
        };
        const newEdge: SabFlowEdge = {
            id: `edge-${sourceNodeId}-${newNodeId}`,
            source: sourceNodeId,
            target: newNodeId,
            sourceHandle: sourceHandle || `${sourceNodeId}-output-main`,
            targetHandle: `${newNodeId}-input`,
        };

        setNodes(prev => [...prev, newNode]);
        setEdges(prev => [...prev, newEdge]);
        setSelectedNodeId(newNodeId);
        setIsSidebarOpen(true);
    };
    
    const handleRemoveNode = (nodeId: string) => {
        setNodes(nodes.filter(n => n.id !== nodeId));
        setEdges(edges.filter(e => e.source !== nodeId && e.target !== nodeId));
        if(selectedNodeId === nodeId) setSelectedNodeId(null);
    };
    
    const handleNodeChange = (nodeId: string, data: any) => {
        setNodes(nodes.map(n => n.id === nodeId ? {...n, data: {...n.data, ...data}} : n));
    };

    const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => { 
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation(); setDraggingNode(nodeId); 
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => { 
        if (e.button !== 0) return;
        if (e.target === e.currentTarget) { e.preventDefault(); setIsPanning(true); }
    };
    
    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setPan(prev => ({ x: prev.x + e.movementX, y: prev.y + e.movementY }));
        } else if (draggingNode) {
            setNodes(prev => prev.map(n => n.id === draggingNode ? { ...n, position: { x: n.position.x + e.movementX / zoom, y: n.position.y + e.movementY / zoom } } : n));
        }
    };
    
    const handleCanvasMouseUp = () => { setIsPanning(false); setDraggingNode(null); };
    const handleCanvasClick = (e: React.MouseEvent) => { if (e.target === e.currentTarget) { setSelectedNodeId(null); }};

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (!viewportRef.current) return;
    
        const rect = viewportRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
    
        const zoomFactor = -0.001;
        const newZoom = Math.max(0.25, Math.min(2.5, zoom + e.deltaY * zoomFactor));
        
        const worldX = (mouseX - pan.x) / zoom;
        const worldY = (mouseY - pan.y) / zoom;
        
        const newPanX = mouseX - worldX * newZoom;
        const newPanY = mouseY - worldY * newZoom;
    
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    };

    const handleZoomControls = (direction: 'in' | 'out' | 'reset') => {
        if(direction === 'reset') { setZoom(1); setPan({ x: 200, y: 150 }); return; }
        const newZoom = direction === 'in' ? zoom * 1.2 : zoom / 1.2;
        setZoom(Math.max(0.25, Math.min(2.5, newZoom)));
    };

    const handleToggleFullScreen = () => {
        const elem = document.querySelector('.sabflow-builder-container');
        if (!elem) return;

        if (!document.fullscreenElement) {
            elem.requestFullscreen().catch(err => {
                alert(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            document.exitFullscreen?.();
        }
    };

    useEffect(() => {
        const handleFullScreenChange = () => setIsFullScreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullScreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
    }, []);
    
    const selectedNode = nodes.find(n => n.id === selectedNodeId);
    
    const getEdgePath = (sourcePos: { x: number; y: number }, targetPos: { x: number; y: number }) => {
        if (!sourcePos || !targetPos) return '';
        const dx = 0; // Vertical alignment
        const dy = Math.max(50, Math.abs(sourcePos.y - targetPos.y) * 0.5);
        const path = `M ${sourcePos.x} ${sourcePos.y} C ${sourcePos.x + dx} ${sourcePos.y + dy}, ${targetPos.x - dx} ${targetPos.y - dy}, ${targetPos.x} ${targetPos.y}`;
        return path;
    };
    
    const getNodeHandlePosition = (node: SabFlowNode, handleId: string) => {
        if (!node || !handleId) return null;
        const NODE_WIDTH = 128;
        const x = node.position.x;
        const y = node.position.y;
        
        if (handleId.endsWith('-input')) {
            return { x: x + NODE_WIDTH / 2, y: y };
        }
        
        const isYes = handleId.endsWith('-output-yes');
        const isNo = handleId.endsWith('-output-no');
        
        if (isYes || isNo) {
            return { x: x + (isYes ? NODE_WIDTH * 0.25 : NODE_WIDTH * 0.75), y: y + NODE_WIDTH };
        }
        
        return { x: x + NODE_WIDTH / 2, y: y + NODE_WIDTH };
    };


    if (isLoading) {
        return <BuilderPageSkeleton />;
    }

    return (
        <div className="h-full">
            <div className="flex h-full w-full flex-col bg-muted/30">
                <header className="relative flex-shrink-0 flex items-center justify-between p-3 border-b bg-card">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" asChild className="h-9 px-2">
                            <Link href="/dashboard/sabflow/flow-builder"><ArrowLeft className="h-4 w-4" />Back</Link>
                        </Button>
                        <Input value={flowName} onChange={(e) => setFlowName(e.target.value)} className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild><Link href="/dashboard/sabflow/docs"><BookOpen className="mr-2 h-4 w-4" />Docs</Link></Button>
                        <Button onClick={() => formRef.current?.requestSubmit()}><Save className="mr-2 h-4 w-4" />Save</Button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    <main
                        ref={viewportRef}
                        className="flex-1 w-full h-full min-h-0 overflow-hidden relative cursor-grab active:cursor-grabbing sabflow-builder-container"
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseUp}
                        onWheel={handleWheel}
                        onClick={handleCanvasClick}
                    >
                        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.4) 1px, transparent 0)', backgroundSize: '20px 20px', backgroundPosition: `${pan.x}px ${pan.y}px` }}/>
                        <div className="relative w-full h-full" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                             {nodes.map(node => (
                                <NodeComponent key={node.id} user={user} node={node} onSelectNode={setSelectedNodeId} isSelected={selectedNodeId === node.id} onNodeMouseDown={handleNodeMouseDown} onAddNode={handleAddNode}/>
                            ))}
                            <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '10000px', height: '10000px', transformOrigin: 'top left' }}>
                                <defs><marker id="arrowhead" viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,-5L10,0L0,5" fill="hsla(215, 89%, 48%, 0.5)" /></marker></defs>
                                {edges.map(edge => {
                                    const sourceNode = nodes.find(n => n.id === edge.source);
                                    const targetNode = nodes.find(n => n.id === edge.target);
                                    if (!sourceNode || !targetNode) return null;
                                    const sourcePos = getNodeHandlePosition(sourceNode, edge.sourceHandle || `${edge.source}-output-main`);
                                    const targetPos = getNodeHandlePosition(targetNode, edge.targetHandle || `${edge.target}-input`);
                                    if (!sourcePos || !targetPos) return null;
                                    return <path key={edge.id} d={getEdgePath(sourcePos, targetPos)} stroke="hsla(215, 89%, 48%, 0.5)" strokeWidth="2" fill="none" className="sabflow-edge-path" markerEnd="url(#arrowhead)" />
                                })}
                            </svg>
                        </div>
                        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('out')}><ZoomOut className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('in')}><ZoomIn className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={() => handleZoomControls('reset')}><Frame className="h-4 w-4" /></Button>
                            <Button variant="outline" size="icon" onClick={handleToggleFullScreen}>{isFullScreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</Button>
                        </div>
                    </main>
                    <Sheet open={isSidebarOpen && !!selectedNodeId} onOpenChange={setIsSidebarOpen}>
                        <SheetContent className="p-0 flex flex-col" style={{ minWidth: '40%' }}>
                            {selectedNodeId && nodes.find(n => n.id === selectedNodeId) ? (
                                <PropertiesPanel user={user} selectedNode={nodes.find(n => n.id === selectedNodeId)!} onNodeChange={handleNodeChange} onNodeRemove={handleRemoveNode} onConnectionSaved={fetchConnections} params={params}/>
                            ) : null}
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
            <form ref={formRef} action={formAction} className="hidden">
                 <input type="hidden" name="flowId" value={flowId} />
                 <input type="hidden" name="name" value={flowName} />
                 <input type="hidden" name="nodes" value={JSON.stringify(nodes)} />
                 <input type="hidden" name="edges" value={JSON.stringify(edges)} />
                 <input type="hidden" name="trigger" value={JSON.stringify(nodes.find(n => n.type === 'trigger')?.data || {})} />
            </form>
        </div>
    );
}

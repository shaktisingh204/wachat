
'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useProject } from '@/context/project-context';
import { getInvitedUsers } from '@/app/actions/team.actions';
import { getChatSessionsForUser } from '@/app/actions/sabchat.actions';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { SabFlowNode } from '@/lib/definitions';
import { SabFlowNodeInput } from './SabFlowNodeInput';
import { ApiRequestEditor } from '@/components/wabasimplify/sabflow/api-request-editor';
import { AppConnectionSetup } from '@/components/wabasimplify/sabflow/connections/app-connection-setup';
import { CodeBlock } from '@/components/wabasimplify/code-block';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    ArrowLeft,
    Trash2,
    Plus,
    Zap,
    GitFork,
    PlayCircle,
    Calendar,
    Webhook
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Node } from '@xyflow/react';

const triggers = [
    { id: 'webhook', name: 'Webhook', icon: Webhook, description: 'Trigger this flow by sending a POST request to a unique URL.' },
    { id: 'manual', name: 'Manual', icon: PlayCircle, description: 'Trigger this flow manually from the UI.' },
    { id: 'schedule', name: 'Schedule', icon: Calendar, description: 'Run this flow on a recurring schedule (e.g., every day).' },
    { id: 'app', name: 'App Trigger', icon: Zap, description: 'Start this flow based on an event from another app.' },
];

interface SabFlowPropertiesPanelProps {
    node: Node | SabFlowNode;
    onUpdate: (id: string, data: any) => void;
    deleteNode: (id: string) => void;
    user: any;
    flowId: string;
    onConnectionSaved?: () => void;
}

export function SabFlowPropertiesPanel({ node, onUpdate, deleteNode, user, flowId, onConnectionSaved }: SabFlowPropertiesPanelProps) {
    const { projects } = useProject();
    const wachatProjects = projects.filter(p => p.wabaId);
    const facebookProjects = projects.filter(p => p.facebookPageId && !p.wabaId);

    const [dynamicData, setDynamicData] = useState<any>({
        projects: wachatProjects.map(p => ({ value: p._id, label: p.name })),
        facebookProjects: facebookProjects.map(p => ({ value: p._id, label: p.name })),
        agents: [],
        sabChatSessions: [],
    });

    const [isLoadingData, startDataLoad] = useTransition();
    const [requestTab, setRequestTab] = useState('params'); // For API editor state persistence if needed
    const [imageSourceType, setImageSourceType] = useState('url');

    const selectedNodeData = node.data as any;

    useEffect(() => {
        if (selectedNodeData?.actionName === 'sendImage') {
            if (selectedNodeData.inputs?.imageBase64) setImageSourceType('base64');
            else if (selectedNodeData.inputs?.imageFile) setImageSourceType('file');
            else setImageSourceType('url');
        }
    }, [selectedNodeData]);

    useEffect(() => {
        startDataLoad(async () => {
            try {
                const [fetchedAgents, fetchedSessions] = await Promise.all([
                    getInvitedUsers(),
                    getChatSessionsForUser()
                ]);

                setDynamicData((prev: any) => ({
                    ...prev,
                    agents: fetchedAgents.map((a: any) => ({ value: a._id.toString(), label: a.name })),
                    sabChatSessions: fetchedSessions.map((s: any) => ({ value: s._id.toString(), label: `${s.visitorInfo?.email || 'Visitor'} - ${s._id.toString().slice(-6)}` }))
                }));
            } catch (error) {
                console.error("Failed to load dynamic data", error);
            }
        });
    }, [projects]); // Refresh if projects change, though mostly run once

    const handleDataChange = (data: any) => {
        onUpdate(node.id, { ...selectedNodeData, ...data });
    };

    const handleInputChange = (name: string, value: any) => {
        handleDataChange({
            inputs: { ...selectedNodeData.inputs, [name]: value }
        });
    }

    const handleInputDirect = (name: string, value: any) => {
        const newInputs = { ...selectedNodeData.inputs, [name]: value };
        onUpdate(node.id, { ...selectedNodeData, inputs: newInputs });
    };

    const handleImageSourceChange = (type: string) => {
        setImageSourceType(type);
        // Clear other sources when switching
        const newInputs = { ...selectedNodeData.inputs };
        if (type !== 'url') delete newInputs.mediaUrl;
        if (type !== 'base64') delete newInputs.imageBase64;
        if (type !== 'file') delete newInputs.imageFile;
        handleDataChange({ inputs: newInputs });
    }

    const renderEditorContent = () => {
        const isAction = node.type === 'action';
        const isCondition = node.type === 'condition';
        const isTrigger = node.type === 'trigger';

        if (isAction) {
            const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNodeData.appId);
            let selectedAction = selectedApp?.actions?.find(a => a.name === selectedNodeData.actionName);

            if (selectedNodeData.actionName === 'apiRequest') {
                selectedAction = { name: 'apiRequest', label: 'API Request', description: 'Make a GET, POST, PUT, or DELETE request.', inputs: [] };
            }

            if (!selectedApp) {
                const groupedApps = Object.entries(sabnodeAppActions.reduce((acc, app) => {
                    if (!app.actions || app.actions.every(a => a.isTrigger)) return acc;
                    const category = app.category || 'SabNode Apps';
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(app);
                    return acc;
                }, {} as Record<string, any[]>));

                return (
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm">Choose an App</h3>
                        <Accordion type="single" collapsible defaultValue="SabNode Apps" className="w-full">
                            {groupedApps.map(([category, apps]: [string, any[]]) => (
                                <AccordionItem key={category} value={category}>
                                    <AccordionTrigger className="text-sm font-medium py-2">{category}</AccordionTrigger>
                                    <AccordionContent className="p-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            {apps.map(app => {
                                                const AppIcon = app.icon || Zap;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={app.appId}
                                                        className="p-3 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center justify-center gap-2 transition-all border bg-card hover:shadow-sm"
                                                        onClick={() => {
                                                            const actionName = (app.actions && app.actions.length === 1) ? app.actions[0].name : '';
                                                            handleDataChange({ appId: app.appId, actionName: actionName, inputs: {} });
                                                        }}
                                                    >
                                                        <AppIcon className={cn("h-6 w-6", app.iconColor)} />
                                                        <span className="text-xs font-medium break-words leading-tight">{app.name}</span>
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
            }

            if (selectedNodeData.actionName === 'apiRequest') {
                return <ApiRequestEditor data={selectedNodeData} onUpdate={handleDataChange} />;
            }

            // Special handling for Send Image in Wachat (matches original code)
            if (selectedNodeData.actionName === 'sendImage' && selectedApp.appId === 'wachat') {
                return (
                    <div className="space-y-4">
                        <Label>Image Source</Label>
                        <RadioGroup value={imageSourceType} onValueChange={handleImageSourceChange} className="flex gap-4">
                            <div className="flex items-center space-x-1"><RadioGroupItem value="url" id="img-url" /><Label htmlFor="img-url" className="text-xs font-normal cursor-pointer">URL</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="file" id="img-file" /><Label htmlFor="img-file" className="text-xs font-normal cursor-pointer">Upload</Label></div>
                            <div className="flex items-center space-x-1"><RadioGroupItem value="base64" id="img-base64" /><Label htmlFor="img-base64" className="text-xs font-normal cursor-pointer">Base64</Label></div>
                        </RadioGroup>

                        <Separator className="my-2" />

                        {imageSourceType === 'url' && (
                            <div className="space-y-2">
                                <Label>Image URL</Label>
                                <Input
                                    placeholder="https://..."
                                    value={selectedNodeData.inputs?.mediaUrl || ''}
                                    onChange={e => handleInputDirect('mediaUrl', e.target.value)}
                                />
                            </div>
                        )}
                        {imageSourceType === 'file' && (
                            <div className="space-y-2">
                                <Label>Upload Image</Label>
                                <Input type="file" accept="image/*" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => handleInputDirect('imageBase64', reader.result);
                                        reader.readAsDataURL(file);
                                    }
                                }} />
                                <p className="text-[10px] text-muted-foreground">Image will be converted to Base64 (max size limits apply).</p>
                            </div>
                        )}
                        {imageSourceType === 'base64' && (
                            <div className="space-y-2">
                                <Label>Base64 Data</Label>
                                <Textarea
                                    placeholder="data:image/png;base64,..."
                                    value={selectedNodeData.inputs?.imageBase64 || ''}
                                    onChange={e => handleInputDirect('imageBase64', e.target.value)}
                                    className="h-24 font-mono text-xs"
                                />
                            </div>
                        )}

                        {/* Common fields for Send Image */}
                        {selectedAction && selectedAction.inputs.filter(i => !['mediaUrl', 'imageBase64', 'imageFile'].includes(i.name)).map((input: any) => (
                            <div key={input.name} className="space-y-2">
                                <Label>{input.label}</Label>
                                <SabFlowNodeInput
                                    input={input}
                                    value={selectedNodeData.inputs?.[input.name] || ''}
                                    onChange={val => handleInputDirect(input.name, val)}
                                    dataOptions={dynamicData}
                                />
                            </div>
                        ))}
                    </div>
                );
            }

            if (selectedAction && selectedAction.inputs.length > 0) {
                return (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">{selectedAction.description}</p>
                        {selectedAction.inputs.map((input: any) => (
                            <div key={input.name} className="space-y-2">
                                <Label className="flex items-center justify-between">
                                    {input.label}
                                    {input.required && <span className="text-destructive text-[10px] ml-1">*Required</span>}
                                </Label>
                                <SabFlowNodeInput
                                    input={input}
                                    value={selectedNodeData.inputs?.[input.name] || ''}
                                    onChange={val => handleInputDirect(input.name, val)}
                                    dataOptions={dynamicData}
                                />
                            </div>
                        ))}
                    </div>
                );
            }

            if (selectedApp?.actions) {
                const actionOptions = selectedApp.actions.filter(a => isTrigger ? a.isTrigger : !a.isTrigger) || [];
                if (actionOptions.length > 1) {
                    return (
                        <div className="space-y-2">
                            <Label>Select Action</Label>
                            <Select value={selectedNodeData.actionName} onValueChange={val => handleDataChange({ actionName: val, inputs: {} })}>
                                <SelectTrigger><SelectValue placeholder="Select an action..." /></SelectTrigger>
                                <SelectContent>
                                    {actionOptions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                } else if (actionOptions.length === 1 && !selectedNodeData.actionName) {
                    // Auto-select if only one action
                    setTimeout(() => handleDataChange({ actionName: actionOptions[0].name, inputs: {} }), 0);
                }
            }

            if (selectedAction && selectedAction.inputs.length === 0) {
                return <p className="text-sm text-muted-foreground text-center pt-4 italic">No configuration needed for this action.</p>;
            }

            return <p className="text-sm text-muted-foreground text-center pt-4">Select an action above.</p>;
        }

        if (isTrigger) {
            const triggerType = selectedNodeData.triggerType || 'webhook';
            const selectedTriggerInfo = triggers.find(t => t.id === triggerType);
            const triggerApps = sabnodeAppActions.filter(app => app.actions?.some(a => a.isTrigger === true));

            const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNodeData.appId);
            const selectedAction = selectedApp?.actions?.find(a => a.isTrigger);

            return (
                <div className="space-y-6">
                    <div className="space-y-3">
                        <Label>Trigger Type</Label>
                        <RadioGroup value={triggerType} onValueChange={(val) => handleDataChange({ triggerType: val })} className="grid grid-cols-2 gap-2">
                            {triggers.map(t => (
                                <div key={t.id}>
                                    <RadioGroupItem value={t.id} id={t.id} className="sr-only" />
                                    <Label
                                        htmlFor={t.id}
                                        className={cn(
                                            "flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all",
                                            triggerType === t.id && "border-primary bg-primary/5"
                                        )}
                                    >
                                        <t.icon className="mb-2 h-5 w-5" />
                                        {t.name}
                                    </Label>
                                </div>
                            ))}
                        </RadioGroup>
                    </div>

                    {selectedTriggerInfo && <p className="text-xs text-muted-foreground bg-muted p-2 rounded-md border">{selectedTriggerInfo.description}</p>}

                    {triggerType === 'webhook' && (
                        <div className="space-y-2">
                            <Label>Webhook URL</Label>
                            <CodeBlock code={`${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${flowId}`} />
                            <p className="text-[10px] text-muted-foreground">Make a POST request to this URL to trigger this flow.</p>
                        </div>
                    )}

                    {triggerType === 'app' && (
                        <div className="space-y-4">
                            <Label>Select Trigger App</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {triggerApps.map(app => {
                                    const AppIcon = app.icon || Zap;
                                    const isSelected = selectedNodeData.appId === app.appId;
                                    return (
                                        <button
                                            type="button"
                                            key={app.appId}
                                            className={cn(
                                                "p-3 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center justify-center gap-2 transition-all border",
                                                isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : 'bg-card'
                                            )}
                                            onClick={() => {
                                                const triggerAction = app.actions.find(a => a.isTrigger);
                                                handleDataChange({ appId: app.appId, actionName: triggerAction?.name, inputs: {} });
                                            }}
                                        >
                                            <AppIcon className={cn("h-6 w-6", app.iconColor)} />
                                            <span className="text-xs font-medium break-words leading-tight">{app.name}</span>
                                        </button>
                                    )
                                })}
                            </div>
                            {selectedApp && selectedAction && selectedAction.isTrigger && (
                                <div className="pt-2">
                                    <Separator className="mb-4" />
                                    <AppConnectionSetup app={selectedApp} flowId={flowId} onConnectionSaved={onConnectionSaved || (() => { })} />
                                    {selectedAction.inputs?.length > 0 && (
                                        <div className="space-y-4 mt-4">
                                            {selectedAction.inputs.map((input: any) => (
                                                <div key={input.name} className="space-y-2">
                                                    <Label>{input.label}</Label>
                                                    <SabFlowNodeInput
                                                        input={input}
                                                        value={selectedNodeData.inputs?.[input.name] || ''}
                                                        onChange={val => handleInputDirect(input.name, val)}
                                                        dataOptions={dynamicData}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            );
        }

        if (isCondition) {
            const rules = selectedNodeData.rules || [{ field: '', operator: 'equals', value: '' }];

            const handleRuleChange = (index: number, field: string, value: string) => {
                const newRules = [...rules];
                newRules[index] = { ...newRules[index], [field]: value };
                handleDataChange({ rules: newRules });
            };
            const addRule = () => handleDataChange({ rules: [...rules, { field: '', operator: 'equals', value: '' }] });
            const removeRule = (index: number) => handleDataChange({ rules: rules.filter((_: any, i: number) => i !== index) });

            return (
                <div className="space-y-6">
                    <div className="space-y-2">
                        <Label>Logic Type</Label>
                        <RadioGroup value={selectedNodeData.logicType || 'AND'} onValueChange={(val) => handleDataChange({ logicType: val })} className="flex flex-col gap-2">
                            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-accent transition-colors"><RadioGroupItem value="AND" id="logic-and" /><Label htmlFor="logic-and" className="font-normal cursor-pointer flex-1">Match ALL conditions (AND)</Label></div>
                            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-accent transition-colors"><RadioGroupItem value="OR" id="logic-or" /><Label htmlFor="logic-or" className="font-normal cursor-pointer flex-1">Match ANY condition (OR)</Label></div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-4">
                        <Label>Conditions</Label>
                        {rules.map((rule: any, index: number) => (
                            <div key={index} className="p-3 border rounded-md space-y-2 relative bg-card">
                                {rules.length > 1 && (
                                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => removeRule(index)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                                <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Variable</Label>
                                    <Input placeholder="{{trigger.name}}" value={rule.field} onChange={e => handleRuleChange(index, 'field', e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Operator</Label>
                                        <Select value={rule.operator} onValueChange={val => handleRuleChange(index, 'operator', val)}>
                                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="equals">Equals</SelectItem>
                                                <SelectItem value="not_equals">Does Not Equal</SelectItem>
                                                <SelectItem value="contains">Contains</SelectItem>
                                                <SelectItem value="starts_with">Starts With</SelectItem>
                                                <SelectItem value="ends_with">Ends With</SelectItem>
                                                <SelectItem value="gt">Greater Than</SelectItem>
                                                <SelectItem value="lt">Less Than</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Value</Label>
                                        <Input placeholder="Value" value={rule.value} onChange={e => handleRuleChange(index, 'value', e.target.value)} className="h-8 text-sm" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addRule} className="w-full"><Plus className="mr-2 h-3 w-3" />Add Condition Rule</Button>
                    </div>
                </div>
            );
        }
        return null;
    };

    const isAction = node.type === 'action';
    const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNodeData.appId);

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="p-4 border-b shrink-0 flex items-center justify-between sticky top-0 bg-background z-10">
                <div>
                    <h3 className="text-lg font-semibold leading-none mb-1">Properties</h3>
                    <p className="text-xs text-muted-foreground">Configure step settings</p>
                </div>
                {node.type !== 'start' && node.type !== 'trigger' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteNode(node.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    <div className="space-y-2">
                        <Label>Step Name</Label>
                        <Input value={selectedNodeData.name} onChange={e => handleDataChange({ name: e.target.value })} placeholder="Name your step" />
                    </div>

                    <Separator />

                    {selectedApp && isAction && (
                        <div className="flex items-center justify-between bg-muted/50 p-2 rounded-md border">
                            <div className="flex items-center gap-2">
                                <selectedApp.icon className={cn("h-5 w-5", selectedApp.iconColor)} />
                                <span className="font-semibold text-sm">{selectedApp.name}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleDataChange({ appId: '', actionName: '', inputs: {} })}>
                                <ArrowLeft className="mr-1 h-3 w-3" /> Change
                            </Button>
                        </div>
                    )}

                    {renderEditorContent()}
                </div>
            </ScrollArea>
        </div>
    );
}

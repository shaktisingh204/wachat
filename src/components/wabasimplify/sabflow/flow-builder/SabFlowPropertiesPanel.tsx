
'use client';

import React, { useState, useEffect, useTransition, useMemo } from 'react';
import { useProject } from '@/context/project-context';
import { getInvitedUsers } from '@/app/actions/team.actions';
import { getChatSessionsForUser, getSabChatUniqueTags, getSabChatQuickReplies, getSabChatFaqs } from '@/app/actions/sabchat.actions';
import { getTemplates } from '@/app/actions/template.actions';
import { getProjectById } from '@/app/actions/project.actions';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { SabFlowNode } from '@/lib/definitions';
import { SabFlowNodeInput } from './SabFlowNodeInput';
import { SabFlowVariable } from './SabFlowVariableInserter';
import { useReactFlow } from '@xyflow/react';
import { ApiRequestEditor } from '@/components/wabasimplify/sabflow/api-request-editor';
import { AppConnectionSetup } from '@/components/wabasimplify/sabflow/connections/app-connection-setup';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { validateNode } from '@/lib/sabflow/validation';

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
    Webhook,
    Search,
    AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Node } from '@xyflow/react';

const triggers = [
    { id: 'webhook', name: 'Webhook', icon: Webhook, description: 'Trigger via POST request.' },
    { id: 'manual', name: 'Manual', icon: PlayCircle, description: 'Trigger manually from UI.' },
    { id: 'schedule', name: 'Schedule', icon: Calendar, description: 'Recurring schedule.' },
    { id: 'app', name: 'App Event', icon: Zap, description: 'Trigger based on app events.' },
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

    const { getNodes, getEdges } = useReactFlow();

    const [dynamicData, setDynamicData] = useState<any>({
        projects: wachatProjects.map(p => ({ value: p._id, label: p.name })),
        facebookProjects: facebookProjects.map(p => ({ value: p._id, label: p.name })),
        agents: [],
        sabChatSessions: [],
        templates: [],
        tags: [],
        sabChatTags: [],
        sabChatQuickReplies: [],
        sabChatFaqs: [],
    });

    const [isLoadingData, startDataLoad] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');
    const [imageSourceType, setImageSourceType] = useState('url');

    const selectedNodeData = node.data as any;

    // Validation
    const fieldErrors = useMemo(() => {
        const errors = validateNode(node, []);
        const errorMap: Record<string, string> = {};
        errors.forEach(err => { if (err.field) errorMap[err.field] = err.message; });
        return errorMap;
    }, [node, selectedNodeData]);

    useEffect(() => {
        if (selectedNodeData?.actionName?.startsWith('sendMessage') || selectedNodeData?.actionName === 'sendImage') {
            // Logic for image source restoration could go here if we want to guess based on content
        }
    }, [selectedNodeData]);

    useEffect(() => {
        startDataLoad(async () => {
            try {
                const [fetchedAgents, fetchedSessions, fetchedSabTags, fetchedQuickReplies, fetchedFaqs] = await Promise.all([
                    getInvitedUsers(),
                    getChatSessionsForUser(),
                    getSabChatUniqueTags(),
                    getSabChatQuickReplies(),
                    getSabChatFaqs()
                ]);

                setDynamicData((prev: any) => ({
                    ...prev,
                    agents: fetchedAgents.map((a: any) => ({ value: a._id.toString(), label: a.name })),
                    sabChatSessions: fetchedSessions.map((s: any) => ({ value: s._id.toString(), label: `${s.visitorInfo?.name || s.visitorInfo?.email || 'Visitor'} (${s._id.toString().slice(-4)})` })),
                    sabChatTags: fetchedSabTags.map((t: string) => ({ value: t, label: t })),
                    sabChatQuickReplies: fetchedQuickReplies,
                    sabChatFaqs: fetchedFaqs
                }));
            } catch (error) {
                console.error("Failed to load dynamic data", error);
            }
        });
    }, [projects]);

    // Fetch Templates and Tags when Project ID changes
    useEffect(() => {
        const projectId = selectedNodeData.inputs?.projectId;
        if (projectId) {
            startDataLoad(async () => {
                try {
                    const [fetchedTemplates, fetchedProject] = await Promise.all([
                        getTemplates(projectId),
                        getProjectById(projectId)
                    ]);

                    setDynamicData((prev: any) => ({
                        ...prev,
                        templates: fetchedTemplates.map((t: any) => ({ value: t.name, label: t.name })), // Use name as value for templates often
                        tags: (fetchedProject?.tags || []).map((t: any) => ({ value: t._id, label: t.name }))
                    }));
                } catch (e) {
                    console.error("Failed to fetch project details", e);
                }
            });
        }
    }, [selectedNodeData.inputs?.projectId]);

    // Calculate Available Variables
    const availableVariables = useMemo(() => {
        const calculateVariables = (): SabFlowVariable[] => {
            const allNodes = getNodes();
            const allEdges = getEdges();
            const currentNodeId = node.id;

            // Simple traversal: Get all nodes that are ancestors of the current node
            // For now, let's just return ALL upstream nodes to be safe and simple, 
            // or even all nodes excluding current (though upstream is better).
            // A true graph traversal would be ideal, but for now filtering by position might be a cheat, 
            // or just assuming sequential flow. 
            // Let's use React Flow's getIncomers if we had the handle, but we have strict mode.
            // Simpler: Just map all OTHER nodes as potential variable sources.

            const variables: SabFlowVariable[] = [];

            // Add System Variables
            variables.push({ id: 'sys_date', label: 'Current Date', value: '{{system.date}}', group: 'System' });
            variables.push({ id: 'sys_time', label: 'Current Time', value: '{{system.time}}', group: 'System' });

            allNodes.forEach((n: any) => {
                if (n.id === currentNodeId) return;

                const nodeLabel = n.data?.name || n.data?.label || n.type;
                const safeLabel = nodeLabel.replace(/\s+/g, '_').toLowerCase();

                if (n.type === 'trigger') {
                    // Dynamic Trigger Variables
                    const triggerAppId = n.data?.appId;
                    const triggerActionName = n.data?.actionName;

                    if (triggerAppId && triggerActionName) {
                        const app = sabnodeAppActions.find(a => a.appId === triggerAppId);
                        const action = app?.actions?.find((a: any) => a.name === triggerActionName);

                        if (action && (action as any).outputs) {
                            (action as any).outputs.forEach((output: any) => {
                                variables.push({
                                    id: `${n.id}_${output.name}`,
                                    label: output.label || output.name,
                                    value: `{{trigger.${output.name}}}`,
                                    group: 'Trigger'
                                });
                            });
                        }
                    } else if (n.data?.triggerType === 'webhook') {
                        // Fallback for generic webhook
                        variables.push({ id: `${n.id}_body`, label: 'Full Body (JSON)', value: `{{trigger.body}}`, group: 'Trigger' });
                        variables.push({ id: `${n.id}_query`, label: 'Query Params', value: `{{trigger.query}}`, group: 'Trigger' });
                    }

                    // Keep legacy fallbacks if needed, or rely solely on definitions
                    if (!triggerAppId) {
                        variables.push({ id: `${n.id}_phone`, label: 'Phone Number (Legacy)', value: `{{trigger.phone}}`, group: 'Trigger' });
                        variables.push({ id: `${n.id}_name`, label: 'Contact Name (Legacy)', value: `{{trigger.name}}`, group: 'Trigger' });
                    }

                } else if (n.data?.actionName === 'apiRequest') {
                    variables.push({ id: `${n.id}_response`, label: 'Full Response', value: `{{${safeLabel}.response}}`, group: nodeLabel });
                } else if (n.data?.actionName === 'askQuestion') {
                    variables.push({ id: `${n.id}_response`, label: 'User Response', value: `{{${safeLabel}.response}}`, group: nodeLabel });
                }

                // Generic Action Outputs (Future Proofing)
                if (n.type === 'action') {
                    const appId = n.data?.appId;
                    const actionName = n.data?.actionName;
                    const app = sabnodeAppActions.find(a => a.appId === appId);
                    const action = app?.actions?.find((a: any) => a.name === actionName);

                    if (action && (action as any).outputs) {
                        (action as any).outputs.forEach((output: any) => {
                            variables.push({
                                id: `${n.id}_${output.name}`,
                                label: output.label || output.name,
                                value: `{{${safeLabel}.${output.name}}}`,
                                group: nodeLabel
                            });
                        });
                    }
                }
            });

            return variables;
        };
        return calculateVariables();
    }, [node.id, getNodes, getEdges]);

    const handleDataChange = (data: any) => {
        onUpdate(node.id, { ...selectedNodeData, ...data });
    };

    const handleInputDirect = (name: string, value: any) => {
        const newInputs = { ...selectedNodeData.inputs, [name]: value };
        onUpdate(node.id, { ...selectedNodeData, inputs: newInputs });
    };

    // Grouped apps for selection
    const groupedApps = useMemo(() => {
        const filtered = sabnodeAppActions.filter(app =>
            app.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        return Object.entries(filtered.reduce((acc, app) => {
            if (!app.actions || app.actions.every((a: any) => a.isTrigger)) return acc;
            const category = app.category || 'SabNode Apps';
            if (!acc[category]) acc[category] = [];
            acc[category].push(app);
            return acc;
        }, {} as Record<string, any[]>));
    }, [searchTerm]);


    const renderEditorContent = () => {
        const isAction = node.type === 'action';
        const isCondition = node.type === 'condition';
        const isTrigger = node.type === 'trigger';

        if (isAction) {
            const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNodeData.appId) as any;
            let selectedAction = selectedApp?.actions?.find((a: any) => a.name === selectedNodeData.actionName);

            if (selectedNodeData.actionName === 'apiRequest') {
                selectedAction = { name: 'apiRequest', label: 'API Request', description: 'Make a HTTP request.', inputs: [], isTrigger: false } as any;
            }

            if (!selectedApp) {
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search apps..."
                                className="pl-9 bg-muted/50 border-input/50 backdrop-blur-sm focus:bg-background transition-colors"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-[400px] pr-4">
                            <div className="space-y-6">
                                {groupedApps.map(([category, apps]) => (
                                    <div key={category} className="space-y-3">
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">{category}</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {apps.map(app => {
                                                const AppIcon = app.icon || Zap;
                                                return (
                                                    <button
                                                        type="button"
                                                        key={app.appId}
                                                        className="group p-4 flex flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/50 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                                                        onClick={() => {
                                                            const actionName = (app.actions && app.actions.length === 1) ? app.actions[0].name : '';
                                                            handleDataChange({ appId: app.appId, actionName: actionName, inputs: {} });
                                                        }}
                                                    >
                                                        <div className={cn("p-2 rounded-lg bg-background group-hover:scale-110 transition-transform", app.iconColor.replace('text-', 'bg-').replace('-icon', '/10'))}>
                                                            <AppIcon className={cn("h-6 w-6", app.iconColor)} />
                                                        </div>
                                                        <span className="text-xs font-medium text-center leading-tight">{app.name}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                );
            }

            if (selectedNodeData.actionName === 'apiRequest') {
                return <ApiRequestEditor data={selectedNodeData} onUpdate={handleDataChange} />;
            }

            // Action Selection if multiple
            if (selectedApp?.actions && !selectedAction) {
                const actionOptions = selectedApp.actions.filter(a => !a.isTrigger) || [];
                if (actionOptions.length > 0) {
                    // Auto-select if only one
                    if (actionOptions.length === 1) {
                        setTimeout(() => handleDataChange({ actionName: actionOptions[0].name, inputs: {} }), 0);
                        return null;
                    }
                    return (
                        <div className="space-y-3 animate-in fade-in slide-in-from-right-4">
                            <Label>Select Action</Label>
                            <Select value={selectedNodeData.actionName} onValueChange={val => handleDataChange({ actionName: val, inputs: {} })}>
                                <SelectTrigger className="h-10 bg-muted/30"><SelectValue placeholder="Choose an action..." /></SelectTrigger>
                                <SelectContent>
                                    {actionOptions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                }
            }

            if (selectedAction) {
                const requiredInputs = selectedAction.inputs.filter(i => i.required);
                const optionalInputs = selectedAction.inputs.filter(i => !i.required);

                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{selectedAction.description}</span>
                        </div>

                        <div className="space-y-4">
                            {requiredInputs.map((input: any) => (
                                <div key={input.name} className="space-y-1.5">
                                    <Label className="text-xs font-semibold flex items-center justify-between">
                                        {input.label}
                                        <span className="text-[10px] text-destructive/80 font-medium">*Required</span>
                                    </Label>
                                    <SabFlowNodeInput
                                        input={input}
                                        value={selectedNodeData.inputs?.[input.name] || ''}
                                        onChange={val => handleInputDirect(input.name, val)}
                                        dataOptions={dynamicData}
                                        availableVariables={availableVariables}
                                        error={fieldErrors[input.name]}
                                    />
                                </div>
                            ))}
                        </div>

                        {optionalInputs.length > 0 && (
                            <Accordion type="single" collapsible className="w-full border-t">
                                <AccordionItem value="optional" className="border-b-0">
                                    <AccordionTrigger className="text-sm font-medium py-3 text-muted-foreground hover:text-foreground">
                                        Advanced Options
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2 pb-4">
                                        {optionalInputs.map((input: any) => (
                                            <div key={input.name} className="space-y-1.5">
                                                <Label className="text-xs text-muted-foreground">{input.label}</Label>
                                                <SabFlowNodeInput
                                                    input={input}
                                                    value={selectedNodeData.inputs?.[input.name] || ''}
                                                    onChange={val => handleInputDirect(input.name, val)}
                                                    dataOptions={dynamicData}
                                                    availableVariables={availableVariables}
                                                    error={fieldErrors[input.name]}
                                                />
                                            </div>
                                        ))}
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        )}
                    </div>
                );
            }
        }

        if (isTrigger) {
            const triggerType = selectedNodeData.triggerType || 'webhook';
            const selectedTriggerInfo = triggers.find(t => t.id === triggerType);
            const triggerApps = sabnodeAppActions.filter(app => app.actions?.some((a: any) => a.isTrigger === true));
            const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNodeData.appId);
            const selectedAction = selectedApp?.actions?.find((a: any) => a.isTrigger);

            return (
                <div className="space-y-8 animate-in fade-in">
                    <div className="space-y-4">
                        <Label>Trigger Type</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {triggers.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleDataChange({ triggerType: t.id })}
                                    className={cn(
                                        "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border cursor-pointer transition-all duration-200",
                                        triggerType === t.id
                                            ? "border-primary bg-primary/5 shadow-[0_0_15px_-3px_hsl(var(--primary)/0.2)]"
                                            : "border-border hover:bg-accent/50 hover:border-muted-foreground/30"
                                    )}
                                >
                                    <t.icon className={cn("h-6 w-6", triggerType === t.id ? "text-primary" : "text-muted-foreground")} />
                                    <span className={cn("text-xs font-medium", triggerType === t.id ? "text-primary" : "text-muted-foreground")}>{t.name}</span>
                                </div>
                            ))}
                        </div>
                        {selectedTriggerInfo && (
                            <p className="text-xs text-muted-foreground text-center bg-muted/30 p-2 rounded-md">{selectedTriggerInfo.description}</p>
                        )}
                    </div>

                    <Separator className="bg-border/50" />

                    {triggerType === 'webhook' && (
                        <div className="space-y-3">
                            <Label>Webhook URL</Label>
                            <CodeBlock code={`${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${flowId}`} />
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Send a POST request to this URL with any JSON body.
                            </p>
                        </div>
                    )}

                    {triggerType === 'app' && (
                        <div className="space-y-6">
                            {!selectedApp ? (
                                <div className="space-y-2">
                                    <Label>Select App</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {triggerApps.map(app => {
                                            const AppIcon = app.icon || Zap;
                                            return (
                                                <button
                                                    key={app.appId}
                                                    type="button"
                                                    className="p-3 flex items-center gap-2 rounded-lg border bg-card hover:bg-accent transition-all text-left"
                                                    onClick={() => {
                                                        const triggerAction = app.actions.find((a: any) => a.isTrigger);
                                                        handleDataChange({ appId: app.appId, actionName: triggerAction?.name, inputs: {} });
                                                    }}
                                                >
                                                    <AppIcon className={cn("h-5 w-5 shrink-0", app.iconColor)} />
                                                    <span className="text-xs font-semibold">{app.name}</span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                                        <div className="flex items-center gap-2">
                                            <selectedApp.icon className={cn("h-5 w-5", selectedApp.iconColor)} />
                                            <span className="font-semibold text-sm">{selectedApp.name}</span>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => handleDataChange({ appId: '', actionName: '', inputs: {} })}>Change</Button>
                                    </div>

                                    {/* Setup Guide */}
                                    {(selectedApp as any).setupGuide && (
                                        <Accordion type="single" collapsible className="w-full border rounded-lg bg-card/30">
                                            <AccordionItem value="guide" className="border-b-0">
                                                <AccordionTrigger className="text-xs font-semibold px-3 py-2 hover:no-underline hover:bg-muted/50 transition-colors">
                                                    <div className="flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4 text-primary" />
                                                        <span>How to Connect</span>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                                    {(selectedApp as any).setupGuide.trim()}
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    )}

                                    {selectedAction && (selectedAction as any).isTrigger && (
                                        <div className="space-y-4">
                                            <AppConnectionSetup app={selectedApp} flowId={flowId} onConnectionSaved={onConnectionSaved || (() => { })} />
                                            {selectedAction && (selectedAction as any).inputs && (selectedAction as any).inputs.map((input: any) => (
                                                <div key={input.name} className="space-y-1.5">
                                                    <SabFlowNodeInput
                                                        input={input}
                                                        value={selectedNodeData.inputs?.[input.name] || ''}
                                                        onChange={val => handleInputDirect(input.name, val)}
                                                        dataOptions={dynamicData}
                                                        availableVariables={availableVariables}
                                                        error={fieldErrors[input.name]}
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

            return (
                <div className="space-y-6 animate-in fade-in">
                    <div className="bg-muted/30 p-1 rounded-lg flex text-xs font-medium">
                        <button
                            className={cn("flex-1 py-1.5 rounded-md transition-all", selectedNodeData.logicType !== 'OR' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            onClick={() => handleDataChange({ logicType: 'AND' })}
                        >
                            AND (Match All)
                        </button>
                        <button
                            className={cn("flex-1 py-1.5 rounded-md transition-all", selectedNodeData.logicType === 'OR' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                            onClick={() => handleDataChange({ logicType: 'OR' })}
                        >
                            OR (Match Any)
                        </button>
                    </div>

                    <div className="space-y-3">
                        {rules.map((rule: any, index: number) => (
                            <div key={index} className="p-3 border rounded-xl bg-card/50 space-y-3 relative group hover:border-primary/30 transition-colors">
                                {rules.length > 1 && (
                                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity" onClick={() => {
                                        const newRules = rules.filter((_: any, i: number) => i !== index);
                                        handleDataChange({ rules: newRules });
                                    }}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                                <div className="space-y-1">
                                    <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Variable</Label>
                                    <Input placeholder="{{trigger.name}}" value={rule.field} onChange={e => handleRuleChange(index, 'field', e.target.value)} className="h-8 text-xs bg-background/50" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Operator</Label>
                                        <Select value={rule.operator} onValueChange={val => handleRuleChange(index, 'operator', val)}>
                                            <SelectTrigger className="h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
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
                                        <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Value</Label>
                                        <Input placeholder="Value" value={rule.value} onChange={e => handleRuleChange(index, 'value', e.target.value)} className="h-8 text-xs bg-background/50" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => handleDataChange({ rules: [...rules, { field: '', operator: 'equals', value: '' }] })} className="w-full border-dashed">
                            <Plus className="mr-2 h-3 w-3" /> Add Condition
                        </Button>
                    </div>
                </div>
            );
        }
        return null; // Fallback
    };

    const isAction = node.type === 'action';
    const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNodeData.appId);

    return (
        <div className="h-full flex flex-col bg-background/95 backdrop-blur-md">
            {/* Header */}
            <div className="p-4 border-b shrink-0 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-xl z-20">
                <div className="flex flex-col">
                    <h3 className="text-lg font-bold tracking-tight text-foreground/90">
                        {node.type === 'action' ? (selectedApp ? selectedApp.name : 'Action') :
                            node.type === 'trigger' ? 'Trigger' :
                                node.type === 'condition' ? 'Condition' : 'Start'}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Configuration</p>
                </div>
                <div className="flex items-center gap-1">
                    {node.type !== 'start' && node.type !== 'trigger' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" onClick={() => deleteNode(node.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="p-5 space-y-6">
                    {/* Step Name */}
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground uppercase tracking-widest">Step Name</Label>
                        <Input
                            value={selectedNodeData.name}
                            onChange={e => handleDataChange({ name: e.target.value })}
                            className="bg-muted/30 border-transparent focus:border-primary/50 focus:bg-background transition-all font-medium"
                            placeholder="Name your step"
                        />
                    </div>

                    <Separator className="bg-border/50" />

                    {/* App Header (if selected) */}
                    {selectedApp && isAction && (
                        <div className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-muted/50 to-muted/10 p-4 transition-all hover:shadow-md">
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg bg-background shadow-sm", (selectedApp.iconColor || '').replace('text-', 'bg-').replace('-icon', '/10'))}>
                                        <selectedApp.icon className={cn("h-5 w-5", selectedApp.iconColor)} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm">{selectedApp.name}</span>
                                        <span className="text-[10px] text-muted-foreground">{selectedApp.category || 'App Integration'}</span>
                                    </div>
                                </div>
                                <Button variant="secondary" size="sm" className="h-7 text-xs bg-background/80 backdrop-blur-sm hover:bg-background" onClick={() => handleDataChange({ appId: '', actionName: '', inputs: {} })}>
                                    Change
                                </Button>
                            </div>
                        </div>
                    )}

                    {renderEditorContent()}
                </div>
            </ScrollArea>
        </div>
    );
}

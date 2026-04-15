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
import { SabFlowVariableInserter, SabFlowVariable } from './SabFlowVariableInserter';
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
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
    AlertCircle,
    Sparkles,
    Settings2,
    Sliders,
    MessageSquare,
    Image,
    Video,
    Music,
    Code2,
    Type,
    Hash,
    Mail,
    Phone,
    CalendarDays,
    Link,
    FileUp,
    ToggleLeft,
    Star,
    CreditCard,
    Variable,
    ExternalLink,
    FileCode,
    Timer,
    Shuffle,
    ArrowRight,
    Filter,
    Bot,
    BrainCircuit,
    StickyNote,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Node } from '@xyflow/react';

const triggers = [
    { id: 'webhook', name: 'Webhook', icon: Webhook, description: 'Trigger via POST request.' },
    { id: 'manual', name: 'Manual', icon: PlayCircle, description: 'Trigger manually from UI.' },
    { id: 'schedule', name: 'Schedule', icon: Calendar, description: 'Recurring schedule.' },
    { id: 'app', name: 'App Event', icon: Zap, description: 'Trigger based on app events.' },
];

// Block type category arrays
const BUBBLE_TYPES = ['text_bubble', 'image_bubble', 'video_bubble', 'audio_bubble', 'embed_bubble'];
const INPUT_TYPES = ['text_input', 'number_input', 'email_input', 'phone_input', 'date_input', 'url_input', 'file_input', 'buttons', 'rating', 'payment'];
const LOGIC_TYPES = ['set_variable', 'redirect', 'script', 'wait', 'ab_test', 'jump', 'filter'];
const AI_TYPES = ['ai_message', 'ai_agent'];

const AI_MODELS = [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
];

interface SabFlowPropertiesPanelProps {
    node: Node | SabFlowNode;
    onUpdate: (id: string, data: any) => void;
    deleteNode: (id: string) => void;
    onClose: () => void;
    user: any;
    flowId: string;
    onConnectionSaved?: () => void;
}

export function SabFlowPropertiesPanel({ node, onUpdate, deleteNode, onClose, user, flowId, onConnectionSaved }: SabFlowPropertiesPanelProps) {
    const { projects } = useProject();
    const wachatProjects = projects.filter(p => p.wabaId);
    const facebookProjects = projects.filter(p => p.facebookPageId);

    const { getNodes, getEdges } = useReactFlow();

    const [dynamicData, setDynamicData] = useState<any>({
        projects: projects.map(p => ({ value: p._id, label: p.name })),
        wachatProjects: wachatProjects.map(p => ({ value: p._id, label: p.name })),
        facebookProjects: facebookProjects.map(p => ({ value: p._id, label: p.name })),
        agents: [],
        sabChatSessions: [],
        templates: [],
        rawTemplates: [],
        tags: [],
        sabChatTags: [],
        sabChatQuickReplies: [],
        sabChatFaqs: [],
    });

    const selectedNodeData = node.data || {};
    const [isLoadingData, startDataLoad] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
                        templates: fetchedTemplates.map((t: any) => ({ value: t.name, label: t.name })),
                        rawTemplates: fetchedTemplates,
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

            const variables: SabFlowVariable[] = [];

            // System Variables
            variables.push({ id: 'sys_date', label: 'Current Date', value: '{{system.date}}', group: 'System' });
            variables.push({ id: 'sys_time', label: 'Current Time', value: '{{system.time}}', group: 'System' });

            allNodes.forEach((n: any) => {
                if (n.id === currentNodeId) return;

                const nodeLabel = n.data?.name || n.data?.label || n.type;
                const safeLabel = nodeLabel.replace(/\s+/g, '_').toLowerCase();

                if (n.type === 'trigger') {
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
                        variables.push({ id: `${n.id}_body`, label: 'Full Body (JSON)', value: `{{trigger.body}}`, group: 'Trigger' });
                        variables.push({ id: `${n.id}_query`, label: 'Query Params', value: `{{trigger.query}}`, group: 'Trigger' });
                    }

                    if (!triggerAppId) {
                        variables.push({ id: `${n.id}_phone`, label: 'Phone Number (Legacy)', value: `{{trigger.phone}}`, group: 'Trigger' });
                        variables.push({ id: `${n.id}_name`, label: 'Contact Name (Legacy)', value: `{{trigger.name}}`, group: 'Trigger' });
                    }

                } else if (n.data?.actionName === 'apiRequest') {
                    variables.push({ id: `${n.id}_response`, label: 'Full Response', value: `{{${safeLabel}.response}}`, group: nodeLabel });
                } else if (n.data?.actionName === 'askQuestion') {
                    variables.push({ id: `${n.id}_response`, label: 'User Response', value: `{{${safeLabel}.response}}`, group: nodeLabel });
                }

                // Block type variable outputs
                const blockType = n.data?.blockType as string;
                if (blockType) {
                    const varName = n.data?.variableName;
                    if (varName) {
                        variables.push({
                            id: `${n.id}_var`,
                            label: varName,
                            value: `{{${varName}}}`,
                            group: nodeLabel
                        });
                    }
                }

                // Generic Action Outputs
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

    // ─── Shared helpers ────────────────────────────────────────────────────────

    const labelClass = "text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]";
    const inputClass = "bg-muted/30 border-border/60 focus:bg-background";
    const descClass = "text-[11px] text-muted-foreground";

    /** Render a label + optional variable inserter in a flex row */
    const renderLabelWithInserter = (
        label: string,
        fieldKey: string,
        currentValue: string,
        required?: boolean
    ) => (
        <div className="flex items-center justify-between">
            <Label className={labelClass}>
                {label}{required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            <SabFlowVariableInserter
                availableVariables={availableVariables}
                onInsert={(v) => handleDataChange({ [fieldKey]: (currentValue || '') + v })}
            />
        </div>
    );

    /** Render the live "Access as {{varName}}" hint */
    const renderVarHint = (varName: string) =>
        varName ? (
            <p className={descClass}>
                Access as <code className="bg-muted px-1 rounded font-mono">{`{{${varName}}}`}</code>
            </p>
        ) : null;

    // ─── Condition rules renderer (reused for filter block too) ────────────────

    const renderConditionRules = (rulesKey: string = 'rules', logicKey: string = 'logicType') => {
        const rules = selectedNodeData[rulesKey] || [{ field: '', operator: 'equals', value: '' }];
        const handleRuleChange = (index: number, field: string, value: string) => {
            const newRules = [...rules];
            newRules[index] = { ...newRules[index], [field]: value };
            handleDataChange({ [rulesKey]: newRules });
        };

        return (
            <div className="space-y-6 animate-in fade-in">
                <div className="bg-muted/30 p-1 rounded-lg flex text-xs font-medium">
                    <button
                        className={cn("flex-1 py-1.5 rounded-md transition-all", selectedNodeData[logicKey] !== 'OR' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => handleDataChange({ [logicKey]: 'AND' })}
                    >
                        AND (Match All)
                    </button>
                    <button
                        className={cn("flex-1 py-1.5 rounded-md transition-all", selectedNodeData[logicKey] === 'OR' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                        onClick={() => handleDataChange({ [logicKey]: 'OR' })}
                    >
                        OR (Match Any)
                    </button>
                </div>

                <div className="space-y-3">
                    {rules.map((rule: any, index: number) => (
                        <div key={index} className="p-3 border rounded-xl bg-card/50 space-y-3 relative group hover:border-primary/30 transition-colors">
                            {rules.length > 1 && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-6 w-6 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                                    onClick={() => {
                                        const newRules = rules.filter((_: any, i: number) => i !== index);
                                        handleDataChange({ [rulesKey]: newRules });
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            )}
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground uppercase tracking-widest">Variable</Label>
                                <Input
                                    placeholder="{{trigger.name}}"
                                    value={rule.field}
                                    onChange={e => handleRuleChange(index, 'field', e.target.value)}
                                    className="h-8 text-xs bg-background/50"
                                />
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
                                    <Input
                                        placeholder="Value"
                                        value={rule.value}
                                        onChange={e => handleRuleChange(index, 'value', e.target.value)}
                                        className="h-8 text-xs bg-background/50"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDataChange({ [rulesKey]: [...rules, { field: '', operator: 'equals', value: '' }] })}
                        className="w-full border-dashed"
                    >
                        <Plus className="mr-2 h-3 w-3" /> Add Condition
                    </Button>
                </div>
            </div>
        );
    };

    // ─── Block-type renderers ───────────────────────────────────────────────────

    const renderTextBubble = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                {renderLabelWithInserter('Message Content', 'content', selectedNodeData.content || '', true)}
                <Textarea
                    rows={4}
                    value={selectedNodeData.content || ''}
                    onChange={e => handleDataChange({ content: e.target.value })}
                    placeholder="Type your message here..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Delay (ms)</Label>
                <Input
                    type="number"
                    value={selectedNodeData.delay ?? ''}
                    onChange={e => handleDataChange({ delay: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="0"
                    className={cn(inputClass)}
                />
                <p className={descClass}>Wait before showing this message</p>
            </div>
        </div>
    );

    const renderImageBubble = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                {renderLabelWithInserter('Image URL', 'url', selectedNodeData.url || '', true)}
                <Input
                    value={selectedNodeData.url || ''}
                    onChange={e => handleDataChange({ url: e.target.value })}
                    placeholder="https://example.com/image.png"
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('Caption', 'caption', selectedNodeData.caption || '')}
                <Input
                    value={selectedNodeData.caption || ''}
                    onChange={e => handleDataChange({ caption: e.target.value })}
                    placeholder="Optional caption..."
                    className={cn(inputClass)}
                />
            </div>
        </div>
    );

    const renderVideoBubble = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                {renderLabelWithInserter('Video URL', 'url', selectedNodeData.url || '', true)}
                <Input
                    value={selectedNodeData.url || ''}
                    onChange={e => handleDataChange({ url: e.target.value })}
                    placeholder="YouTube/Vimeo/direct URL"
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Caption</Label>
                <Input
                    value={selectedNodeData.caption || ''}
                    onChange={e => handleDataChange({ caption: e.target.value })}
                    placeholder="Optional caption..."
                    className={cn(inputClass)}
                />
            </div>
        </div>
    );

    const renderAudioBubble = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                {renderLabelWithInserter('Audio URL', 'url', selectedNodeData.url || '', true)}
                <Input
                    value={selectedNodeData.url || ''}
                    onChange={e => handleDataChange({ url: e.target.value })}
                    placeholder="https://example.com/audio.mp3"
                    className={cn(inputClass)}
                />
            </div>
        </div>
    );

    const renderEmbedBubble = () => {
        const embedType = selectedNodeData.embedType || 'url';
        return (
            <div className="space-y-5 animate-in fade-in">
                <div className="space-y-2">
                    <Label className={labelClass}>Embed Type</Label>
                    <RadioGroup
                        value={embedType}
                        onValueChange={val => handleDataChange({ embedType: val })}
                        className="flex gap-4"
                    >
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="url" id="embed-url" />
                            <Label htmlFor="embed-url" className="font-normal cursor-pointer">URL</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <RadioGroupItem value="html" id="embed-html" />
                            <Label htmlFor="embed-html" className="font-normal cursor-pointer">HTML Code</Label>
                        </div>
                    </RadioGroup>
                </div>
                {embedType === 'url' ? (
                    <div className="space-y-2">
                        <Label className={labelClass}>Embed URL<span className="text-destructive ml-0.5">*</span></Label>
                        <Input
                            value={selectedNodeData.url || ''}
                            onChange={e => handleDataChange({ url: e.target.value })}
                            placeholder="https://example.com/embed"
                            className={cn(inputClass)}
                        />
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label className={labelClass}>HTML / iframe code<span className="text-destructive ml-0.5">*</span></Label>
                        <Textarea
                            rows={6}
                            value={selectedNodeData.code || ''}
                            onChange={e => handleDataChange({ code: e.target.value })}
                            placeholder={'<iframe src="..." />'}
                            className={cn(inputClass, "font-mono text-xs")}
                        />
                    </div>
                )}
            </div>
        );
    };

    // ─── Input block renderers ──────────────────────────────────────────────────

    const renderTextInput = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. user_name"
                    className={cn(inputClass)}
                />
                <p className={descClass}>Variable name (no spaces)</p>
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('Placeholder text', 'placeholder', selectedNodeData.placeholder || '')}
                <Input
                    value={selectedNodeData.placeholder || ''}
                    onChange={e => handleDataChange({ placeholder: e.target.value })}
                    placeholder="e.g. Enter your name..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Required</Label>
                <Switch
                    checked={!!selectedNodeData.required}
                    onCheckedChange={val => handleDataChange({ required: val })}
                />
            </div>
        </div>
    );

    const renderNumberInput = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. user_age"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('Placeholder', 'placeholder', selectedNodeData.placeholder || '')}
                <Input
                    value={selectedNodeData.placeholder || ''}
                    onChange={e => handleDataChange({ placeholder: e.target.value })}
                    placeholder="e.g. Enter a number..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className={labelClass}>Min value</Label>
                    <Input
                        type="number"
                        value={selectedNodeData.min ?? ''}
                        onChange={e => handleDataChange({ min: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="0"
                        className={cn(inputClass)}
                    />
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>Max value</Label>
                    <Input
                        type="number"
                        value={selectedNodeData.max ?? ''}
                        onChange={e => handleDataChange({ max: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="100"
                        className={cn(inputClass)}
                    />
                </div>
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Required</Label>
                <Switch
                    checked={!!selectedNodeData.required}
                    onCheckedChange={val => handleDataChange({ required: val })}
                />
            </div>
        </div>
    );

    const renderEmailInput = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. user_email"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('Placeholder', 'placeholder', selectedNodeData.placeholder || '')}
                <Input
                    value={selectedNodeData.placeholder || ''}
                    onChange={e => handleDataChange({ placeholder: e.target.value })}
                    placeholder="e.g. Enter your email..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Required</Label>
                <Switch
                    checked={!!selectedNodeData.required}
                    onCheckedChange={val => handleDataChange({ required: val })}
                />
            </div>
        </div>
    );

    const renderPhoneInput = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. user_phone"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Default country code</Label>
                <Select
                    value={selectedNodeData.countryCode || '+1'}
                    onValueChange={val => handleDataChange({ countryCode: val })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="+1">+1 (US)</SelectItem>
                        <SelectItem value="+44">+44 (UK)</SelectItem>
                        <SelectItem value="+91">+91 (IN)</SelectItem>
                        <SelectItem value="+971">+971 (AE)</SelectItem>
                        <SelectItem value="+966">+966 (SA)</SelectItem>
                        <SelectItem value="+49">+49 (DE)</SelectItem>
                        <SelectItem value="+33">+33 (FR)</SelectItem>
                        <SelectItem value="+86">+86 (CN)</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Required</Label>
                <Switch
                    checked={!!selectedNodeData.required}
                    onCheckedChange={val => handleDataChange({ required: val })}
                />
            </div>
        </div>
    );

    const renderDateInput = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. appointment_date"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Date format</Label>
                <Select
                    value={selectedNodeData.format || 'DD/MM/YYYY'}
                    onValueChange={val => handleDataChange({ format: val })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="DD MMM YYYY">DD MMM YYYY</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Required</Label>
                <Switch
                    checked={!!selectedNodeData.required}
                    onCheckedChange={val => handleDataChange({ required: val })}
                />
            </div>
        </div>
    );

    const renderUrlInput = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. website_url"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('Placeholder', 'placeholder', selectedNodeData.placeholder || '')}
                <Input
                    value={selectedNodeData.placeholder || ''}
                    onChange={e => handleDataChange({ placeholder: e.target.value })}
                    placeholder="https://..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Required</Label>
                <Switch
                    checked={!!selectedNodeData.required}
                    onCheckedChange={val => handleDataChange({ required: val })}
                />
            </div>
        </div>
    );

    const renderFileInput = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save file URL to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. uploaded_file"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Accepted file types</Label>
                <Input
                    value={selectedNodeData.acceptedTypes || ''}
                    onChange={e => handleDataChange({ acceptedTypes: e.target.value })}
                    placeholder="image/*,.pdf,.docx"
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Max size (MB)</Label>
                <Input
                    type="number"
                    value={selectedNodeData.maxSizeMB ?? 10}
                    onChange={e => handleDataChange({ maxSizeMB: Number(e.target.value) })}
                    placeholder="10"
                    className={cn(inputClass)}
                />
            </div>
        </div>
    );

    const renderButtonsBlock = () => {
        const buttons: Array<{ label: string; value: string }> = selectedNodeData.buttons || [{ label: 'Option 1', value: 'option_1' }];

        return (
            <div className="space-y-5 animate-in fade-in">
                <div className="space-y-3">
                    <Label className={labelClass}>Button Options</Label>
                    <div className="space-y-2">
                        {buttons.map((btn, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    value={btn.label}
                                    onChange={e => {
                                        const next = buttons.map((b, i) => i === index ? { ...b, label: e.target.value } : b);
                                        handleDataChange({ buttons: next });
                                    }}
                                    placeholder="Label"
                                    className={cn(inputClass, "flex-1 h-8 text-xs")}
                                />
                                <Input
                                    value={btn.value}
                                    onChange={e => {
                                        const next = buttons.map((b, i) => i === index ? { ...b, value: e.target.value } : b);
                                        handleDataChange({ buttons: next });
                                    }}
                                    placeholder="Value"
                                    className={cn(inputClass, "flex-1 h-8 text-xs")}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                    onClick={() => {
                                        const next = buttons.filter((_, i) => i !== index);
                                        handleDataChange({ buttons: next.length ? next : [{ label: 'Option 1', value: 'option_1' }] });
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDataChange({ buttons: [...buttons, { label: '', value: '' }] })}
                        className="w-full border-dashed"
                    >
                        <Plus className="mr-2 h-3 w-3" /> Add Button
                    </Button>
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>Save choice to variable</Label>
                    <Input
                        value={selectedNodeData.variableName || ''}
                        onChange={e => handleDataChange({ variableName: e.target.value })}
                        placeholder="e.g. user_choice"
                        className={cn(inputClass)}
                    />
                    {renderVarHint(selectedNodeData.variableName)}
                </div>
            </div>
        );
    };

    const renderRating = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Save rating to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. rating_score"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Maximum stars</Label>
                <Select
                    value={String(selectedNodeData.maxStars || 5)}
                    onValueChange={val => handleDataChange({ maxStars: Number(val) })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {[3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                            <SelectItem key={n} value={String(n)}>{n} stars</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Required</Label>
                <Switch
                    checked={!!selectedNodeData.required}
                    onCheckedChange={val => handleDataChange({ required: val })}
                />
            </div>
        </div>
    );

    const renderPayment = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                {renderLabelWithInserter('Amount', 'amount', selectedNodeData.amount || '', true)}
                <Input
                    value={selectedNodeData.amount || ''}
                    onChange={e => handleDataChange({ amount: e.target.value })}
                    placeholder="e.g. 99.99 or {{cart.total}}"
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Currency</Label>
                <Select
                    value={selectedNodeData.currency || 'USD'}
                    onValueChange={val => handleDataChange({ currency: val })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="USD">USD — US Dollar</SelectItem>
                        <SelectItem value="EUR">EUR — Euro</SelectItem>
                        <SelectItem value="GBP">GBP — British Pound</SelectItem>
                        <SelectItem value="INR">INR — Indian Rupee</SelectItem>
                        <SelectItem value="AED">AED — UAE Dirham</SelectItem>
                        <SelectItem value="SAR">SAR — Saudi Riyal</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('Description', 'description', selectedNodeData.description || '')}
                <Input
                    value={selectedNodeData.description || ''}
                    onChange={e => handleDataChange({ description: e.target.value })}
                    placeholder="Optional description..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Payment provider</Label>
                <Select
                    value={selectedNodeData.provider || 'Stripe'}
                    onValueChange={val => handleDataChange({ provider: val })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Stripe">Stripe</SelectItem>
                        <SelectItem value="Razorpay">Razorpay</SelectItem>
                        <SelectItem value="PayPal">PayPal</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Public / Client key</Label>
                <Input
                    type="password"
                    value={selectedNodeData.publicKey || ''}
                    onChange={e => handleDataChange({ publicKey: e.target.value })}
                    placeholder="pk_live_..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Save transaction ID to variable</Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. transaction_id"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
        </div>
    );

    // ─── Logic block renderers ─────────────────────────────────────────────────

    const renderSetVariable = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Variable name<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. total_price"
                    className={cn(inputClass)}
                />
                <p className={descClass}>The variable to create or update</p>
                {renderVarHint(selectedNodeData.variableName)}
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('Value', 'value', selectedNodeData.value || '', true)}
                <Input
                    value={selectedNodeData.value || ''}
                    onChange={e => handleDataChange({ value: e.target.value })}
                    placeholder="e.g. 100 or {{cart.price}}"
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Type</Label>
                <Select
                    value={selectedNodeData.valueType || 'Text'}
                    onValueChange={val => handleDataChange({ valueType: val })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Text">Text</SelectItem>
                        <SelectItem value="Number">Number</SelectItem>
                        <SelectItem value="Boolean">Boolean</SelectItem>
                        <SelectItem value="Expression">Expression</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    const renderRedirect = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                {renderLabelWithInserter('Redirect URL', 'url', selectedNodeData.url || '', true)}
                <Input
                    value={selectedNodeData.url || ''}
                    onChange={e => handleDataChange({ url: e.target.value })}
                    placeholder="https://example.com/{{user.id}}"
                    className={cn(inputClass)}
                />
            </div>
            <div className="flex items-center justify-between">
                <Label className={labelClass}>Open in new tab</Label>
                <Switch
                    checked={!!selectedNodeData.newTab}
                    onCheckedChange={val => handleDataChange({ newTab: val })}
                />
            </div>
        </div>
    );

    const renderScript = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>JavaScript Code</Label>
                <Textarea
                    rows={12}
                    value={selectedNodeData.code || ''}
                    onChange={e => handleDataChange({ code: e.target.value })}
                    placeholder="// Access flow data via `context` object\n// Return a value to store it\nreturn context.trigger.name;"
                    className={cn(inputClass, "font-mono text-xs")}
                />
                <p className={descClass}>
                    Access flow data via <code className="bg-muted px-1 rounded font-mono">context</code> object. Return a value to store it.
                </p>
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Save output to variable</Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. script_result"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
        </div>
    );

    const renderWait = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>Duration<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    type="number"
                    value={selectedNodeData.duration ?? 5}
                    onChange={e => handleDataChange({ duration: Number(e.target.value) })}
                    placeholder="5"
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Unit</Label>
                <Select
                    value={selectedNodeData.unit || 'Seconds'}
                    onValueChange={val => handleDataChange({ unit: val })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Milliseconds">Milliseconds</SelectItem>
                        <SelectItem value="Seconds">Seconds</SelectItem>
                        <SelectItem value="Minutes">Minutes</SelectItem>
                        <SelectItem value="Hours">Hours</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    const renderAbTest = () => {
        const splits: Array<{ name: string; percentage: number }> = selectedNodeData.splits || [
            { name: 'A', percentage: 50 },
            { name: 'B', percentage: 50 },
        ];
        const total = splits.reduce((sum, s) => sum + (Number(s.percentage) || 0), 0);
        const totalOk = total === 100;

        return (
            <div className="space-y-5 animate-in fade-in">
                <div className="space-y-3">
                    <Label className={labelClass}>Splits</Label>
                    <div className="space-y-2">
                        {splits.map((split, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <Input
                                    value={split.name}
                                    onChange={e => {
                                        const next = splits.map((s, i) => i === index ? { ...s, name: e.target.value } : s);
                                        handleDataChange({ splits: next });
                                    }}
                                    placeholder="Name"
                                    className={cn(inputClass, "flex-1 h-8 text-xs")}
                                />
                                <Input
                                    type="number"
                                    value={split.percentage}
                                    onChange={e => {
                                        const next = splits.map((s, i) => i === index ? { ...s, percentage: Number(e.target.value) } : s);
                                        handleDataChange({ splits: next });
                                    }}
                                    placeholder="%"
                                    className={cn(inputClass, "w-20 h-8 text-xs")}
                                />
                                {splits.length > 2 && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                                        onClick={() => {
                                            const next = splits.filter((_, i) => i !== index);
                                            handleDataChange({ splits: next });
                                        }}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDataChange({ splits: [...splits, { name: String.fromCharCode(65 + splits.length), percentage: 0 }] })}
                        className="w-full border-dashed"
                    >
                        <Plus className="mr-2 h-3 w-3" /> Add Split
                    </Button>
                </div>
                <div className={cn(
                    "flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-medium",
                    totalOk
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                )}>
                    <span>Total</span>
                    <span>{total}% {totalOk ? '✓' : '— must equal 100%'}</span>
                </div>
            </div>
        );
    };

    const renderJump = () => {
        const allNodes = getNodes();
        const otherNodes = allNodes.filter(n => n.id !== node.id);

        return (
            <div className="space-y-5 animate-in fade-in">
                <div className="space-y-2">
                    <Label className={labelClass}>Jump to node<span className="text-destructive ml-0.5">*</span></Label>
                    <Select
                        value={selectedNodeData.targetNodeId || ''}
                        onValueChange={val => handleDataChange({ targetNodeId: val })}
                    >
                        <SelectTrigger className={cn("h-9", inputClass)}><SelectValue placeholder="Select a node..." /></SelectTrigger>
                        <SelectContent>
                            {otherNodes.map(n => {
                                const label = (n.data as any)?.name || (n.data as any)?.label || n.type || n.id;
                                return (
                                    <SelectItem key={n.id} value={n.id}>{label}</SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <Label className={labelClass}>Pass current data</Label>
                        <p className={descClass}>Pass flow data to the target node</p>
                    </div>
                    <Switch
                        checked={!!selectedNodeData.passData}
                        onCheckedChange={val => handleDataChange({ passData: val })}
                    />
                </div>
            </div>
        );
    };

    const renderFilter = () => (
        <div className="space-y-2 animate-in fade-in">
            <p className={cn(descClass, "mb-4")}>Filter block — define rules below. Records that do not match will be dropped from the flow.</p>
            {renderConditionRules('rules', 'logicType')}
        </div>
    );

    // ─── AI block renderers ────────────────────────────────────────────────────

    const renderAiMessage = () => (
        <div className="space-y-5 animate-in fade-in">
            <div className="space-y-2">
                <Label className={labelClass}>AI Model</Label>
                <Select
                    value={selectedNodeData.model || 'gpt-4o-mini'}
                    onValueChange={val => handleDataChange({ model: val })}
                >
                    <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {AI_MODELS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>System prompt</Label>
                <Textarea
                    rows={3}
                    value={selectedNodeData.systemPrompt || ''}
                    onChange={e => handleDataChange({ systemPrompt: e.target.value })}
                    placeholder="You are a helpful assistant..."
                    className={cn(inputClass)}
                />
            </div>
            <div className="space-y-2">
                {renderLabelWithInserter('User prompt', 'userPrompt', selectedNodeData.userPrompt || '', true)}
                <Textarea
                    rows={4}
                    value={selectedNodeData.userPrompt || ''}
                    onChange={e => handleDataChange({ userPrompt: e.target.value })}
                    placeholder="{{trigger.message}}"
                    className={cn(inputClass)}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                    <Label className={labelClass}>Temperature</Label>
                    <Input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={selectedNodeData.temperature ?? 0.7}
                        onChange={e => handleDataChange({ temperature: Number(e.target.value) })}
                        className={cn(inputClass)}
                    />
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>Max tokens</Label>
                    <Input
                        type="number"
                        value={selectedNodeData.maxTokens ?? ''}
                        onChange={e => handleDataChange({ maxTokens: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="1024"
                        className={cn(inputClass)}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                <Input
                    value={selectedNodeData.variableName || ''}
                    onChange={e => handleDataChange({ variableName: e.target.value })}
                    placeholder="e.g. ai_reply"
                    className={cn(inputClass)}
                />
                {renderVarHint(selectedNodeData.variableName)}
            </div>
        </div>
    );

    const renderAiAgent = () => {
        const selectedTools: string[] = selectedNodeData.tools || [];
        const allTools = [
            { id: 'web_search', label: 'Web Search' },
            { id: 'calculator', label: 'Calculator' },
            { id: 'code_interpreter', label: 'Code Interpreter' },
            { id: 'send_email', label: 'Send Email' },
            { id: 'send_whatsapp', label: 'Send WhatsApp' },
        ];

        const toggleTool = (toolId: string) => {
            const next = selectedTools.includes(toolId)
                ? selectedTools.filter(t => t !== toolId)
                : [...selectedTools, toolId];
            handleDataChange({ tools: next });
        };

        return (
            <div className="space-y-5 animate-in fade-in">
                <div className="space-y-2">
                    {renderLabelWithInserter('Agent instructions', 'instructions', selectedNodeData.instructions || '', true)}
                    <Textarea
                        rows={5}
                        value={selectedNodeData.instructions || ''}
                        onChange={e => handleDataChange({ instructions: e.target.value })}
                        placeholder="You are an agent that..."
                        className={cn(inputClass)}
                    />
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>AI Model</Label>
                    <Select
                        value={selectedNodeData.model || 'gpt-4o'}
                        onValueChange={val => handleDataChange({ model: val })}
                    >
                        <SelectTrigger className={cn("h-9", inputClass)}><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {AI_MODELS.map(m => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>Available tools</Label>
                    <div className="space-y-2">
                        {allTools.map(tool => (
                            <div key={tool.id} className="flex items-center gap-2">
                                <Checkbox
                                    id={`tool-${tool.id}`}
                                    checked={selectedTools.includes(tool.id)}
                                    onCheckedChange={() => toggleTool(tool.id)}
                                />
                                <Label htmlFor={`tool-${tool.id}`} className="font-normal cursor-pointer text-sm">{tool.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>Max iterations</Label>
                    <Input
                        type="number"
                        value={selectedNodeData.maxIterations ?? 5}
                        onChange={e => handleDataChange({ maxIterations: Number(e.target.value) })}
                        placeholder="5"
                        className={cn(inputClass)}
                    />
                </div>
                <div className="space-y-2">
                    <Label className={labelClass}>Save response to variable<span className="text-destructive ml-0.5">*</span></Label>
                    <Input
                        value={selectedNodeData.variableName || ''}
                        onChange={e => handleDataChange({ variableName: e.target.value })}
                        placeholder="e.g. agent_response"
                        className={cn(inputClass)}
                    />
                    {renderVarHint(selectedNodeData.variableName)}
                </div>
            </div>
        );
    };

    const renderStickyNote = () => (
        <div className="space-y-3 animate-in fade-in">
            <Label className={labelClass}>Note content</Label>
            <Textarea
                rows={6}
                value={selectedNodeData.text || ''}
                onChange={e => handleDataChange({ text: e.target.value })}
                placeholder="Add a note..."
                className={cn(inputClass)}
            />
        </div>
    );

    // ─── Main editor content ────────────────────────────────────────────────────

    const renderEditorContent = () => {
        const blockType = (selectedNodeData?.blockType as string) ?? (node as any).type ?? '';

        // ── Bubble blocks ─────────────────────────────────────────────────────
        if (blockType === 'text_bubble') return renderTextBubble();
        if (blockType === 'image_bubble') return renderImageBubble();
        if (blockType === 'video_bubble') return renderVideoBubble();
        if (blockType === 'audio_bubble') return renderAudioBubble();
        if (blockType === 'embed_bubble') return renderEmbedBubble();

        // ── Input blocks ──────────────────────────────────────────────────────
        if (blockType === 'text_input') return renderTextInput();
        if (blockType === 'number_input') return renderNumberInput();
        if (blockType === 'email_input') return renderEmailInput();
        if (blockType === 'phone_input') return renderPhoneInput();
        if (blockType === 'date_input') return renderDateInput();
        if (blockType === 'url_input') return renderUrlInput();
        if (blockType === 'file_input') return renderFileInput();
        if (blockType === 'buttons') return renderButtonsBlock();
        if (blockType === 'rating') return renderRating();
        if (blockType === 'payment') return renderPayment();

        // ── Logic blocks ──────────────────────────────────────────────────────
        if (blockType === 'set_variable') return renderSetVariable();
        if (blockType === 'redirect') return renderRedirect();
        if (blockType === 'script') return renderScript();
        if (blockType === 'wait') return renderWait();
        if (blockType === 'ab_test') return renderAbTest();
        if (blockType === 'jump') return renderJump();
        if (blockType === 'filter') return renderFilter();

        // ── AI blocks ─────────────────────────────────────────────────────────
        if (blockType === 'ai_message') return renderAiMessage();
        if (blockType === 'ai_agent') return renderAiAgent();

        // ── Sticky note ───────────────────────────────────────────────────────
        if (blockType === 'sticky_note' || (node as any).type === 'sticky_note') return renderStickyNote();

        // ── Legacy action / trigger / condition ───────────────────────────────
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
                        <ScrollArea className="h-100 pr-4">
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
                const actionOptions = selectedApp.actions.filter((a: any) => !a.isTrigger) || [];
                if (actionOptions.length > 0) {
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
                                    {actionOptions.map((a: any) => (
                                        <SelectItem key={a.name} value={a.name}>{a.label || a.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    );
                }
            }

            if (selectedAction) {
                let displayInputs = [...selectedAction.inputs];

                // Dynamic Template Inputs Logic
                if (selectedNodeData.actionName === 'sendTemplate' && selectedNodeData.inputs?.templateId) {
                    const template = dynamicData.rawTemplates?.find((t: any) => t.name === selectedNodeData.inputs.templateId);

                    if (template) {
                        const dynamicInputs: any[] = [];

                        const headerComp = template.components?.find((c: any) => c.type === 'HEADER');
                        if (headerComp) {
                            if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
                                dynamicInputs.push({
                                    name: 'headerMediaUrl',
                                    label: `Header ${headerComp.format} URL`,
                                    type: 'text',
                                    placeholder: `https://example.com/${headerComp.format.toLowerCase()}.summary`,
                                    required: true,
                                    description: `Publicly accessible URL for the header ${headerComp.format.toLowerCase()}.`
                                });
                            } else if (headerComp.format === 'TEXT' && headerComp.text?.includes('{{ 1}}')) {
                                dynamicInputs.push({
                                    name: 'variable_header_1',
                                    label: 'Header Variable {{1}}',
                                    type: 'text',
                                    required: true
                                });
                            }
                        }

                        if (template.body) {
                            const bodyVarMatches = template.body.match(/{{\s*(\d+)\s*}}/g);
                            if (bodyVarMatches) {
                                const vars = (Array.from(new Set(bodyVarMatches.map((v: string) => parseInt(v.replace(/{{\s*|\s*}}/g, ''), 10)))) as number[]).sort((a: number, b: number) => a - b);
                                vars.forEach((v: number) => {
                                    dynamicInputs.push({
                                        name: `variable_body_${v}`,
                                        label: `Body Variable {{${v}}}`,
                                        type: 'text',
                                        required: true,
                                        placeholder: `Value for {{${v}}}`
                                    });
                                });
                            }
                        }

                        const buttonsComp = template.components?.find((c: any) => c.type === 'BUTTONS');
                        if (buttonsComp && buttonsComp.buttons) {
                            buttonsComp.buttons.forEach((btn: any, idx: number) => {
                                if (btn.type === 'URL' && btn.url?.includes('{{1}}')) {
                                    dynamicInputs.push({
                                        name: `variable_button_${idx}`,
                                        label: `Button Variable (${btn.text})`,
                                        type: 'text',
                                        required: true,
                                        placeholder: 'URL suffix value'
                                    });
                                }
                            });
                        }

                        displayInputs = displayInputs.filter(i => i.name !== 'variables');
                        displayInputs = [...displayInputs, ...dynamicInputs];
                    }
                }

                const requiredInputs = displayInputs.filter(i => i.required);
                const optionalInputs = displayInputs.filter(i => !i.required);

                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm text-muted-foreground flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span>{selectedAction.description}</span>
                        </div>

                        <div className="space-y-4">
                            {requiredInputs.map((input: any) => (
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

                        {optionalInputs.length > 0 && (
                            <Accordion type="single" collapsible className="w-full border-t">
                                <AccordionItem value="optional" className="border-b-0">
                                    <AccordionTrigger className="text-sm font-medium py-3 text-muted-foreground hover:text-foreground">
                                        Advanced Options
                                    </AccordionTrigger>
                                    <AccordionContent className="space-y-4 pt-2 pb-4">
                                        {optionalInputs.map((input: any) => (
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
                            <CodeBlock wrap code={`${process.env.NEXT_PUBLIC_APP_URL}/api/sabflow/trigger/${flowId}`} />
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Send a POST request to this URL with any JSON body.
                            </p>
                        </div>
                    )}

                    {triggerType === 'schedule' && (
                        <div className="space-y-3">
                            <Label>Schedule</Label>
                            <Input
                                value={selectedNodeData.schedule || ''}
                                onChange={e => handleDataChange({ schedule: e.target.value })}
                                placeholder="5m, 1h, 1d — or cron: * * * * *"
                                className="font-mono text-xs"
                            />
                            <div className="rounded-md bg-muted/40 border border-border/60 p-2.5 text-[11px] text-muted-foreground space-y-1">
                                <p className="font-semibold text-foreground/80">Accepted formats:</p>
                                <p>• <code className="bg-background/60 px-1 rounded">30s</code>, <code className="bg-background/60 px-1 rounded">5m</code>, <code className="bg-background/60 px-1 rounded">1h</code>, <code className="bg-background/60 px-1 rounded">2d</code> — interval since last run</p>
                                <p>• <code className="bg-background/60 px-1 rounded">0 9 * * 1-5</code> — 5-field UTC cron (min hr dom mon dow)</p>
                                <p>• <code className="bg-background/60 px-1 rounded">*/15 * * * *</code> — every 15 minutes</p>
                            </div>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                The cron runner checks every minute. Ensure <code className="bg-muted px-1 rounded">CRON_SECRET</code> is configured for production.
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
                                            <AppConnectionSetup app={selectedApp} flowId={flowId} onConnectionSaved={onConnectionSaved || (() => { })} isTrigger={true} />
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
            return renderConditionRules('rules', 'logicType');
        }

        return null;
    };

    // ─── Panel theme ───────────────────────────────────────────────────────────

    const isAction = node.type === 'action';
    const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNodeData.appId);
    const blockType = (selectedNodeData?.blockType as string) ?? (node as any).type ?? '';
    const isStickyNote = blockType === 'sticky_note' || (node as any).type === 'sticky_note';

    const panelTheme = (() => {
        // Sticky note
        if (isStickyNote) {
            return {
                label: 'NOTE',
                subLabel: 'Sticky note',
                gradient: 'from-yellow-500/15 via-yellow-500/5 to-transparent',
                badgeBg: 'bg-yellow-500/10 dark:bg-yellow-400/10',
                badgeText: 'text-yellow-600 dark:text-yellow-400',
                iconBg: 'bg-yellow-500/10 dark:bg-yellow-400/10',
                iconText: 'text-yellow-600 dark:text-yellow-400',
                icon: StickyNote,
            };
        }

        // Bubble blocks
        if (BUBBLE_TYPES.includes(blockType)) {
            const bubbleIcons: Record<string, React.ElementType> = {
                text_bubble: MessageSquare,
                image_bubble: Image,
                video_bubble: Video,
                audio_bubble: Music,
                embed_bubble: Code2,
            };
            const bubbleLabels: Record<string, string> = {
                text_bubble: 'Text Bubble',
                image_bubble: 'Image Bubble',
                video_bubble: 'Video Bubble',
                audio_bubble: 'Audio Bubble',
                embed_bubble: 'Embed Bubble',
            };
            return {
                label: 'BUBBLE',
                subLabel: bubbleLabels[blockType] || 'Message bubble',
                gradient: 'from-zinc-500/15 via-zinc-500/5 to-transparent',
                badgeBg: 'bg-zinc-500/10 dark:bg-zinc-400/10',
                badgeText: 'text-zinc-600 dark:text-zinc-400',
                iconBg: 'bg-zinc-500/10 dark:bg-zinc-400/10',
                iconText: 'text-zinc-600 dark:text-zinc-400',
                icon: bubbleIcons[blockType] || MessageSquare,
            };
        }

        // Input blocks
        if (INPUT_TYPES.includes(blockType)) {
            const inputIcons: Record<string, React.ElementType> = {
                text_input: Type,
                number_input: Hash,
                email_input: Mail,
                phone_input: Phone,
                date_input: CalendarDays,
                url_input: Link,
                file_input: FileUp,
                buttons: ToggleLeft,
                rating: Star,
                payment: CreditCard,
            };
            const inputLabels: Record<string, string> = {
                text_input: 'Text Input',
                number_input: 'Number Input',
                email_input: 'Email Input',
                phone_input: 'Phone Input',
                date_input: 'Date Input',
                url_input: 'URL Input',
                file_input: 'File Upload',
                buttons: 'Button Choice',
                rating: 'Rating',
                payment: 'Payment',
            };
            return {
                label: 'INPUT',
                subLabel: inputLabels[blockType] || 'User input',
                gradient: 'from-orange-500/15 via-orange-500/5 to-transparent',
                badgeBg: 'bg-orange-500/10 dark:bg-orange-400/10',
                badgeText: 'text-orange-600 dark:text-orange-400',
                iconBg: 'bg-orange-500/10 dark:bg-orange-400/10',
                iconText: 'text-orange-600 dark:text-orange-400',
                icon: inputIcons[blockType] || Type,
            };
        }

        // Logic blocks
        if (LOGIC_TYPES.includes(blockType)) {
            const logicIcons: Record<string, React.ElementType> = {
                set_variable: Variable,
                redirect: ExternalLink,
                script: FileCode,
                wait: Timer,
                ab_test: Shuffle,
                jump: ArrowRight,
                filter: Filter,
            };
            const logicLabels: Record<string, string> = {
                set_variable: 'Set Variable',
                redirect: 'Redirect',
                script: 'Run Script',
                wait: 'Wait / Delay',
                ab_test: 'A/B Test',
                jump: 'Jump to Node',
                filter: 'Filter',
            };
            return {
                label: 'LOGIC',
                subLabel: logicLabels[blockType] || 'Logic block',
                gradient: 'from-purple-500/15 via-purple-500/5 to-transparent',
                badgeBg: 'bg-purple-500/10 dark:bg-purple-400/10',
                badgeText: 'text-purple-600 dark:text-purple-400',
                iconBg: 'bg-purple-500/10 dark:bg-purple-400/10',
                iconText: 'text-purple-600 dark:text-purple-400',
                icon: logicIcons[blockType] || Sliders,
            };
        }

        // AI blocks
        if (AI_TYPES.includes(blockType)) {
            const aiIcons: Record<string, React.ElementType> = {
                ai_message: Bot,
                ai_agent: BrainCircuit,
            };
            const aiLabels: Record<string, string> = {
                ai_message: 'AI Message',
                ai_agent: 'AI Agent',
            };
            return {
                label: 'AI',
                subLabel: aiLabels[blockType] || 'AI block',
                gradient: 'from-violet-500/15 via-violet-500/5 to-transparent',
                badgeBg: 'bg-violet-500/10 dark:bg-violet-400/10',
                badgeText: 'text-violet-600 dark:text-violet-400',
                iconBg: 'bg-violet-500/10 dark:bg-violet-400/10',
                iconText: 'text-violet-600 dark:text-violet-400',
                icon: aiIcons[blockType] || Sparkles,
            };
        }

        // Trigger
        if (node.type === 'trigger') {
            return {
                label: 'TRIGGER',
                subLabel: 'Start of flow',
                gradient: 'from-emerald-500/15 via-emerald-500/5 to-transparent',
                badgeBg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
                badgeText: 'text-emerald-600 dark:text-emerald-400',
                iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
                iconText: 'text-emerald-600 dark:text-emerald-400',
                icon: Zap,
            };
        }

        // Condition
        if (node.type === 'condition') {
            return {
                label: 'CONDITION',
                subLabel: 'Branching logic',
                gradient: 'from-amber-500/15 via-amber-500/5 to-transparent',
                badgeBg: 'bg-amber-500/10 dark:bg-amber-400/10',
                badgeText: 'text-amber-600 dark:text-amber-400',
                iconBg: 'bg-amber-500/10 dark:bg-amber-400/10',
                iconText: 'text-amber-600 dark:text-amber-400',
                icon: GitFork,
            };
        }

        // Default action
        return {
            label: 'ACTION',
            subLabel: selectedApp?.category || 'App integration',
            gradient: 'from-violet-500/15 via-violet-500/5 to-transparent',
            badgeBg: 'bg-violet-500/10 dark:bg-violet-400/10',
            badgeText: 'text-violet-600 dark:text-violet-400',
            iconBg: 'bg-violet-500/10 dark:bg-violet-400/10',
            iconText: selectedApp?.iconColor || 'text-violet-600 dark:text-violet-400',
            icon: selectedApp?.icon || Sparkles,
        };
    })();

    const PanelIcon = panelTheme.icon;

    // ─── Header display name ───────────────────────────────────────────────────

    const headerDisplayName = (() => {
        if (isStickyNote) return 'Sticky Note';
        if (BUBBLE_TYPES.includes(blockType) || INPUT_TYPES.includes(blockType) || LOGIC_TYPES.includes(blockType) || AI_TYPES.includes(blockType)) {
            return panelTheme.subLabel;
        }
        if (node.type === 'action') return selectedApp ? selectedApp.name : 'Select an action';
        if (node.type === 'trigger') return 'Trigger Setup';
        if (node.type === 'condition') return 'Condition Rules';
        return 'Start';
    })();

    // ─── Render ────────────────────────────────────────────────────────────────

    const canDelete = node.type !== 'start' && node.type !== 'trigger';

    return (
        <div className="h-full flex flex-col bg-background">

            {/* ── Typebot-style panel header ─────────────────────────────────── */}
            <div className="shrink-0 border-b border-border/50">

                {/* Color band at top — 3px accent stripe */}
                <div className={cn('h-0.5 w-full', {
                    'bg-zinc-400':   BUBBLE_TYPES.includes(blockType),
                    'bg-orange-400': INPUT_TYPES.includes(blockType),
                    'bg-purple-500': LOGIC_TYPES.includes(blockType) || node.type === 'condition',
                    'bg-emerald-500': node.type === 'trigger',
                    'bg-violet-500': AI_TYPES.includes(blockType) || (!BUBBLE_TYPES.includes(blockType) && !INPUT_TYPES.includes(blockType) && !LOGIC_TYPES.includes(blockType) && node.type !== 'trigger' && node.type !== 'condition' && !isStickyNote),
                    'bg-yellow-400': isStickyNote,
                })} />

                <div className="flex items-center gap-2.5 px-4 py-3">
                    {/* Type icon in colored circle */}
                    <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                        panelTheme.iconBg,
                    )}>
                        <PanelIcon className={cn('h-4 w-4', panelTheme.iconText)} />
                    </div>

                    {/* Title stack */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className={cn(
                                'text-[9.5px] font-bold tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm',
                                panelTheme.badgeBg, panelTheme.badgeText,
                            )}>
                                {panelTheme.label}
                            </span>
                        </div>
                        <h3 className="text-[13.5px] font-semibold text-foreground truncate mt-0.5 leading-tight">
                            {headerDisplayName}
                        </h3>
                    </div>

                    {/* Actions: delete + close */}
                    <div className="flex items-center gap-1 shrink-0">
                        {(canDelete || isStickyNote) && (
                            <button
                                onClick={() => deleteNode(node.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                title="Delete node"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                            title="Close panel"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Content ────────────────────────────────────────────────────── */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-5">

                    {/* Step Name */}
                    {!isStickyNote && (
                        <div className="space-y-1.5">
                            <Label className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                                Step name
                            </Label>
                            <Input
                                value={selectedNodeData.name || ''}
                                onChange={e => handleDataChange({ name: e.target.value })}
                                className="h-9 bg-muted/30 border-border/50 focus:bg-background focus:border-violet-400/60 font-medium text-[13px]"
                                placeholder="Name this step…"
                            />
                        </div>
                    )}

                    {!isStickyNote && <Separator className="bg-border/40" />}

                    {/* App header card for integration nodes */}
                    {selectedApp && isAction && !BUBBLE_TYPES.includes(blockType) && !INPUT_TYPES.includes(blockType) && !LOGIC_TYPES.includes(blockType) && !AI_TYPES.includes(blockType) && (
                        <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted/20 p-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background shadow-sm">
                                <selectedApp.icon className={cn('h-5 w-5', selectedApp.iconColor)} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[13px] font-semibold truncate">{selectedApp.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{selectedApp.category || 'Integration'}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[11px] shrink-0"
                                onClick={() => handleDataChange({ appId: '', actionName: '', inputs: {} })}
                            >
                                Change
                            </Button>
                        </div>
                    )}

                    {/* Main editor content */}
                    <div className="space-y-1">
                        {!isStickyNote && (
                            <Label className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.12em] flex items-center gap-1.5">
                                <Settings2 className="h-3 w-3" />
                                Configuration
                            </Label>
                        )}
                        <div className="pt-1">
                            {renderEditorContent()}
                        </div>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}

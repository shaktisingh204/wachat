
'use client';

import React, { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, ArrowLeft } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useProject } from '@/context/project-context';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { cn } from '@/lib/utils';
import { AppConnectionSetup } from './connections/app-connection-setup';
import { ApiRequestEditor } from './api-request-editor';
import { CodeBlock } from '@/components/wabasimplify/code-block';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Webhook, Calendar, Zap, GitFork, PlayCircle } from 'lucide-react';

const triggers = [
    { id: 'webhook', name: 'Webhook', icon: Webhook, description: 'Trigger this flow by sending a POST request to a unique URL.' },
    { id: 'manual', name: 'Manual', icon: PlayCircle, description: 'Trigger this flow manually from the UI.' },
    { id: 'schedule', name: 'Schedule', icon: Calendar, description: 'Run this flow on a recurring schedule (e.g., every day).' },
    { id: 'app', name: 'App Trigger', icon: Zap, description: 'Start this flow based on an event from another app.' },
];

function NodeInput({ input, value, onChange }: { input: any, value: any, onChange: (val: any) => void }) {
    // This component is now simplified as complex inputs are handled elsewhere.
    return <Input type={input.type || 'text'} placeholder={input.placeholder} value={value} onChange={e => onChange(e.target.value)} />;
}

export function PropertiesPanel({ user, selectedNode, onNodeChange, onNodeRemove, onConnectionSaved, params }: { user: any, selectedNode: any, onNodeChange: (id: string, data: any) => void, onNodeRemove: (id: string) => void, onConnectionSaved: () => void, params: any }) {
    if (!selectedNode) return null;
    
    const handleDataChange = (data: any) => {
        onNodeChange(selectedNode.id, { ...selectedNode.data, ...data });
    };

    const selectedApp = sabnodeAppActions.find(app => app.appId === selectedNode.data.appId);
    const selectedAction = selectedApp?.actions.find(a => a.name === selectedNode.data.actionName);
    const Icon = selectedApp?.icon || Zap;


    const renderEditorContent = () => {
        const isAction = selectedNode.type === 'action';
        const isCondition = selectedNode.type === 'condition';
        const isTrigger = selectedNode.type === 'trigger';

        // --- PRIORITY 1: Handle API Request Action Specifically ---
        if (selectedAction?.name === 'apiRequest') {
            return <ApiRequestEditor data={selectedNode.data} onUpdate={handleDataChange} />;
        }
        
        // --- PRIORITY 2: Handle App/Action Selection ---
        if (isAction || (isTrigger && selectedNode.data.triggerType === 'app')) {
            // Step 1: Choose an App if none is selected
            if (!selectedNode.data.appId) {
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
                                        <div className="grid grid-cols-3 gap-2">
                                            {apps.map(app => {
                                                const AppIcon = app.icon || Zap;
                                                const isConnected = connectedAppIds.has(app.appId) || app.connectionType === 'internal';
                                                return (
                                                     <button 
                                                        type="button" 
                                                        key={app.appId} 
                                                        className="p-2 text-center cursor-pointer hover:bg-accent rounded-lg flex flex-col items-center justify-start gap-1 transition-all border"
                                                        onClick={() => {
                                                            const actionName = app.actions.length === 1 ? app.actions[0].name : '';
                                                            handleDataChange({ appId: app.appId, actionName: actionName, inputs: {} });
                                                        }}
                                                    >
                                                        <AppIcon className={cn("h-6 w-6 mb-1", app.iconColor)}/>
                                                        <p className="text-xs font-medium text-foreground break-words whitespace-normal leading-tight">{app.name}</p>
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

            // Step 2: Handle new connection flow
            if (selectedNode.data.connectionId === 'new' && selectedApp) {
                return <AppConnectionSetup app={selectedApp} onConnectionSaved={onConnectionSaved} flowId={params.flowId} />;
            }
            
            // Step 3: Handle action selection if multiple actions exist
            const actionOptions = selectedApp?.actions.filter(a => isTrigger ? a.isTrigger : !a.isTrigger) || [];
            if (actionOptions.length > 1 && !selectedNode.data.actionName) {
                return (
                    <div className="space-y-2">
                        <Label>Action</Label>
                        <Select value={selectedNode.data.actionName} onValueChange={val => handleDataChange({ actionName: val, inputs: {} })}>
                            <SelectTrigger><SelectValue placeholder="Select an action..."/></SelectTrigger>
                            <SelectContent>
                                {actionOptions.map((action: any) => (<SelectItem key={action.name} value={action.name}>{action.label}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                );
            }
            
            // Step 4: Display inputs for the selected action
            if (selectedAction) {
                return (
                    <div className="space-y-4 pt-4 border-t">
                       <p className="text-sm text-muted-foreground">{selectedAction.description}</p>
                       {selectedAction.inputs.map((input: any) => (<div key={input.name} className="space-y-2"><Label>{input.label}</Label><NodeInput input={input} value={selectedNode.data.inputs[input.name] || ''} onChange={val => handleDataChange({ inputs: {...selectedNode.data.inputs, [input.name]: val} })}/></div>))}
                   </div>
               );
            }
        }

        // --- PRIORITY 3: Handle Trigger Node ---
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

        // --- PRIORITY 4: Handle Condition Node ---
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
                             <Button variant="ghost" size="sm" onClick={() => handleDataChange({ appId: '', actionName: '', inputs: {} })}>
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

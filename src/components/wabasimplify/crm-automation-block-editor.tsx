'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { useEffect, useState } from 'react';
import { getCrmEmailTemplates } from '@/app/actions/crm-email-templates.actions';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface CrmAutomationBlockEditorProps {
    node: any;
    onUpdate: (data: any) => void;
}

const TriggerEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
    <div className="space-y-2">
        <Label>Trigger Tag</Label>
        <p className="text-xs text-muted-foreground">The exact name of the tag that should start this workflow.</p>
        <Input 
            placeholder="e.g., new_lead" 
            value={data.tagName || ''}
            onChange={(e) => onUpdate({ ...data, tagName: e.target.value })}
        />
    </div>
);

const DelayEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label>Delay Duration</Label>
            <Input 
                type="number"
                value={data.delayValue || '1'}
                onChange={(e) => onUpdate({ ...data, delayValue: Number(e.target.value) })}
            />
        </div>
         <div className="space-y-2">
            <Label>Unit</Label>
            <Select value={data.delayUnit || 'days'} onValueChange={(val) => onUpdate({ ...data, delayUnit: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                </SelectContent>
            </Select>
        </div>
    </div>
);

const SendEmailEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => {
    const [templates, setTemplates = useState<WithId<CrmEmailTemplate>[]>([]);

    useEffect(() => {
        getCrmEmailTemplates().then(setTemplates);
    }, []);
    
    return (
        <div className="space-y-2">
            <Label>Email Template</Label>
            <Select value={data.templateId || ''} onValueChange={(val) => onUpdate({ ...data, templateId: val })}>
                <SelectTrigger><SelectValue placeholder="Select an email template..." /></SelectTrigger>
                <SelectContent searchable>
                    {templates.map(template => (
                        <SelectItem key={template._id.toString()} value={template._id.toString()}>{template.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
};

const AddTagEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
     <div className="space-y-2">
        <Label>Tag Name</Label>
        <p className="text-xs text-muted-foreground">The tag to add to the contact.</p>
        <Input 
            placeholder="e.g., contacted, follow_up" 
            value={data.tagName || ''}
            onChange={(e) => onUpdate({ ...data, tagName: e.target.value })}
        />
    </div>
);


const CreateTaskEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
     <div className="space-y-2">
        <Label>Task Title</Label>
        <Input 
            placeholder="e.g. Follow up with {{contact.name}}" 
            value={data.taskTitle || ''}
            onChange={(e) => onUpdate({ ...data, taskTitle: e.target.value })}
        />
    </div>
);

const ConditionEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => {
    const rules = data.rules || [{ field: '', operator: 'equals', value: '' }];

    const handleRuleChange = (index: number, field: string, value: string) => {
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [field]: value };
        onUpdate({ ...data, rules: newRules });
    };

    const addRule = () => {
        onUpdate({ ...data, rules: [...rules, { field: '', operator: 'equals', value: '' }]});
    };

    const removeRule = (index: number) => {
        onUpdate({ ...data, rules: rules.filter((_: any, i: number) => i !== index) });
    };

    return (
        <div className="space-y-4">
            <RadioGroup value={data.logicType || 'AND'} onValueChange={(val) => onUpdate({ ...data, logicType: val })} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="AND" id="logic-and"/><Label htmlFor="logic-and">Match ALL conditions (AND)</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="OR" id="logic-or"/><Label htmlFor="logic-or">Match ANY condition (OR)</Label></div>
            </RadioGroup>
            
            <div className="space-y-3">
                {rules.map((rule: any, index: number) => (
                    <div key={index} className="p-3 border rounded-md space-y-2 relative">
                        <Button variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6" onClick={() => removeRule(index)}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </Button>
                        <Select value={rule.field} onValueChange={(val) => handleRuleChange(index, 'field', val)}>
                            <SelectTrigger><SelectValue placeholder="Select a field..."/></SelectTrigger>
                            <SelectContent><SelectItem value="contact.status">Contact Status</SelectItem><SelectItem value="contact.tag">Contact Tag</SelectItem></SelectContent>
                        </Select>
                        <Select value={rule.operator} onValueChange={(val) => handleRuleChange(index, 'operator', val)}>
                            <SelectTrigger><SelectValue placeholder="Select operator..."/></SelectTrigger>
                            <SelectContent><SelectItem value="equals">Equals</SelectItem><SelectItem value="not_equals">Does not equal</SelectItem><SelectItem value="contains">Contains</SelectItem></SelectContent>
                        </Select>
                        <Input placeholder="Value" value={rule.value} onChange={(e) => handleRuleChange(index, 'value', e.target.value)} />
                    </div>
                ))}
            </div>
            <Button variant="outline" size="sm" onClick={addRule}><Plus className="mr-2 h-4 w-4" />Add Condition</Button>
        </div>
    );
};


export function CrmAutomationBlockEditor({ node, onUpdate }: { node: any, onUpdate: (data: any) => void }) {
    if (!node) return null;
    
    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ ...node.data, label: e.target.value });
    };

    const handleDataUpdate = (newData: any) => {
        onUpdate({ ...node.data, ...newData });
    };

    const renderEditorContent = () => {
        switch (node.type) {
            case 'triggerTagAdded': return <TriggerEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'delay': return <DelayEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'actionSendEmail': return <SendEmailEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'actionAddTag': return <AddTagEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'actionCreateTask': return <CreateTaskEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'condition': return <ConditionEditor data={node.data} onUpdate={handleDataUpdate} />;
            default: return <p className="text-sm text-muted-foreground">No settings for this block type.</p>
        }
    }

    return (
        <div className="space-y-4 h-full flex flex-col">
            <h3 className="text-lg font-semibold">Properties</h3>
             <div className="space-y-2">
                <Label>Block Label</Label>
                <Input value={node.data.label} onChange={handleLabelChange} />
            </div>
            <Separator />
            <ScrollArea className="flex-1">
                <div className="pr-2 space-y-4">
                     {renderEditorContent()}
                </div>
            </ScrollArea>
        </div>
    );
}

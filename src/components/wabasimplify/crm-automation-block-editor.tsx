'use client';

import {
  Label,
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Accordion,
  ZoruAccordionContent,
  ZoruAccordionItem,
  ZoruAccordionTrigger,
  Input,
  RadioGroup,
  ZoruRadioGroupItem,
  Separator,
  ScrollArea,
} from '@/components/zoruui';
import { useEffect, useState } from 'react';
import { getCrmEmailTemplates } from '@/app/actions/crm-email-templates.actions';
import { Plus, Trash2 } from 'lucide-react';

import type { WithId, CrmEmailTemplate } from '@/lib/definitions';

interface CrmAutomationBlockEditorProps {
    node: any;
    onUpdate: (data: any) => void;
}

const TriggerEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
    <div className="space-y-2">
        <ZoruLabel>Trigger Tag</ZoruLabel>
        <p className="text-xs text-muted-foreground">The exact name of the tag that should start this workflow.</p>
        <ZoruInput 
            placeholder="e.g., new_lead" 
            value={data.tagName || ''}
            onChange={(e) => onUpdate({ ...data, tagName: e.target.value })}
        />
    </div>
);

const DelayEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
    <div className="space-y-4">
        <div className="space-y-2">
            <ZoruLabel>Delay Duration</ZoruLabel>
            <ZoruInput 
                type="number"
                value={data.delayValue || '1'}
                onChange={(e) => onUpdate({ ...data, delayValue: Number(e.target.value) })}
            />
        </div>
         <div className="space-y-2">
            <ZoruLabel>Unit</ZoruLabel>
            <ZoruSelect value={data.delayUnit || 'days'} onValueChange={(val) => onUpdate({ ...data, delayUnit: val })}>
                <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="minutes">Minutes</ZoruSelectItem>
                    <ZoruSelectItem value="hours">Hours</ZoruSelectItem>
                    <ZoruSelectItem value="days">Days</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
        </div>
    </div>
);

const SendEmailEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => {
    const [templates, setTemplates] = useState<WithId<CrmEmailTemplate>[]>([]);

    useEffect(() => {
        getCrmEmailTemplates().then(setTemplates);
    }, []);
    
    return (
        <div className="space-y-2">
            <ZoruLabel>Email Template</ZoruLabel>
            <ZoruSelect value={data.templateId || ''} onValueChange={(val) => onUpdate({ ...data, templateId: val })}>
                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select an email template..." /></ZoruSelectTrigger>
                <ZoruSelectContent {...({ searchable: true } as any)}>
                    {templates.map(template => (
                        <ZoruSelectItem key={template._id.toString()} value={template._id.toString()}>{template.name}</ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>
        </div>
    )
};

const AddTagEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
     <div className="space-y-2">
        <ZoruLabel>Tag Name</ZoruLabel>
        <p className="text-xs text-muted-foreground">The tag to add to the contact.</p>
        <ZoruInput 
            placeholder="e.g., contacted, follow_up" 
            value={data.tagName || ''}
            onChange={(e) => onUpdate({ ...data, tagName: e.target.value })}
        />
    </div>
);

const CreateTaskEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
     <div className="space-y-2">
        <ZoruLabel>Task Title</ZoruLabel>
        <ZoruInput 
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
            <ZoruRadioGroup value={data.logicType || 'AND'} onValueChange={(val) => onUpdate({ ...data, logicType: val })} className="flex gap-4">
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="AND" id="logic-and"/><ZoruLabel htmlFor="logic-and">Match ALL conditions (AND)</ZoruLabel></div>
                <div className="flex items-center space-x-2"><ZoruRadioGroupItem value="OR" id="logic-or"/><ZoruLabel htmlFor="logic-or">Match ANY condition (OR)</ZoruLabel></div>
            </ZoruRadioGroup>
            
            <div className="space-y-3">
                {rules.map((rule: any, index: number) => (
                    <div key={index} className="p-3 border rounded-md space-y-2 relative">
                        <ZoruButton variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6" onClick={() => removeRule(index)}>
                            <Trash2 className="h-4 w-4 text-destructive"/>
                        </ZoruButton>
                        <ZoruSelect value={rule.field} onValueChange={(val) => handleRuleChange(index, 'field', val)}>
                            <ZoruSelectTrigger><ZoruSelectValue placeholder="Select a field..."/></ZoruSelectTrigger>
                            <ZoruSelectContent><ZoruSelectItem value="contact.status">Contact Status</ZoruSelectItem><ZoruSelectItem value="contact.tag">Contact Tag</ZoruSelectItem></ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect value={rule.operator} onValueChange={(val) => handleRuleChange(index, 'operator', val)}>
                            <ZoruSelectTrigger><ZoruSelectValue placeholder="Select operator..."/></ZoruSelectTrigger>
                            <ZoruSelectContent><ZoruSelectItem value="equals">Equals</ZoruSelectItem><ZoruSelectItem value="not_equals">Does not equal</ZoruSelectItem><ZoruSelectItem value="contains">Contains</ZoruSelectItem></ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruInput placeholder="Value" value={rule.value} onChange={(e) => handleRuleChange(index, 'value', e.target.value)} />
                    </div>
                ))}
            </div>
            <ZoruButton variant="outline" size="sm" onClick={addRule}><Plus className="mr-2 h-4 w-4" />Add Condition</ZoruButton>
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
                <ZoruLabel>Block Label</ZoruLabel>
                <ZoruInput value={node.data.label} onChange={handleLabelChange} />
            </div>
            <ZoruSeparator />
            <ZoruScrollArea className="flex-1">
                <div className="pr-2 space-y-4">
                     {renderEditorContent()}
                </div>
            </ZoruScrollArea>
        </div>
    );
}

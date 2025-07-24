
'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Textarea } from '../ui/textarea';
import type { WithId, CrmEmailTemplate } from '@/lib/definitions';
import { useEffect, useState } from 'react';
import { getCrmEmailTemplates } from '@/app/actions/crm-email-templates.actions';

interface CrmAutomationBlockEditorProps {
    node: any;
    onUpdate: (data: any) => void;
}

const TriggerEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
    <div className="space-y-2">
        <Label>Trigger Tag</Label>
        <p className="text-xs text-muted-foreground">Select the tag that should start this automation when it's added to a contact.</p>
        {/* In a real app, this would be a dropdown of available tags */}
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
    const [templates, setTemplates] = useState<WithId<CrmEmailTemplate>[]>([]);

    useEffect(() => {
        getCrmEmailTemplates().then(setTemplates);
    }, []);
    
    return (
        <div className="space-y-2">
            <Label>Email Template</Label>
            <Select value={data.templateId || ''} onValueChange={(val) => onUpdate({ ...data, templateId: val })}>
                <SelectTrigger><SelectValue placeholder="Select an email template..." /></SelectTrigger>
                <SelectContent>
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

const ConditionEditor = ({ data, onUpdate }: { data: any, onUpdate: (data: any) => void }) => (
     <div className="space-y-4">
        <div className="space-y-2">
            <Label>Check Variable</Label>
            <Input placeholder="{{contact.status}}" value={data.variable || ''} onChange={(e) => onUpdate({...data, variable: e.target.value})} />
        </div>
        <div className="space-y-2">
            <Label>Operator</Label>
             <Select value={data.operator || 'equals'} onValueChange={(val) => onUpdate({ ...data, operator: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="equals">Equals</SelectItem>
                    <SelectItem value="not_equals">Does not equal</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                </SelectContent>
            </Select>
        </div>
        <div className="space-y-2">
            <Label>Value</Label>
            <Input placeholder="e.g. qualified" value={data.value || ''} onChange={(e) => onUpdate({...data, value: e.target.value})}/>
        </div>
    </div>
);


export function CrmAutomationBlockEditor({ node, onUpdate }: CrmAutomationBlockEditorProps) {
    if (!node) return null;
    
    const handleLabelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate({ ...node.data, label: e.target.value });
    };

    const handleDataUpdate = (newData: any) => {
        onUpdate({ ...node.data, ...newData });
    };

    const renderEditorContent = () => {
        switch (node.type) {
            case 'triggerTagAdded':
                return <TriggerEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'delay':
                return <DelayEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'actionSendEmail':
                return <SendEmailEditor data={node.data} onUpdate={handleDataUpdate} />;
             case 'actionAddTag':
                return <AddTagEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'actionCreateTask':
                return <CreateTaskEditor data={node.data} onUpdate={handleDataUpdate} />;
            case 'condition':
                return <ConditionEditor data={node.data} onUpdate={handleDataUpdate} />;
            default:
                return <p className="text-sm text-muted-foreground">No settings for this block type.</p>
        }
    }

    return (
        <div className="space-y-4">
            <Accordion type="multiple" className="w-full" defaultValue={['settings']}>
                <AccordionItem value="settings">
                    <AccordionTrigger>Settings</AccordionTrigger>
                    <AccordionContent className="space-y-4 pt-2">
                        <div className="space-y-2">
                            <Label>Block Label</Label>
                            <Input value={node.data.label} onChange={handleLabelChange} />
                        </div>
                        {renderEditorContent()}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}

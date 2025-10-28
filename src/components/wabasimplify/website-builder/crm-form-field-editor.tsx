
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { FormField } from '@/lib/definitions';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface CrmFormFieldEditorProps {
    field: FormField;
    onUpdate: (updatedField: Partial<FormField>) => void;
    onRemove: () => void;
}

const crmFieldMappingOptions = [
    { value: 'name', label: 'Contact Name' },
    { value: 'email', label: 'Contact Email' },
    { value: 'phone', label: 'Contact Phone' },
    { value: 'organisation', label: 'Organisation Name' },
    { value: 'designation', label: 'Designation' },
    { value: 'dealName', label: 'Lead Subject' },
    { value: 'description', label: 'Lead Description' },
    { value: 'leadSource', label: 'Lead Source' },
];

export function CrmFormFieldEditor({ field, onUpdate, onRemove }: CrmFormFieldEditorProps) {
    const handleUpdate = (prop: keyof FormField, value: any) => {
        onUpdate({ [prop]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Field Type</Label>
                <Select value={field.type} onValueChange={(val) => handleUpdate('type', val)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="text">Text</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="textarea">Text Area</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="select">Select</SelectItem>
                        <SelectItem value="checkbox">Checkbox</SelectItem>
                        <SelectItem value="radio">Radio Group</SelectItem>
                        <SelectItem value="date">Date</SelectItem>
                        <SelectItem value="file">File Upload</SelectItem>
                        <SelectItem value="acceptance">Acceptance</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-2">
                <Label htmlFor="field-label">Label {field.required && <span className="text-destructive">*</span>}</Label>
                <Input id="field-label" value={field.label} onChange={(e) => handleUpdate('label', e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="fieldId">Map to CRM Field</Label>
                <Select value={field.fieldId || ''} onValueChange={(val) => handleUpdate('fieldId', val)}>
                    <SelectTrigger id="fieldId"><SelectValue placeholder="Select a CRM field..."/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="">-- None (Custom Field) --</SelectItem>
                        {crmFieldMappingOptions.map(opt => (
                             <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">Select which lead property this input should save to.</p>
            </div>
             <div className="space-y-2">
                <Label htmlFor="field-placeholder">Placeholder</Label>
                <Input id="field-placeholder" value={field.placeholder || ''} onChange={(e) => handleUpdate('placeholder', e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="field-description">Description</Label>
                <Input id="field-description" value={field.description || ''} onChange={(e) => handleUpdate('description', e.target.value)} />
            </div>

            {(field.type === 'select' || field.type === 'radio') && (
                <div className="space-y-2">
                    <Label htmlFor="field-options">Options (one per line)</Label>
                    <Textarea id="field-options" value={field.options || ''} onChange={(e) => handleUpdate('options', e.target.value)} />
                </div>
            )}
             <div className="flex items-center space-x-2">
                <Switch id="field-required" checked={field.required} onCheckedChange={(val) => handleUpdate('required', val)} />
                <Label htmlFor="field-required">Required</Label>
            </div>
            <Button variant="destructive" onClick={onRemove} className="w-full">
                Delete Field
            </Button>
        </div>
    );
}

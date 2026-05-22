'use client';

import {
  Label,
  Button,
  Input,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Switch,
  Checkbox,
  RadioGroup,
  ZoruRadioGroupItem,
} from '@/components/zoruui';
import type { FormField } from '@/lib/definitions';

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
                <ZoruLabel>Field Type</ZoruLabel>
                <ZoruSelect value={field.type} onValueChange={(val) => handleUpdate('type', val)}>
                    <ZoruSelectTrigger><ZoruSelectValue /></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="text">Text</ZoruSelectItem>
                        <ZoruSelectItem value="email">Email</ZoruSelectItem>
                        <ZoruSelectItem value="textarea">Text Area</ZoruSelectItem>
                        <ZoruSelectItem value="number">Number</ZoruSelectItem>
                        <ZoruSelectItem value="select">Select</ZoruSelectItem>
                        <ZoruSelectItem value="checkbox">Checkbox</ZoruSelectItem>
                        <ZoruSelectItem value="radio">Radio Group</ZoruSelectItem>
                        <ZoruSelectItem value="date">Date</ZoruSelectItem>
                        <ZoruSelectItem value="file">File Upload</ZoruSelectItem>
                        <ZoruSelectItem value="acceptance">Acceptance</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="field-label">Label {field.required && <span className="text-destructive">*</span>}</ZoruLabel>
                <ZoruInput id="field-label" value={field.label} onChange={(e) => handleUpdate('label', e.target.value)} />
            </div>
             <div className="space-y-2">
                <ZoruLabel htmlFor="fieldId">Map to CRM Field</ZoruLabel>
                <ZoruSelect value={field.fieldId || '__none__'} onValueChange={(val) => handleUpdate('fieldId', val === '__none__' ? '' : val)}>
                    <ZoruSelectTrigger id="fieldId"><ZoruSelectValue placeholder="Select a CRM field..."/></ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="__none__">-- None (Custom Field) --</ZoruSelectItem>
                        {crmFieldMappingOptions.map(opt => (
                             <ZoruSelectItem key={opt.value} value={opt.value}>{opt.label}</ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
                 <p className="text-xs text-muted-foreground">Select which lead property this input should save to.</p>
            </div>
             <div className="space-y-2">
                <ZoruLabel htmlFor="field-placeholder">Placeholder</ZoruLabel>
                <ZoruInput id="field-placeholder" value={field.placeholder || ''} onChange={(e) => handleUpdate('placeholder', e.target.value)} />
            </div>
             <div className="space-y-2">
                <ZoruLabel htmlFor="field-description">Description</ZoruLabel>
                <ZoruInput id="field-description" value={field.description || ''} onChange={(e) => handleUpdate('description', e.target.value)} />
            </div>

            {(field.type === 'select' || field.type === 'radio') && (
                <div className="space-y-2">
                    <ZoruLabel htmlFor="field-options">Options (one per line)</ZoruLabel>
                    <ZoruTextarea id="field-options" value={field.options || ''} onChange={(e) => handleUpdate('options', e.target.value)} />
                </div>
            )}
             <div className="flex items-center space-x-2">
                <ZoruSwitch id="field-required" checked={field.required} onCheckedChange={(val) => handleUpdate('required', val)} />
                <ZoruLabel htmlFor="field-required">Required</ZoruLabel>
            </div>
            <ZoruButton variant="destructive" onClick={onRemove} className="w-full">
                Delete Field
            </ZoruButton>
        </div>
    );
}

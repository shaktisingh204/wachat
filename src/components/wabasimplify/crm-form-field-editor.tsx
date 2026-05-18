
'use client';

import { ZoruLabel, ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
import type { FormField } from '@/lib/definitions';

interface CrmFormFieldEditorProps {
    field: FormField;
    onUpdate: (updatedField: Partial<FormField>) => void;
    onRemove: () => void;
}

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
                        <ZoruSelectItem value="select">ZoruSelect</ZoruSelectItem>
                        <ZoruSelectItem value="checkbox">ZoruCheckbox</ZoruSelectItem>
                        <ZoruSelectItem value="radio">Radio Group</ZoruSelectItem>
                        <ZoruSelectItem value="date">Date</ZoruSelectItem>
                        <ZoruSelectItem value="file">File Upload</ZoruSelectItem>
                        <ZoruSelectItem value="acceptance">Acceptance</ZoruSelectItem>
                        <ZoruSelectItem value="hidden">Hidden</ZoruSelectItem>
                        <ZoruSelectItem value="html">HTML</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="field-label">ZoruLabel</ZoruLabel>
                <ZoruInput id="field-label" value={field.label} onChange={(e) => handleUpdate('label', e.target.value)} />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="field-id">Field ID</ZoruLabel>
                <ZoruInput id="field-id" value={field.fieldId || ''} onChange={(e) => handleUpdate('fieldId', e.target.value)} placeholder="e.g., user_name"/>
                <p className="text-xs text-muted-foreground">A unique ID used for the form data (no spaces).</p>
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

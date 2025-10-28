
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

export function CrmFormFieldEditor({ field, onUpdate, onRemove }: CrmFormFieldEditorProps) {
    const handleUpdate = (prop: keyof FormField, value: any) => {
        onUpdate({ [prop]: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Field Type</Label>
                <p className="font-medium bg-muted p-2 rounded-md">{field.type}</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="field-label">Label</Label>
                <Input id="field-label" value={field.label} onChange={(e) => handleUpdate('label', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="field-id">Field ID</Label>
                <Input id="field-id" value={field.fieldId || ''} disabled readOnly />
                <p className="text-xs text-muted-foreground">This is a fixed ID that maps to your CRM.</p>
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
                Remove Field
            </Button>
        </div>
    );
}

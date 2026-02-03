
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface DatePickerEditorProps {
    component: any;
    updateField: (key: string, value: any) => void;
}

export function DatePickerEditor({ component, updateField }: DatePickerEditorProps) {

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name (ID)</Label>
                <Input id="name" value={component.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
            </div>

            <div className="space-y-2">
                <Label htmlFor="helper-text">Helper Text</Label>
                <Input id="helper-text" value={component['helper-text'] || ''} onChange={(e) => updateField('helper-text', e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="error-message">Error Message</Label>
                <Input id="error-message" value={component['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="min-date">Min Date</Label>
                    <Input id="min-date" value={component['min-date'] || ''} onChange={(e) => updateField('min-date', e.target.value)} placeholder="YYYY-MM-DD" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="max-date">Max Date</Label>
                    <Input id="max-date" value={component['max-date'] || ''} onChange={(e) => updateField('max-date', e.target.value)} placeholder="YYYY-MM-DD" />
                </div>
            </div>

            <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}


'use client';

import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface DatePickerEditorProps {
    component: any;
    updateField: (key: string, value: any) => void;
}

export function DatePickerEditor({ component, updateField }: DatePickerEditorProps) {

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <ZoruLabel htmlFor="name">Name (ID)</ZoruLabel>
                <ZoruInput id="name" value={component.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="label">ZoruLabel</ZoruLabel>
                <ZoruInput id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
            </div>

            <div className="space-y-2">
                <ZoruLabel htmlFor="helper-text">Helper Text</ZoruLabel>
                <ZoruInput id="helper-text" value={component['helper-text'] || ''} onChange={(e) => updateField('helper-text', e.target.value)} />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="error-message">Error Message</ZoruLabel>
                <ZoruInput id="error-message" value={component['error-message'] || ''} onChange={(e) => updateField('error-message', e.target.value)} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="min-date">Min Date</ZoruLabel>
                    <ZoruInput id="min-date" value={component['min-date'] || ''} onChange={(e) => updateField('min-date', e.target.value)} placeholder="YYYY-MM-DD" />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="max-date">Max Date</ZoruLabel>
                    <ZoruInput id="max-date" value={component['max-date'] || ''} onChange={(e) => updateField('max-date', e.target.value)} placeholder="YYYY-MM-DD" />
                </div>
            </div>

            <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}

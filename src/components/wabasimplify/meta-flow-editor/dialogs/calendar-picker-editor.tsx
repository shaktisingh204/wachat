'use client';

import { ZoruInput, ZoruLabel, ZoruSwitch } from '@/components/zoruui';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface CalendarPickerEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function CalendarPickerEditor({ component, updateField }: CalendarPickerEditorProps) {
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <ZoruLabel htmlFor="name">Name (unique identifier)</ZoruLabel>
                <ZoruInput id="name" value={component.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="label">ZoruLabel (shown to user)</ZoruLabel>
                <ZoruInput id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <ZoruLabel htmlFor="min-date">Min Date (e.g., YYYY-MM-DD)</ZoruLabel>
                    <ZoruInput id="min-date" value={component['min-date'] || ''} onChange={(e) => updateField('min-date', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="max-date">Max Date (e.g., YYYY-MM-DD)</ZoruLabel>
                    <ZoruInput id="max-date" value={component['max-date'] || ''} onChange={(e) => updateField('max-date', e.target.value)} />
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <ZoruSwitch 
                    id="is-range-selector" 
                    checked={component['is-range-selector'] || false} 
                    onCheckedChange={(checked) => updateField('is-range-selector', checked)} 
                />
                <ZoruLabel htmlFor="is-range-selector">Enable Range Selection</ZoruLabel>
            </div>
            
            <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}

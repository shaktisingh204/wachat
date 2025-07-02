
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface CalendarPickerEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function CalendarPickerEditor({ component, updateField }: CalendarPickerEditorProps) {
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name (unique identifier)</Label>
                <Input id="name" value={component.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="label">Label (shown to user)</Label>
                <Input id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="min-date">Min Date (e.g., YYYY-MM-DD)</Label>
                    <Input id="min-date" value={component['min-date'] || ''} onChange={(e) => updateField('min-date', e.target.value)} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="max-date">Max Date (e.g., YYYY-MM-DD)</Label>
                    <Input id="max-date" value={component['max-date'] || ''} onChange={(e) => updateField('max-date', e.target.value)} />
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                    id="is-range-selector" 
                    checked={component['is-range-selector'] || false} 
                    onCheckedChange={(checked) => updateField('is-range-selector', checked)} 
                />
                <Label htmlFor="is-range-selector">Enable Range Selection</Label>
            </div>
            
            <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}

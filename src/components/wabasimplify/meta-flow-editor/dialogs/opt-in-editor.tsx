
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';

interface OptInEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function OptInEditor({ component, updateField }: OptInEditorProps) {
    
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
             <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input id="description" value={component.description || ''} onChange={(e) => updateField('description', e.target.value)} />
            </div>

            <DynamicBooleanInput 
                label="Checked State" 
                value={component['checked-state']} 
                onChange={v => updateField('checked-state', v)} 
                placeholder="e.g. ${data.is_subscribed}"
            />
            
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}

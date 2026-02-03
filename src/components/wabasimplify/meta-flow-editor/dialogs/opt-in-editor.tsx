
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
                <Label htmlFor="name">Name (ID)</Label>
                <Input id="name" value={component.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
                <p className="text-[10px] text-muted-foreground">Unique ID used for data binding (true/false).</p>
            </div>
            <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required />
            </div>

            <div className="space-y-2">
                <Label htmlFor="on-click-action">On Click Action (optional)</Label>
                {/* OptIn usually manages its own state, but sometimes triggers logic. Keeping simple for now, usually no action needed. */}
                <p className="text-xs text-muted-foreground">OptIn components automatically toggle their state.</p>
            </div>

            <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}

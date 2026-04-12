
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';
import { ActionEditor } from '../shared/action-editor';

interface SwitchEditorProps {
    component: any;
    updateField: (key: string, value: any) => void;
    updateAction: (action: any) => void;
}

export function SwitchEditor({ component, updateField, updateAction }: SwitchEditorProps) {

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Name (ID)</Label>
                <Input id="name" value={component.name || ''} onChange={(e) => updateField('name', e.target.value)} required />
            </div>
            {/* Switch in Meta Flow often relies on a separate Text label in a row, or has an implicit label? 
                Actually, v3 Switch has NO label prop. It's just the toggle.
                However, usually we wrap it. But strictly editing 'Switch' component:
            */}
            <div className="space-y-2">
                <Label htmlFor="label">Label (Optional)</Label>
                <p className="text-[10px] text-muted-foreground">Note: Meta Switch component itself might not display a label. Use a Text component next to it if needed.</p>
                <Input id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} />
            </div>

            <ActionEditor
                label="On Change Action"
                action={component['on-change-action']}
                onActionChange={updateAction}
                actionType={"on-change-action" as any}
            />

            <DynamicBooleanInput
                label="Checks (Initial State)"
                value={component.checked}
                onChange={v => updateField('checked', v)}
                placeholder="true / false / ${data.value}"
            />

            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}

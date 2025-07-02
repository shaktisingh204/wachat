
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataSourceEditor } from '../shared/data-source-editor';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';
import { ActionEditor } from '../shared/action-editor';

interface DropdownEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
  updateAction: (action: any) => void;
}

export function DropdownEditor({ component, updateField, updateAction }: DropdownEditorProps) {
    
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
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={component.description || ''} onChange={(e) => updateField('description', e.target.value)} />
            </div>
            
            <DataSourceEditor
                label="Dropdown Options"
                dataSource={component['data-source'] || []}
                updateDataSource={(newDataSource) => updateField('data-source', newDataSource)}
            />

            <ActionEditor
                label="On Select Action (optional)"
                action={component['on-select-action']}
                onActionChange={updateAction}
                actionType="on-select-action"
            />
            
            <DynamicBooleanInput label="Required" value={component.required} onChange={v => updateField('required', v)} />
            <DynamicBooleanInput label="Enabled" value={component.enabled} onChange={v => updateField('enabled', v)} />
            <DynamicBooleanInput label="Visible" value={component.visible} onChange={v => updateField('visible', v)} />
        </div>
    );
}

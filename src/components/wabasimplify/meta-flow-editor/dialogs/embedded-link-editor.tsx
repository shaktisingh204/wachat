
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';
import { ActionEditor } from '../shared/action-editor';


interface EmbeddedLinkEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
  updateAction: (action: any) => void;
  allScreens: any[];
}

export function EmbeddedLinkEditor({ component, updateField, updateAction, allScreens }: EmbeddedLinkEditorProps) {
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="text">Link Text</Label>
                <Input id="text" value={component.text || ''} onChange={(e) => updateField('text', e.target.value)} required maxLength={25} />
            </div>

            <ActionEditor
                label="On Click Action"
                action={component['on-click-action']}
                onActionChange={updateAction}
                actionType="on-click-action"
            />
            
            <DynamicBooleanInput
                label="Visible"
                value={component.visible}
                onChange={v => updateField('visible', v)}
            />
        </div>
    );
}

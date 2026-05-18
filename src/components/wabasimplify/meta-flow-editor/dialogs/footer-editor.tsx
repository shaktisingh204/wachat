'use client';

import { ZoruInput, ZoruLabel, ZoruButton } from '@/components/zoruui';
import { DynamicBooleanInput } from '../shared/dynamic-boolean-input';
import { ActionEditor } from '../shared/action-editor';

interface FooterEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
  updateAction: (action: any) => void;
  allScreens: any[];
}

export function FooterEditor({ component, updateField, updateAction, allScreens }: FooterEditorProps) {
    
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <ZoruLabel htmlFor="label">ZoruButton ZoruLabel</ZoruLabel>
                <ZoruInput id="label" value={component.label || ''} onChange={(e) => updateField('label', e.target.value)} required maxLength={35} />
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="left-caption">Left Caption</ZoruLabel>
                <ZoruInput id="left-caption" value={component['left-caption'] || ''} onChange={(e) => updateField('left-caption', e.target.value)} maxLength={15} />
            </div>
             <div className="space-y-2">
                <ZoruLabel htmlFor="center-caption">Center Caption</ZoruLabel>
                <ZoruInput id="center-caption" value={component['center-caption'] || ''} onChange={(e) => updateField('center-caption', e.target.value)} maxLength={15} />
            </div>
             <div className="space-y-2">
                <ZoruLabel htmlFor="right-caption">Right Caption</ZoruLabel>
                <ZoruInput id="right-caption" value={component['right-caption'] || ''} onChange={(e) => updateField('right-caption', e.target.value)} maxLength={15} />
            </div>
            
            <ActionEditor
                label="On Click Action"
                action={component['on-click-action']}
                onActionChange={updateAction}
                actionType="on-click-action"
            />
            
            <DynamicBooleanInput
                label="Enabled"
                value={component.enabled}
                onChange={v => updateField('enabled', v)}
            />
        </div>
    );
}

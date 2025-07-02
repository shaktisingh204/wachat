
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DynamicBooleanInput } from './dynamic-boolean-input';

interface TextEditorProps {
  component: any;
  updateField: (key: string, value: any) => void;
}

export function TextEditor({ component, updateField }: TextEditorProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="text">Text</Label>
        <Textarea id="text" value={component.text || ''} onChange={e => updateField('text', e.target.value)} />
      </div>
      <DynamicBooleanInput
        label="Visible"
        value={component.visible}
        onChange={(val) => updateField('visible', val)}
      />
      <DynamicBooleanInput
        label="Enabled"
        value={component.enabled}
        onChange={(val) => updateField('enabled', val)}
      />
    </div>
  );
}

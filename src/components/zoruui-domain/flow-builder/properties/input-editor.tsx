'use client';

import { Input, Label, Textarea } from '@/components/sabcrm/20ui/compat';
interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function InputEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="input-text">Question to Ask</Label>
            <Textarea id="input-text" placeholder="e.g., What is your name?" value={node.data.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="input-variable">Save Answer to Variable</Label>
            <Input id="input-variable" placeholder="e.g., user_name" value={node.data.variableToSave || ''} onChange={(e) => onUpdate({ variableToSave: e.target.value })} />
            <p className="text-xs text-[var(--st-text-secondary)]">Use {'{{user_name}}'} in later steps.</p>
        </div>
    </div>
  );
}

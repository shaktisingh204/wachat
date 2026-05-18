'use client';

import { ZoruInput, ZoruLabel, ZoruTextarea } from '@/components/zoruui';
interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function InputEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <ZoruLabel htmlFor="input-text">Question to Ask</ZoruLabel>
            <ZoruTextarea id="input-text" placeholder="e.g., What is your name?" value={node.data.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} />
        </div>
        <div className="space-y-2">
            <ZoruLabel htmlFor="input-variable">Save Answer to Variable</ZoruLabel>
            <ZoruInput id="input-variable" placeholder="e.g., user_name" value={node.data.variableToSave || ''} onChange={(e) => onUpdate({ variableToSave: e.target.value })} />
            <p className="text-xs text-muted-foreground">Use {'{{user_name}}'} in later steps.</p>
        </div>
    </div>
  );
}

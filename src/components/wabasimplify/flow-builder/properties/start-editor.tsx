
'use client';

import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function StartEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <ZoruLabel htmlFor="triggerKeywords">Trigger Keywords</ZoruLabel>
        <ZoruInput
          id="triggerKeywords"
          placeholder="e.g., help, menu"
          value={node.data.triggerKeywords || ''}
          onChange={(e) => onUpdate({ triggerKeywords: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Comma-separated keywords to start this flow.</p>
      </div>
       <div className="space-y-2">
        <ZoruLabel htmlFor="startMessage">Starting Message (Optional)</ZoruLabel>
        <ZoruTextarea
          id="startMessage"
          placeholder="e.g., Welcome! Let's get started."
          value={node.data.startMessage || ''}
          onChange={(e) => onUpdate({ startMessage: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">This message will be sent when the flow is triggered.</p>
      </div>
    </div>
  );
}

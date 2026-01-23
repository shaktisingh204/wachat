
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function StartEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="triggerKeywords">Trigger Keywords</Label>
        <Input
          id="triggerKeywords"
          placeholder="e.g., help, menu"
          value={node.data.triggerKeywords || ''}
          onChange={(e) => onUpdate({ ...node.data, triggerKeywords: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">Comma-separated keywords to start this flow.</p>
      </div>
       <div className="space-y-2">
        <Label htmlFor="startMessage">Starting Message (Optional)</Label>
        <Textarea
          id="startMessage"
          placeholder="e.g., Welcome! Let's get started."
          value={node.data.startMessage || ''}
          onChange={(e) => onUpdate({ ...node.data, startMessage: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">This message will be sent when the flow is triggered.</p>
      </div>
    </div>
  );
}

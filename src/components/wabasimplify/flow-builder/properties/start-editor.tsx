
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function StartEditor({ node, onUpdate }: EditorProps) {
  return (
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
  );
}


'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function DelayEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="delay-seconds">Delay (seconds)</Label>
      <Input id="delay-seconds" type="number" min="1" value={node.data.delaySeconds || 1} onChange={(e) => onUpdate({ ...node.data, delaySeconds: parseFloat(e.target.value) })} />
    </div>
  );
}

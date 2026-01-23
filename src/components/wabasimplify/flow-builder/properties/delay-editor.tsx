
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function DelayEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="delay-seconds">Delay (seconds)</Label>
            <Input id="delay-seconds" type="number" min="1" value={node.data.delaySeconds || 1} onChange={(e) => onUpdate({ delaySeconds: parseFloat(e.target.value) })} />
        </div>
        <div className="flex items-center space-x-2">
            <Switch id="typing-indicator" checked={node.data.showTyping} onCheckedChange={(checked) => onUpdate({ showTyping: checked })} />
            <Label htmlFor="typing-indicator">Show typing indicator</Label>
        </div>
    </div>
  );
}

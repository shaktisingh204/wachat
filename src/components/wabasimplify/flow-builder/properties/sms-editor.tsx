
'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function SmsEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-2">
        <Label htmlFor="sms-text">SMS Text</Label>
        <Textarea id="sms-text" placeholder="Enter SMS text..." value={node.data.text || ''} onChange={(e) => onUpdate({ ...node.data, text: e.target.value })} className="h-32" />
    </div>
  );
}

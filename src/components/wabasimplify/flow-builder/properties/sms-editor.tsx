
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function SmsEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="sms-recipient">Recipient Phone</Label>
            <Input id="sms-recipient" placeholder="e.g. {{waId}} or a phone number" value={node.data.recipient || ''} onChange={e => onUpdate({ recipient: e.target.value })} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="sms-text">SMS Text</Label>
            <Textarea id="sms-text" placeholder="Enter SMS text..." value={node.data.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} className="h-32" />
        </div>
    </div>
  );
}

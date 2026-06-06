'use client';

import { Input, Label, Textarea } from '@/components/sabcrm/20ui';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function SmsEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sms-recipient">Recipient Phone Number</Label>
        <Input
          id="sms-recipient"
          placeholder="e.g. {{phone_variable}} or +1234567890"
          value={node.data.recipient || ''}
          onChange={(e) => onUpdate({ recipient: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sms-body">SMS Body</Label>
        <Textarea
          id="sms-body"
          placeholder="Enter SMS message body..."
          value={node.data.body || ''}
          onChange={(e) => onUpdate({ body: e.target.value })}
          className="h-32"
        />
      </div>
    </div>
  );
}

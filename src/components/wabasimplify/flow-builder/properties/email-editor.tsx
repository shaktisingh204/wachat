
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function EmailEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="email-recipient">Recipient Email</Label>
            <Input id="email-recipient" placeholder="e.g. {{email_variable}} or static@address.com" value={node.data.recipient || ''} onChange={e => onUpdate({ recipient: e.target.value })} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="email-subject">Email Subject</Label>
            <Input id="email-subject" placeholder="Enter email subject" value={node.data.subject || ''} onChange={(e) => onUpdate({ subject: e.target.value })} />
        </div>
        <div className="space-y-2">
            <Label htmlFor="email-body">Email Body (HTML)</Label>
            <Textarea id="email-body" placeholder="Enter email body..." value={node.data.body || ''} onChange={(e) => onUpdate({ body: e.target.value })} className="h-32" />
        </div>
    </div>
  );
}

'use client';

import { Input, Label, Textarea } from '@/components/zoruui';
interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function EmailEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <ZoruLabel htmlFor="email-recipient">Recipient Email</ZoruLabel>
            <ZoruInput id="email-recipient" placeholder="e.g. {{email_variable}} or static@address.com" value={node.data.recipient || ''} onChange={e => onUpdate({ recipient: e.target.value })} />
        </div>
        <div className="space-y-2">
            <ZoruLabel htmlFor="email-subject">Email Subject</ZoruLabel>
            <ZoruInput id="email-subject" placeholder="Enter email subject" value={node.data.subject || ''} onChange={(e) => onUpdate({ subject: e.target.value })} />
        </div>
        <div className="space-y-2">
            <ZoruLabel htmlFor="email-body">Email Body (HTML)</ZoruLabel>
            <ZoruTextarea id="email-body" placeholder="Enter email body..." value={node.data.body || ''} onChange={(e) => onUpdate({ body: e.target.value })} className="h-32" />
        </div>
    </div>
  );
}

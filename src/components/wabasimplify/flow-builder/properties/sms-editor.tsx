
'use client';

import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function SmsEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2">
            <ZoruLabel htmlFor="sms-recipient">Recipient Phone</ZoruLabel>
            <ZoruInput id="sms-recipient" placeholder="e.g. {{waId}} or a phone number" value={node.data.recipient || ''} onChange={e => onUpdate({ recipient: e.target.value })} />
        </div>
        <div className="space-y-2">
            <ZoruLabel htmlFor="sms-text">SMS Text</ZoruLabel>
            <ZoruTextarea id="sms-text" placeholder="Enter SMS text..." value={node.data.text || ''} onChange={(e) => onUpdate({ text: e.target.value })} className="h-32" />
        </div>
    </div>
  );
}

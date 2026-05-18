
'use client';

import { ZoruSeparator } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function CrmLeadEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <h4 className="font-medium">Contact Info</h4>
        <div className="space-y-2"><ZoruLabel>Name</ZoruLabel><ZoruInput value={node.data.contactName || ''} onChange={e => onUpdate({ contactName: e.target.value })} placeholder="{{variable_for_name}}" /></div>
        <div className="space-y-2"><ZoruLabel>Email</ZoruLabel><ZoruInput value={node.data.email || ''} onChange={e => onUpdate({ email: e.target.value })} placeholder="{{variable_for_email}}" /></div>
        <div className="space-y-2"><ZoruLabel>Phone</ZoruLabel><ZoruInput value={node.data.phone || '{{waId}}'} onChange={e => onUpdate({ phone: e.target.value })} /></div>
        <div className="space-y-2"><ZoruLabel>Company</ZoruLabel><ZoruInput value={node.data.company || ''} onChange={e => onUpdate({ company: e.target.value })} placeholder="Company Name" /></div>
        <ZoruSeparator />
        <h4 className="font-medium">Deal Info</h4>
        <div className="space-y-2"><ZoruLabel>Deal Name</ZoruLabel><ZoruInput value={node.data.dealName || ''} onChange={e => onUpdate({ dealName: e.target.value })} placeholder="e.g. New Website for {{company}}" /></div>
        <div className="space-y-2"><ZoruLabel>Deal Value</ZoruLabel><ZoruInput value={node.data.dealValue || ''} onChange={e => onUpdate({ dealValue: e.target.value })} placeholder="e.g. 5000" /></div>
        <div className="space-y-2"><ZoruLabel>Deal Stage</ZoruLabel><ZoruInput value={node.data.stage || 'New'} onChange={e => onUpdate({ stage: e.target.value })} /></div>
    </div>
  );
}

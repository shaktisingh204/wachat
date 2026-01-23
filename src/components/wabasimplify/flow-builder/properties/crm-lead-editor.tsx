
'use client';

import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function CrmLeadEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <h4 className="font-medium">Contact Info</h4>
        <div className="space-y-2"><Label>Name</Label><Input value={node.data.contactName || ''} onChange={e => onUpdate({...node.data, contactName: e.target.value})} placeholder="{{variable_for_name}}" /></div>
        <div className="space-y-2"><Label>Email</Label><Input value={node.data.email || ''} onChange={e => onUpdate({...node.data, email: e.target.value})} placeholder="{{variable_for_email}}" /></div>
        <div className="space-y-2"><Label>Phone</Label><Input value={node.data.phone || '{{waId}}'} onChange={e => onUpdate({...node.data, phone: e.target.value})} /></div>
        <div className="space-y-2"><Label>Company</Label><Input value={node.data.company || ''} onChange={e => onUpdate({...node.data, company: e.target.value})} placeholder="Company Name" /></div>
        <Separator />
        <h4 className="font-medium">Deal Info</h4>
        <div className="space-y-2"><Label>Deal Name</Label><Input value={node.data.dealName || ''} onChange={e => onUpdate({...node.data, dealName: e.target.value})} placeholder="e.g. New Website for {{company}}" /></div>
        <div className="space-y-2"><Label>Deal Value</Label><Input value={node.data.dealValue || ''} onChange={e => onUpdate({...node.data, dealValue: e.target.value})} placeholder="e.g. 5000" /></div>
        <div className="space-y-2"><Label>Deal Stage</Label><Input value={node.data.stage || 'New'} onChange={e => onUpdate({...node.data, stage: e.target.value})} /></div>
    </div>
  );
}


'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function QrCodeEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2"><Label>Data to Encode</Label><Input value={node.data.qrData || ''} onChange={e => onUpdate({ ...node.data, qrData: e.target.value })} placeholder="https://example.com or {{my_short_link}}"/></div>
        <div className="space-y-2"><Label>Save Image URL to Variable</Label><Input value={node.data.saveAsVariable || ''} onChange={e => onUpdate({ ...node.data, saveAsVariable: e.target.value })} placeholder="my_qr_code_url" /></div>
    </div>
  );
}

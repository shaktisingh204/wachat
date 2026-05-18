
'use client';

import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function QrCodeEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2"><ZoruLabel>Data to Encode</ZoruLabel><ZoruInput value={node.data.qrData || ''} onChange={e => onUpdate({ qrData: e.target.value })} placeholder="https://example.com or {{my_short_link}}"/></div>
        <div className="space-y-2"><ZoruLabel>Save Image URL to Variable</ZoruLabel><ZoruInput value={node.data.saveAsVariable || ''} onChange={e => onUpdate({ saveAsVariable: e.target.value })} placeholder="my_qr_code_url" /></div>
    </div>
  );
}

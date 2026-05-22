'use client';

import { Input, Label } from '@/components/zoruui';
interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ShortLinkEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2"><ZoruLabel>URL to Shorten</ZoruLabel><ZoruInput value={node.data.longUrl || ''} onChange={e => onUpdate({ longUrl: e.target.value })} placeholder="https://example.com/very-long-link" /></div>
        <div className="space-y-2"><ZoruLabel>Custom Alias (Optional)</ZoruLabel><ZoruInput value={node.data.alias || ''} onChange={e => onUpdate({ alias: e.target.value })} placeholder="summer-sale" /></div>
        <div className="space-y-2"><ZoruLabel>Save Link to Variable</ZoruLabel><ZoruInput value={node.data.saveAsVariable || ''} onChange={e => onUpdate({ saveAsVariable: e.target.value })} placeholder="my_short_link" /></div>
    </div>
  );
}

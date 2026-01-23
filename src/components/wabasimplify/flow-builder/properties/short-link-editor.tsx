
'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface EditorProps {
  node: any;
  onUpdate: (data: any) => void;
}

export function ShortLinkEditor({ node, onUpdate }: EditorProps) {
  return (
    <div className="space-y-4">
        <div className="space-y-2"><Label>URL to Shorten</Label><Input value={node.data.longUrl || ''} onChange={e => onUpdate({ longUrl: e.target.value })} placeholder="https://example.com/very-long-link" /></div>
        <div className="space-y-2"><Label>Custom Alias (Optional)</Label><Input value={node.data.alias || ''} onChange={e => onUpdate({ alias: e.target.value })} placeholder="summer-sale" /></div>
        <div className="space-y-2"><Label>Save Link to Variable</Label><Input value={node.data.saveAsVariable || ''} onChange={e => onUpdate({ saveAsVariable: e.target.value })} placeholder="my_short_link" /></div>
    </div>
  );
}

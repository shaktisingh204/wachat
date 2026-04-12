'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function TwitterCardGeneratorPage() {
  const [f, setF] = useState({ card: 'summary_large_image', site: '', title: '', description: '', image: '' });
  const update = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const out = useMemo(() => [
    f.card && `<meta name="twitter:card" content="${f.card}" />`,
    f.site && `<meta name="twitter:site" content="${f.site}" />`,
    f.title && `<meta name="twitter:title" content="${f.title}" />`,
    f.description && `<meta name="twitter:description" content="${f.description}" />`,
    f.image && `<meta name="twitter:image" content="${f.image}" />`,
  ].filter(Boolean).join('\n'), [f]);

  return (
    <ToolShell title="Twitter Card Generator" description="Generate Twitter/X Card meta tags.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Card</Label>
          <select className="border rounded h-9 px-2 w-full bg-background" value={f.card} onChange={(e) => update('card', e.target.value)}>
            <option value="summary">summary</option>
            <option value="summary_large_image">summary_large_image</option>
            <option value="player">player</option>
            <option value="app">app</option>
          </select>
        </div>
        <div className="space-y-1"><Label>Site (@handle)</Label><Input value={f.site} onChange={(e) => update('site', e.target.value)} placeholder="@yourhandle" /></div>
        <div className="space-y-1"><Label>Title</Label><Input value={f.title} onChange={(e) => update('title', e.target.value)} /></div>
        <div className="space-y-1"><Label>Image URL</Label><Input value={f.image} onChange={(e) => update('image', e.target.value)} /></div>
        <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea value={f.description} onChange={(e) => update('description', e.target.value)} /></div>
      </div>
      <Button onClick={() => navigator.clipboard.writeText(out)}>Copy</Button>
      <Textarea readOnly value={out} className="min-h-[200px] font-mono text-xs" />
    </ToolShell>
  );
}

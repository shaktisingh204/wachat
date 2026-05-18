'use client';

import { ZoruButton, ZoruInput, ZoruLabel, ZoruTextarea, cn, ZoruCard } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

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
    <ToolShell title="Twitter ZoruCard Generator" description="Generate Twitter/X ZoruCard meta tags.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><ZoruLabel>ZoruCard</ZoruLabel>
          <select className="border rounded h-9 px-2 w-full bg-background" value={f.card} onChange={(e) => update('card', e.target.value)}>
            <option value="summary">summary</option>
            <option value="summary_large_image">summary_large_image</option>
            <option value="player">player</option>
            <option value="app">app</option>
          </select>
        </div>
        <div className="space-y-1"><ZoruLabel>Site (@handle)</ZoruLabel><ZoruInput value={f.site} onChange={(e) => update('site', e.target.value)} placeholder="@yourhandle" /></div>
        <div className="space-y-1"><ZoruLabel>Title</ZoruLabel><ZoruInput value={f.title} onChange={(e) => update('title', e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>Image URL</ZoruLabel><ZoruInput value={f.image} onChange={(e) => update('image', e.target.value)} /></div>
        <div className="space-y-1 md:col-span-2"><ZoruLabel>Description</ZoruLabel><ZoruTextarea value={f.description} onChange={(e) => update('description', e.target.value)} /></div>
      </div>
      <ZoruButton onClick={() => navigator.clipboard.writeText(out)}>Copy</ZoruButton>
      <ZoruTextarea readOnly value={out} className="min-h-[200px] font-mono text-xs" />
    </ToolShell>
  );
}

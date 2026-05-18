'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function OgTagGeneratorPage() {
  const [f, setF] = useState({ title: '', type: 'website', url: '', image: '', description: '', siteName: '' });
  const update = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  const out = useMemo(() => [
    f.title && `<meta property="og:title" content="${f.title}" />`,
    f.type && `<meta property="og:type" content="${f.type}" />`,
    f.url && `<meta property="og:url" content="${f.url}" />`,
    f.image && `<meta property="og:image" content="${f.image}" />`,
    f.description && `<meta property="og:description" content="${f.description}" />`,
    f.siteName && `<meta property="og:site_name" content="${f.siteName}" />`,
  ].filter(Boolean).join('\n'), [f]);

  return (
    <ToolShell title="Open Graph Generator" description="Generate Open Graph meta tags for social sharing.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><ZoruLabel>Title</ZoruLabel><ZoruInput value={f.title} onChange={(e) => update('title', e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>Type</ZoruLabel><ZoruInput value={f.type} onChange={(e) => update('type', e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>URL</ZoruLabel><ZoruInput value={f.url} onChange={(e) => update('url', e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>Image URL</ZoruLabel><ZoruInput value={f.image} onChange={(e) => update('image', e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>Site name</ZoruLabel><ZoruInput value={f.siteName} onChange={(e) => update('siteName', e.target.value)} /></div>
        <div className="space-y-1 md:col-span-2"><ZoruLabel>Description</ZoruLabel><ZoruTextarea value={f.description} onChange={(e) => update('description', e.target.value)} /></div>
      </div>
      <ZoruButton onClick={() => navigator.clipboard.writeText(out)}>Copy</ZoruButton>
      <ZoruTextarea readOnly value={out} className="min-h-[200px] font-mono text-xs" />
    </ToolShell>
  );
}

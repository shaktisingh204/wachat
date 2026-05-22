'use client';

import { Button, Input, Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function HreflangGeneratorPage() {
  const [rows, setRows] = useState([{ lang: 'en', url: '' }]);
  const add = () => setRows((r) => [...r, { lang: '', url: '' }]);
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const update = (i: number, k: 'lang' | 'url', v: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const out = useMemo(
    () => rows.filter((r) => r.lang && r.url).map((r) => `<link rel="alternate" hreflang="${r.lang}" href="${r.url}" />`).join('\n'),
    [rows],
  );

  return (
    <ToolShell title="Hreflang Tag Generator" description="Generate hreflang alternate links for multilingual pages.">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <ZoruInput className="w-28" value={r.lang} onChange={(e) => update(i, 'lang', e.target.value)} placeholder="en-us" />
            <ZoruInput value={r.url} onChange={(e) => update(i, 'url', e.target.value)} placeholder="https://example.com/en" />
            <ZoruButton variant="ghost" onClick={() => remove(i)}>×</ZoruButton>
          </div>
        ))}
        <ZoruButton variant="outline" onClick={add}>+ Add language</ZoruButton>
      </div>
      <ZoruTextarea readOnly value={out} className="min-h-[200px] font-mono text-xs" />
      <ZoruButton onClick={() => navigator.clipboard.writeText(out)}>Copy</ZoruButton>
    </ToolShell>
  );
}

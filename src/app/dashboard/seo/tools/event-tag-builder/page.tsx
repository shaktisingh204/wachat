'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function EventTagBuilderPage() {
  const [name, setName] = useState('purchase');
  const [rows, setRows] = useState([{ k: 'currency', v: 'USD' }, { k: 'value', v: '49.99' }]);

  const snippet = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const r of rows) if (r.k) obj[r.k] = r.v;
    return `gtag('event', '${name}', ${JSON.stringify(obj, null, 2)});`;
  }, [name, rows]);

  return (
    <ToolShell title="GA4 Event Tag Builder" description="Build a gtag('event', ...) snippet for GA4.">
      <div className="space-y-1"><ZoruLabel>Event name</ZoruLabel><ZoruInput value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <ZoruInput value={r.k} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, k: e.target.value } : rr))} placeholder="param" />
            <ZoruInput value={r.v} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, v: e.target.value } : rr))} placeholder="value" />
            <ZoruButton variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</ZoruButton>
          </div>
        ))}
        <ZoruButton variant="outline" onClick={() => setRows((r) => [...r, { k: '', v: '' }])}>+ Add param</ZoruButton>
      </div>
      <ZoruTextarea readOnly value={snippet} className="min-h-[160px] font-mono text-xs" />
      <ZoruButton onClick={() => navigator.clipboard.writeText(snippet)}>Copy</ZoruButton>
    </ToolShell>
  );
}

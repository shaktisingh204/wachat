'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
      <div className="space-y-1"><Label>Event name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input value={r.k} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, k: e.target.value } : rr))} placeholder="param" />
            <Input value={r.v} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, v: e.target.value } : rr))} placeholder="value" />
            <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setRows((r) => [...r, { k: '', v: '' }])}>+ Add param</Button>
      </div>
      <Textarea readOnly value={snippet} className="min-h-[160px] font-mono text-xs" />
      <Button onClick={() => navigator.clipboard.writeText(snippet)}>Copy</Button>
    </ToolShell>
  );
}

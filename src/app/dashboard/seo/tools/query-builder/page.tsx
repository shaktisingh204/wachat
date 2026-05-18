'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function QueryBuilderPage() {
  const [base, setBase] = useState('');
  const [rows, setRows] = useState<{ k: string; v: string }[]>([{ k: '', v: '' }]);
  const out = useMemo(() => {
    try {
      if (!base) return '';
      const url = new URL(base);
      for (const r of rows) if (r.k) url.searchParams.set(r.k, r.v);
      return url.toString();
    } catch { return ''; }
  }, [base, rows]);

  return (
    <ToolShell title="Query String Builder" description="Build URL query strings from key/value pairs.">
      <ZoruInput value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://example.com/page" />
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <ZoruInput value={r.k} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, k: e.target.value } : rr))} placeholder="key" />
            <ZoruInput value={r.v} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, v: e.target.value } : rr))} placeholder="value" />
            <ZoruButton variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</ZoruButton>
          </div>
        ))}
        <ZoruButton variant="outline" onClick={() => setRows((r) => [...r, { k: '', v: '' }])}>+ Add param</ZoruButton>
      </div>
      {out && <div className="font-mono text-xs bg-muted p-3 rounded break-all">{out}</div>}
      {out && <ZoruButton onClick={() => navigator.clipboard.writeText(out)}>Copy</ZoruButton>}
    </ToolShell>
  );
}

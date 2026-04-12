'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
      <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://example.com/page" />
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input value={r.k} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, k: e.target.value } : rr))} placeholder="key" />
            <Input value={r.v} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, v: e.target.value } : rr))} placeholder="value" />
            <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setRows((r) => [...r, { k: '', v: '' }])}>+ Add param</Button>
      </div>
      {out && <div className="font-mono text-xs bg-muted p-3 rounded break-all">{out}</div>}
      {out && <Button onClick={() => navigator.clipboard.writeText(out)}>Copy</Button>}
    </ToolShell>
  );
}

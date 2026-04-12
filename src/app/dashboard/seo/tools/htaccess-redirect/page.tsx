'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function HtaccessRedirectPage() {
  const [rows, setRows] = useState([{ from: '/old', to: '/new', type: '301' }]);
  const out = useMemo(() => {
    const lines = ['RewriteEngine On'];
    for (const r of rows) if (r.from && r.to) lines.push(`RewriteRule ^${r.from.replace(/^\//, '')}$ ${r.to} [R=${r.type},L]`);
    return lines.join('\n');
  }, [rows]);

  return (
    <ToolShell title=".htaccess Redirect Generator" description="Generate Apache .htaccess rewrite redirects.">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input value={r.from} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, from: e.target.value } : rr))} placeholder="/old" />
            <Input value={r.to} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, to: e.target.value } : rr))} placeholder="/new" />
            <select className="border rounded h-9 px-2 bg-background" value={r.type} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, type: e.target.value } : rr))}>
              <option value="301">301</option><option value="302">302</option>
            </select>
            <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setRows((r) => [...r, { from: '', to: '', type: '301' }])}>+ Add rule</Button>
      </div>
      <Textarea readOnly value={out} className="min-h-[180px] font-mono text-xs" />
    </ToolShell>
  );
}

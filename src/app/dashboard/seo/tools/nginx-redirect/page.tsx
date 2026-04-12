'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function NginxRedirectPage() {
  const [rows, setRows] = useState([{ from: '/old', to: '/new', type: 'permanent' }]);
  const out = useMemo(() => {
    const lines = ['server {', '    listen 80;', '    server_name example.com;'];
    for (const r of rows) if (r.from && r.to) lines.push(`    rewrite ^${r.from}$ ${r.to} ${r.type};`);
    lines.push('}');
    return lines.join('\n');
  }, [rows]);

  return (
    <ToolShell title="Nginx Redirect Generator" description="Generate nginx rewrite rules.">
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <Input value={r.from} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, from: e.target.value } : rr))} placeholder="/old" />
            <Input value={r.to} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, to: e.target.value } : rr))} placeholder="/new" />
            <select className="border rounded h-9 px-2 bg-background" value={r.type} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, type: e.target.value } : rr))}>
              <option value="permanent">permanent (301)</option><option value="redirect">redirect (302)</option>
            </select>
            <Button variant="ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</Button>
          </div>
        ))}
        <Button variant="outline" onClick={() => setRows((r) => [...r, { from: '', to: '', type: 'permanent' }])}>+ Add rule</Button>
      </div>
      <Textarea readOnly value={out} className="min-h-[220px] font-mono text-xs" />
    </ToolShell>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { diffLines } from '@/lib/seo-tools/text-utils';

export default function TextComparePage() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const rows = useMemo(() => diffLines(a, b), [a, b]);
  const diffs = rows.filter((r) => !r.equal).length;

  return (
    <ToolShell title="Text Compare (Diff)" description="Line-by-line side-by-side comparison of two texts.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="Original text…" className="min-h-[240px]" />
        <Textarea value={b} onChange={(e) => setB(e.target.value)} placeholder="Changed text…" className="min-h-[240px]" />
      </div>
      <div className="text-sm text-muted-foreground">{diffs} differing line(s)</div>
      <Card>
        <CardContent className="p-0">
          <div className="font-mono text-xs">
            {rows.map((r, i) => (
              <div key={i} className={`grid grid-cols-2 border-b ${r.equal ? '' : 'bg-yellow-50 dark:bg-yellow-950/20'}`}>
                <div className="px-2 py-1 border-r">{r.left ?? <span className="text-muted-foreground">—</span>}</div>
                <div className="px-2 py-1">{r.right ?? <span className="text-muted-foreground">—</span>}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </ToolShell>
  );
}

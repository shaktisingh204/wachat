'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function hash(s: string, salt: number) {
  let h = salt;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export default function KeywordTrendsPage() {
  const [kw, setKw] = useState('');
  const [submitted, setSubmitted] = useState('');
  const data = useMemo(() => {
    if (!submitted) return [];
    return Array.from({ length: 12 }, (_, i) => 30 + (hash(submitted, i + 1) % 70));
  }, [submitted]);
  const max = Math.max(...data, 1);
  const w = 480, h = 160, pad = 20;
  const path = data
    .map((v, i) => {
      const x = pad + ((w - pad * 2) * i) / (data.length - 1 || 1);
      const y = h - pad - ((h - pad * 2) * v) / max;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    })
    .join(' ');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <ToolShell title="Keyword Trends" description="12-month interest trend for a keyword (deterministic demo).">
      <div className="flex gap-2">
        <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="e.g. ai tools" />
        <Button onClick={() => setSubmitted(kw)}>Show trend</Button>
      </div>
      {submitted && (
        <Card>
          <CardContent className="p-4">
            <div className="text-sm font-semibold mb-2">{submitted}</div>
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-40">
              <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
              {data.map((v, i) => {
                const x = pad + ((w - pad * 2) * i) / (data.length - 1 || 1);
                const y = h - pad - ((h - pad * 2) * v) / max;
                return <circle key={i} cx={x} cy={y} r="3" fill="hsl(var(--primary))" />;
              })}
            </svg>
            <div className="grid grid-cols-12 text-[10px] text-muted-foreground text-center">
              {months.map((m) => <div key={m}>{m}</div>)}
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

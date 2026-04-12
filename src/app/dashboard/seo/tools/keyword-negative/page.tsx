'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const COMMON_NEGATIVES = [
  'free', 'cheap', 'diy', 'meaning', 'definition', 'wikipedia', 'quotes',
  'lyrics', 'torrent', 'crack', 'nude', 'porn', 'jobs', 'salary', 'reviews',
  'used', 'refurbished', 'download', 'pdf', 'images', 'video', 'near me',
];

export default function KeywordNegativePage() {
  const [kw, setKw] = useState('');
  const negatives = useMemo(() => {
    const lines = kw.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter(Boolean);
    const set = new Set<string>();
    for (const line of lines) {
      for (const neg of COMMON_NEGATIVES) if (line.includes(neg)) set.add(neg);
    }
    return Array.from(set);
  }, [kw]);

  return (
    <ToolShell title="Negative Keyword Tool" description="Identify common negative keywords in your keyword list.">
      <Textarea value={kw} onChange={(e) => setKw(e.target.value)} placeholder="One keyword per line…" className="min-h-[220px]" />
      <Card>
        <CardContent className="p-4">
          <div className="font-semibold text-sm mb-2">Common negatives</div>
          <div className="flex flex-wrap gap-1">
            {COMMON_NEGATIVES.map((n) => (
              <span key={n} className={`px-2 py-0.5 text-xs rounded border ${negatives.includes(n) ? 'bg-red-100 border-red-400 text-red-700' : 'bg-muted'}`}>-{n}</span>
            ))}
          </div>
          {negatives.length > 0 && <div className="mt-3 text-sm text-muted-foreground">{negatives.length} negatives detected in your list.</div>}
        </CardContent>
      </Card>
    </ToolShell>
  );
}

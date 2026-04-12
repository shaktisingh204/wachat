'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { wordFrequency } from '@/lib/seo-tools/text-utils';

export default function WordFrequencyPage() {
  const [text, setText] = useState('');
  const freq = useMemo(() => wordFrequency(text, 100), [text]);
  const max = freq[0]?.count || 1;

  return (
    <ToolShell title="Word Frequency Counter" description="Rank the most used words in your content.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste content…" className="min-h-[220px]" />
      <Card>
        <CardContent className="p-4 space-y-2">
          {freq.map((row) => (
            <div key={row.word} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="font-mono">{row.word}</span>
                <span className="text-muted-foreground">{row.count}</span>
              </div>
              <div className="h-1.5 bg-muted rounded">
                <div className="h-full rounded bg-primary" style={{ width: `${(row.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
          {freq.length === 0 && <div className="text-center text-muted-foreground py-6">Start typing to see word frequency.</div>}
        </CardContent>
      </Card>
    </ToolShell>
  );
}

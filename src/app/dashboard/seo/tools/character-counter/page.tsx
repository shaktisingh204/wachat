'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countCharacters, countWords } from '@/lib/seo-tools/text-utils';

export default function CharacterCounterPage() {
  const [text, setText] = useState('');
  const stats = useMemo(() => {
    const limits: Record<string, number> = {
      'Meta title': 60,
      'Meta description': 160,
      Tweet: 280,
      'Facebook post': 63206,
    };
    return {
      total: countCharacters(text, true),
      noSpaces: countCharacters(text, false),
      words: countWords(text),
      limits,
    };
  }, [text]);

  return (
    <ToolShell title="Character Counter" description="Character count with and without spaces, plus common SEO limits.">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your content…"
        className="min-h-[240px]"
      />
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">With spaces</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.noSpaces}</div><div className="text-xs text-muted-foreground">Without spaces</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{stats.words}</div><div className="text-xs text-muted-foreground">Words</div></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-semibold">Common limits</div>
          {Object.entries(stats.limits).map(([label, limit]) => {
            const pct = Math.min(100, (stats.total / limit) * 100);
            const over = stats.total > limit;
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className={over ? 'text-red-600' : 'text-muted-foreground'}>
                    {stats.total} / {limit}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded">
                  <div className={`h-full rounded ${over ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </ToolShell>
  );
}

'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const MODIFIERS = [
  'how to', 'what is', 'where', 'when', 'why', 'best', 'top', 'cheap', 'free',
  'near me', 'for beginners', 'ideas', 'examples', 'guide', 'tutorial',
];

export default function LongTailKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const run = () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    const out: string[] = [];
    for (const m of MODIFIERS) {
      out.push(m.startsWith('how') || m.startsWith('what') || m.startsWith('where') || m.startsWith('when') || m.startsWith('why')
        ? `${m} ${s}`
        : `${s} ${m}`);
    }
    setResults(out);
  };

  return (
    <ToolShell title="Long-Tail Keyword Expander" description="Expand a seed keyword with long-tail modifiers for more specific queries.">
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run}>Expand</Button>
      </div>
      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <ul className="grid md:grid-cols-2 gap-2 text-sm">
              {results.map((r) => (
                <li key={r} className="p-2 rounded bg-muted/40">{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

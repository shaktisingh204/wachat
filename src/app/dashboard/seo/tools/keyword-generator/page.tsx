'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PREFIXES = ['best', 'top', 'cheap', 'buy', 'free', 'affordable', 'premium', 'professional', 'online', 'local'];
const SUFFIXES = ['2026', 'near me', 'for beginners', 'guide', 'review', 'tips', 'ideas', 'tutorial', 'services', 'company'];

export default function KeywordGeneratorPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const run = () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    const out = new Set<string>();
    for (const p of PREFIXES) out.add(`${p} ${s}`);
    for (const sf of SUFFIXES) out.add(`${s} ${sf}`);
    setResults(Array.from(out).slice(0, 20));
  };

  return (
    <ToolShell title="Keyword Generator" description="Generate keyword variants from a seed term using common prefixes and suffixes.">
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword (e.g. running shoes)"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run}>Generate</Button>
      </div>
      {results.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2">
            {results.map((r) => (
              <Badge key={r} variant="secondary" className="text-sm">{r}</Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

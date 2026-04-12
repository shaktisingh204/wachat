'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const PREFIXES = ['best', 'top', 'affordable', 'professional', 'online'];
const SUFFIXES = ['guide', 'tips', 'examples', 'ideas', 'review', 'tutorial', 'services', 'tools', 'company', 'software'];
const MODIFIERS = ['for beginners', 'vs alternatives', 'near me', 'in 2026', 'explained'];

export default function RelatedKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const run = () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    const out = new Set<string>();
    for (const p of PREFIXES) out.add(`${p} ${s}`);
    for (const sf of SUFFIXES) out.add(`${s} ${sf}`);
    for (const m of MODIFIERS) out.add(`${s} ${m}`);
    setResults(Array.from(out));
  };

  return (
    <ToolShell title="Related Keywords" description="Find related keyword ideas based on a seed term.">
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run}>Find Related</Button>
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

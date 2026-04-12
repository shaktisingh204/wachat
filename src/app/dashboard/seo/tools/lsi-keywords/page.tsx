'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SYNONYMS = ['related', 'similar', 'alternative', 'comparable', 'equivalent'];
const TOPICS = ['benefits', 'features', 'types', 'uses', 'examples', 'tips', 'strategies', 'methods', 'techniques', 'trends'];
const CONTEXTS = ['for business', 'for marketing', 'for SEO', 'in 2026', 'explained', 'overview'];

export default function LsiKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const run = () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    const out = new Set<string>();
    for (const syn of SYNONYMS) out.add(`${syn} ${s}`);
    for (const t of TOPICS) out.add(`${s} ${t}`);
    for (const c of CONTEXTS) out.add(`${s} ${c}`);
    setResults(Array.from(out));
  };

  return (
    <ToolShell title="LSI Keywords" description="Generate latent semantic (related) terms for a seed keyword.">
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run}>Generate LSI</Button>
      </div>
      {results.length > 0 && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-2">
            {results.map((r) => (
              <Badge key={r} variant="outline" className="text-sm">{r}</Badge>
            ))}
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

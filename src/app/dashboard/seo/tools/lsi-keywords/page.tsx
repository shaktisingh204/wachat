'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';

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
        <ZoruInput
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <ZoruButton onClick={run}>Generate LSI</ZoruButton>
      </div>
      {results.length > 0 && (
        <ZoruCard>
          <ZoruCardContent className="p-4 flex flex-wrap gap-2">
            {results.map((r) => (
              <ZoruBadge key={r} variant="outline" className="text-sm">{r}</ZoruBadge>
            ))}
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}

'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

void _zoruCn;

const CATEGORIES = {
  Questions: ['how to', 'what is', 'where to find', 'when to', 'why is'],
  Commercial: ['best', 'top', 'cheap', 'buy', 'affordable', 'free'],
  Local: ['near me', 'in my city', 'around me', 'locally'],
  Informational: ['for beginners', 'ideas', 'examples', 'guide', 'tutorial', 'tips'],
};

export default function LongTailKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<Record<string, string[]>>({});

  const run = () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    
    const out: Record<string, string[]> = {};
    for (const [category, mods] of Object.entries(CATEGORIES)) {
      out[category] = mods.map(m => {
        // Questions and Commercial usually prefix the seed
        if (category === 'Questions' || category === 'Commercial') {
           return `${m} ${s}`;
        }
        // Local and Informational usually postfix the seed
        return `${s} ${m}`;
      });
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
      
      {Object.keys(results).length > 0 && (
        <div className="space-y-4">
          {Object.entries(results).map(([category, items]) => (
            <Card key={category}>
              <ZoruCardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-lg">{category}</h3>
                <ul className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                  {items.map((r) => (
                    <li key={r} className="p-2 rounded bg-muted/40">{r}</li>
                  ))}
                </ul>
              </ZoruCardContent>
            </Card>
          ))}
        </div>
      )}
    </ToolShell>
  );
}

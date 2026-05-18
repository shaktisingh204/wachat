'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';

export default function KeywordMixerPage() {
  const [listA, setListA] = useState('');
  const [listB, setListB] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const run = () => {
    const a = listA.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const b = listB.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!a.length || !b.length) return;
    const out: string[] = [];
    for (const x of a) for (const y of b) out.push(`${x} ${y}`);
    setResults(out);
  };

  return (
    <ToolShell title="Keyword Mixer" description="Combine two lists of words into every possible pair combination.">
      <div className="grid md:grid-cols-2 gap-3">
        <ZoruTextarea
          value={listA}
          onChange={(e) => setListA(e.target.value)}
          placeholder="List A (one per line)"
          className="min-h-[180px]"
        />
        <ZoruTextarea
          value={listB}
          onChange={(e) => setListB(e.target.value)}
          placeholder="List B (one per line)"
          className="min-h-[180px]"
        />
      </div>
      <ZoruButton onClick={run} className="w-fit">Mix</ZoruButton>
      {results.length > 0 && (
        <ZoruCard>
          <ZoruCardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">{results.length} combinations</div>
            <div className="grid md:grid-cols-2 gap-1 text-sm max-h-[400px] overflow-auto">
              {results.map((r, i) => (
                <div key={i} className="p-1.5 rounded bg-muted/40">{r}</div>
              ))}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}

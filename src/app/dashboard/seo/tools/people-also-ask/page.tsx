'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const PREFIXES = ['how to', 'what is', 'why is', 'when does', 'where is', 'can i', 'should i'];

export default function PeopleAlsoAskPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true); setResults([]);
    const out = new Set<string>();
    await Promise.all(PREFIXES.map(async (p) => {
      try {
        const res = await fetch('/api/seo-tools/autocomplete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q: `${p} ${q}` }),
        });
        const data = await res.json();
        (data.suggestions || []).forEach((s: string) => out.add(s));
      } catch {}
    }));
    setResults(Array.from(out));
    setLoading(false);
  };

  return (
    <ToolShell title="People Also Ask" description="Question-based autocomplete variants for your seed.">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. seo" onKeyDown={(e) => e.key === 'Enter' && run()} />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Get questions'}</Button>
      </div>
      {results.length > 0 && (
        <Card><CardContent className="p-4 space-y-1">
          {results.map((s, i) => <div key={i} className="text-sm border-b last:border-0 py-1">{s}</div>)}
        </CardContent></Card>
      )}
    </ToolShell>
  );
}

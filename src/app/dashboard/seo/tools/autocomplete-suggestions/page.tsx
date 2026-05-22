'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function AutocompleteSuggestionsPage() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<string[]>([]);
  const [error, setError] = useState('');

  const run = async () => {
    if (!q.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/seo-tools/autocomplete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      setResults(data.suggestions || []);
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Autocomplete Suggestions" description="Google autocomplete for your seed keyword.">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. seo tools" onKeyDown={(e) => e.key === 'Enter' && run()} />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Suggest'}</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
      {results.length > 0 && (
        <Card><ZoruCardContent className="p-4 space-y-1">
          {results.map((s, i) => <div key={i} className="text-sm border-b last:border-0 py-1">{s}</div>)}
        </ZoruCardContent></Card>
      )}
    </ToolShell>
  );
}

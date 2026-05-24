'use client';

import { Button, Input, Card, ZoruCardContent, Badge, cn } from '@/components/zoruui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';


export default function LsiKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(s)}`);
      if (!res.ok) {
        throw new Error('Failed to fetch LSI keywords');
      }
      const data = await res.json();
      setResults(data.slice(0, 50).map((item: { word: string }) => item.word));
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="LSI Keywords" description="Generate latent semantic (related) terms for a seed keyword.">
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && !loading && run()}
          disabled={loading}
        />
        <Button onClick={run} disabled={loading || !seed.trim()}>
          {loading ? 'Generating...' : 'Generate LSI'}
        </Button>
      </div>
      
      {error && (
        <div className="text-red-500 text-sm mt-2">{error}</div>
      )}
      
      {results.length > 0 && !loading && !error && (
        <Card className="mt-4">
          <ZoruCardContent className="p-4 flex flex-wrap gap-2">
            {results.map((r) => (
              <Badge key={r} variant="outline" className="text-sm">{r}</Badge>
            ))}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}

'use client';

import { Button, Input, Card, CardBody, Badge, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Copy, Loader2, Check } from 'lucide-react';

interface LsiKeyword {
  word: string;
  score: number;
  tags?: string[];
}

export default function LsiKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [related, setRelated] = useState<LsiKeyword[]>([]);
  const [triggers, setTriggers] = useState<LsiKeyword[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const run = async () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    
    setLoading(true);
    setError(null);
    setCopied(false);
    
    try {
      const [resMl, resTrg] = await Promise.all([
        fetch(`https://api.datamuse.com/words?ml=${encodeURIComponent(s)}&max=1000`),
        fetch(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(s)}&max=1000`)
      ]);

      if (!resMl.ok || !resTrg.ok) {
        throw new Error('Failed to fetch LSI keywords');
      }

      const dataMl: LsiKeyword[] = await resMl.json();
      const dataTrg: LsiKeyword[] = await resTrg.json();

      setRelated(dataMl.filter(w => w.word !== s && w.word.length > 2).slice(0, 100));
      setTriggers(dataTrg.filter(w => w.word !== s && w.word.length > 2).slice(0, 100));
    } catch (err: any) {
      setError(err.message || 'An error occurred connecting to Datamuse API.');
      setRelated([]);
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  };

  // Combine and deduplicate
  const allMap = new Map<string, LsiKeyword>();
  triggers.forEach(t => allMap.set(t.word, t));
  related.forEach(r => {
    if (!allMap.has(r.word)) {
      allMap.set(r.word, r);
    } else {
      const existing = allMap.get(r.word)!;
      allMap.set(r.word, { ...existing, score: Math.max(existing.score, r.score) });
    }
  });

  const allKeywords = Array.from(allMap.values()).sort((a, b) => b.score - a.score);

  const copyToClipboard = () => {
    let wordsToCopy: LsiKeyword[] = [];
    if (activeTab === 'triggers') wordsToCopy = triggers;
    else if (activeTab === 'related') wordsToCopy = related;
    else wordsToCopy = allKeywords;

    const text = wordsToCopy.map(w => w.word).join(', ');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderBadgeList = (words: LsiKeyword[]) => {
    if (words.length === 0) return <div className="text-sm text-[var(--st-text-secondary)] py-4 text-center">No results found for this category.</div>;
    return (
      <div className="flex flex-wrap gap-2 mt-4">
        {words.map((r) => (
          <Badge key={r.word} variant="outline" className="text-sm font-medium hover:bg-[var(--st-bg-muted)]/50 transition-colors">
            {r.word}
          </Badge>
        ))}
      </div>
    );
  };

  return (
    <ToolShell title="LSI Keywords" description="Generate authentic latent semantic indexing (LSI) terms algorithmically using Datamuse NLP. Find semantically related terms and co-occurring triggers.">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword (e.g., seo, real estate, apple)"
          onKeyDown={(e) => e.key === 'Enter' && !loading && run()}
          disabled={loading}
          className="max-w-md"
        />
        <Button onClick={run} disabled={loading || !seed.trim()}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            'Generate LSI'
          )}
        </Button>
      </div>
      
      {error && (
        <div className="text-[var(--st-danger)] text-sm mt-4 p-3 bg-[var(--st-danger)] rounded-md border border-[var(--st-border)]">
          {error}
        </div>
      )}
      
      {(related.length > 0 || triggers.length > 0) && !loading && !error && (
        <Card className="mt-8 border-[var(--st-border)] shadow-sm overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b bg-[var(--st-bg-muted)]/20 px-4 py-3 gap-3">
              <ZoruTabsList className="bg-transparent h-auto p-0 gap-2">
                <ZoruTabsTrigger value="all" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-sm rounded-md px-3 py-1.5 h-auto">
                  All LSI ({allKeywords.length})
                </ZoruTabsTrigger>
                <ZoruTabsTrigger value="triggers" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-sm rounded-md px-3 py-1.5 h-auto">
                  Co-occurring ({triggers.length})
                </ZoruTabsTrigger>
                <ZoruTabsTrigger value="related" className="data-[state=active]:bg-[var(--st-bg-secondary)] data-[state=active]:shadow-sm rounded-md px-3 py-1.5 h-auto">
                  Semantics ({related.length})
                </ZoruTabsTrigger>
              </ZoruTabsList>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyToClipboard}
                className="h-9 whitespace-nowrap shrink-0"
              >
                {copied ? <Check className="w-4 h-4 mr-2 text-[var(--st-status-ok)]" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied to Clipboard' : 'Copy List'}
              </Button>
            </div>

            <CardBody className="p-5">
              <ZoruTabsContent value="all" className="mt-0 outline-none">
                <div className="text-sm text-[var(--st-text-secondary)] mb-4">A complete deduplicated list of all LSI and semantically related keywords, sorted by relevance.</div>
                {renderBadgeList(allKeywords)}
              </ZoruTabsContent>
              <ZoruTabsContent value="triggers" className="mt-0 outline-none">
                <div className="text-sm text-[var(--st-text-secondary)] mb-4">Words that statistically co-occur and are frequently triggered by your seed keyword in the same piece of text (True LSI).</div>
                {renderBadgeList(triggers)}
              </ZoruTabsContent>
              <ZoruTabsContent value="related" className="mt-0 outline-none">
                <div className="text-sm text-[var(--st-text-secondary)] mb-4">Words with related meanings, synonyms, and strongly connected semantic concepts.</div>
                {renderBadgeList(related)}
              </ZoruTabsContent>
            </CardBody>
          </Tabs>
        </Card>
      )}
    </ToolShell>
  );
}

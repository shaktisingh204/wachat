'use client';

import { Button, Input, Card, CardBody, Badge, Switch, Label } from '@/components/sabcrm/20ui';
import { cn as _zoruCn, useState, useTransition } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { generateKeywords } from './actions';
import { Loader2 } from 'lucide-react';

void _zoruCn;

export default function KeywordGeneratorPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const [useGoogle, setUseGoogle] = useState(true);
  const [useBing, setUseBing] = useState(true);
  const [useYoutube, setUseYoutube] = useState(true);
  const [useYahoo, setUseYahoo] = useState(false);
  const [useDuckDuckGo, setUseDuckDuckGo] = useState(false);
  const [useWikipedia, setUseWikipedia] = useState(false);
  
  const [useAlphabetSoup, setUseAlphabetSoup] = useState(true);
  const [useQuestions, setUseQuestions] = useState(true);
  const [usePrepositions, setUsePrepositions] = useState(true);
  const [useComparisons, setUseComparisons] = useState(true);

  const run = () => {
    const s = seed.trim();
    if (!s) return;
    
    startTransition(async () => {
      const generated = await generateKeywords(s, {
        google: useGoogle,
        bing: useBing,
        youtube: useYoutube,
        yahoo: useYahoo,
        duckduckgo: useDuckDuckGo,
        wikipedia: useWikipedia,
        alphabet: useAlphabetSoup,
        questions: useQuestions,
        prepositions: usePrepositions,
        comparisons: useComparisons
      });
      setResults(generated);
    });
  };

  const hasEngineSelected = useGoogle || useBing || useYoutube || useYahoo || useDuckDuckGo || useWikipedia;

  return (
    <ToolShell title="Keyword Generator" description="Generate keyword variants from a seed term using live autocomplete suggestions from Google, YouTube, Bing, Yahoo, DuckDuckGo, and Wikipedia.">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Enter seed keyword (e.g. running shoes)"
            onKeyDown={(e) => e.key === 'Enter' && run()}
            disabled={isPending}
          />
          <Button onClick={run} disabled={isPending || !seed.trim() || !hasEngineSelected}>
            {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Generate
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[var(--st-bg-muted)]/50 rounded-lg border flex flex-col gap-3">
            <h4 className="text-sm font-semibold mb-1">Search Engines</h4>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Switch id="google" checked={useGoogle} onCheckedChange={setUseGoogle} disabled={isPending} />
                <Label htmlFor="google">Google</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="youtube" checked={useYoutube} onCheckedChange={setUseYoutube} disabled={isPending} />
                <Label htmlFor="youtube">YouTube</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="bing" checked={useBing} onCheckedChange={setUseBing} disabled={isPending} />
                <Label htmlFor="bing">Bing</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="yahoo" checked={useYahoo} onCheckedChange={setUseYahoo} disabled={isPending} />
                <Label htmlFor="yahoo">Yahoo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="ddg" checked={useDuckDuckGo} onCheckedChange={setUseDuckDuckGo} disabled={isPending} />
                <Label htmlFor="ddg">DuckDuckGo</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="wiki" checked={useWikipedia} onCheckedChange={setUseWikipedia} disabled={isPending} />
                <Label htmlFor="wiki">Wikipedia</Label>
              </div>
            </div>
          </div>
          
          <div className="p-4 bg-[var(--st-bg-muted)]/50 rounded-lg border flex flex-col gap-3">
            <h4 className="text-sm font-semibold mb-1">Modifiers</h4>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Switch id="alphabet" checked={useAlphabetSoup} onCheckedChange={setUseAlphabetSoup} disabled={isPending || !hasEngineSelected} />
                <Label htmlFor="alphabet">A-Z Modifier</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="questions" checked={useQuestions} onCheckedChange={setUseQuestions} disabled={isPending || !hasEngineSelected} />
                <Label htmlFor="questions">Questions</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="prepositions" checked={usePrepositions} onCheckedChange={setUsePrepositions} disabled={isPending || !hasEngineSelected} />
                <Label htmlFor="prepositions">Prepositions</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="comparisons" checked={useComparisons} onCheckedChange={setUseComparisons} disabled={isPending || !hasEngineSelected} />
                <Label htmlFor="comparisons">Comparisons</Label>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {results.length > 0 && (
        <Card className="mt-4">
          <div className="p-4 border-b bg-[var(--st-bg-muted)]/20 flex justify-between items-center">
            <h3 className="font-medium">Generated Keywords ({results.length})</h3>
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(results.join('\n'))}>
              Copy All
            </Button>
          </div>
          <CardBody className="p-4 flex flex-wrap gap-2 max-h-[500px] overflow-y-auto">
            {results.map((r) => (
              <Badge key={r} variant="secondary" className="text-sm font-medium">{r}</Badge>
            ))}
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}

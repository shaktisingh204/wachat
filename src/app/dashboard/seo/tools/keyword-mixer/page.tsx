'use client';

import { Button, Textarea, Card, CardBody, cn, Checkbox, Alert, AlertTitle, AlertDescription, Input } from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { AlertTriangle, Copy } from 'lucide-react';

type MatchType = 'broad' | 'phrase' | 'exact' | 'bmm';

const MATCH_TYPES: { id: MatchType; label: string }[] = [
  { id: 'broad', label: 'Broad Match' },
  { id: 'phrase', label: 'Phrase Match ("")' },
  { id: 'exact', label: 'Exact Match ([])' },
  { id: 'bmm', label: 'BMM (+)' }
];

export default function KeywordMixerPage() {
  const [listA, setListA] = useState('');
  const [listB, setListB] = useState('');
  const [listC, setListC] = useState('');
  const [listD, setListD] = useState('');
  const [matchTypes, setMatchTypes] = useState<MatchType[]>(['broad']);
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  
  const [results, setResults] = useState<string[]>([]);
  const [warning, setWarning] = useState('');
  const [totalGen, setTotalGen] = useState(0);

  const toggleMatchType = (type: MatchType) => {
    setMatchTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const run = () => {
    setWarning('');
    const lists = [listA, listB, listC, listD]
      .map(list => list.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
      .filter(list => list.length > 0);

    if (lists.length < 2) {
      setResults([]);
      setTotalGen(0);
      return;
    }
    
    if (matchTypes.length === 0) {
      setWarning('Please select at least one match type or wrapper output.');
      setResults([]);
      setTotalGen(0);
      return;
    }

    const MAX_LIMIT = 10000;
    const baseCombinations = lists.reduce((acc, list) => acc * list.length, 1);
    const totalPossible = baseCombinations * matchTypes.length;
    
    let out: string[] = lists[0];
    
    // Create base combinations
    for (let i = 1; i < lists.length; i++) {
      const nextOut: string[] = [];
      for (const x of out) {
        for (const y of lists[i]) {
          if (nextOut.length >= MAX_LIMIT) break;
          nextOut.push(`${x} ${y}`);
        }
        if (nextOut.length >= MAX_LIMIT) break;
      }
      out = nextOut;
    }
    
    // Apply Match Types and Wrappers
    let finalOut: string[] = [];
    for (const combined of out) {
      if (finalOut.length >= MAX_LIMIT) break;
      
      for (const mType of matchTypes) {
        if (finalOut.length >= MAX_LIMIT) break;
        
        let formatted = combined;
        switch (mType) {
          case 'exact':
            formatted = `[${combined}]`;
            break;
          case 'phrase':
            formatted = `"${combined}"`;
            break;
          case 'bmm':
            formatted = combined.split(/\s+/).map(word => `+${word}`).join(' ');
            break;
          case 'broad':
          default:
            formatted = combined;
            break;
        }
        
        if (prefix || suffix) {
          formatted = `${prefix}${formatted}${suffix}`;
        }
        
        finalOut.push(formatted);
      }
    }

    setResults(finalOut);
    setTotalGen(totalPossible);
    
    if (totalPossible > MAX_LIMIT) {
      setWarning(`Your lists generate ${totalPossible.toLocaleString()} combinations. Display is limited to the first ${MAX_LIMIT.toLocaleString()} results to prevent browser lockup.`);
    }
  };

  return (
    <ToolShell title="Keyword Mixer" description="Combine up to four lists of words into every possible combination. Add Google Ads match types and custom wrappers.">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Textarea
          value={listA}
          onChange={(e) => setListA(e.target.value)}
          placeholder="List A (one per line)"
          className="min-h-[180px]"
        />
        <Textarea
          value={listB}
          onChange={(e) => setListB(e.target.value)}
          placeholder="List B (one per line)"
          className="min-h-[180px]"
        />
        <Textarea
          value={listC}
          onChange={(e) => setListC(e.target.value)}
          placeholder="List C (optional)"
          className="min-h-[180px]"
        />
        <Textarea
          value={listD}
          onChange={(e) => setListD(e.target.value)}
          placeholder="List D (optional)"
          className="min-h-[180px]"
        />
      </div>
      
      <div className="flex flex-col lg:flex-row lg:items-center gap-6 mt-4 p-4 bg-[var(--st-bg-muted)]/30 rounded-lg border">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Match Types (Wrapper Outputs):</span>
          <div className="flex flex-wrap items-center gap-4">
            {MATCH_TYPES.map((mt) => (
              <label key={mt.id} className="flex items-center gap-2 cursor-pointer">
                <Checkbox 
                  checked={matchTypes.includes(mt.id)} 
                  onCheckedChange={() => toggleMatchType(mt.id)} 
                />
                <span className="text-sm">{mt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="h-px w-full lg:h-12 lg:w-px bg-border my-2 lg:my-0"></div>

        <div className="flex flex-col gap-2 flex-1">
          <span className="text-sm font-medium">Custom Wrappers (Optional):</span>
          <div className="flex items-center gap-2">
            <Input 
              placeholder="Prefix (e.g. buy)" 
              value={prefix} 
              onChange={(e) => setPrefix(e.target.value)}
              className="max-w-[150px]"
            />
            <span className="text-[var(--st-text-secondary)] text-sm">keyword</span>
            <Input 
              placeholder="Suffix (e.g. online)" 
              value={suffix} 
              onChange={(e) => setSuffix(e.target.value)}
              className="max-w-[150px]"
            />
          </div>
        </div>
        
        <Button onClick={run} size="lg" className="w-full lg:w-auto shrink-0 mt-2 lg:mt-0">
          Mix Keywords
        </Button>
      </div>

      {warning && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>
            {warning}
          </AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <Card className="mt-4">
          <CardBody className="p-4">
            <div className="text-xs text-[var(--st-text-secondary)] mb-2 flex justify-between items-center">
              <span>Showing {results.length.toLocaleString()} of {totalGen.toLocaleString()} combinations</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigator.clipboard.writeText(results.join('\n'))}
                className="h-8 gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy All
              </Button>
            </div>
            <Textarea 
              readOnly 
              className="min-h-[300px] font-mono text-sm leading-relaxed" 
              value={results.join('\n')} 
            />
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}

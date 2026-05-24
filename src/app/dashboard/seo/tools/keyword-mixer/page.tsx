'use client';

import { 
  Button, 
  Textarea, 
  Card, 
  ZoruCardContent, 
  cn,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Alert,
  ZoruAlertTitle,
  ZoruAlertDescription
} from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { AlertTriangle } from 'lucide-react';

void _zoruCn;

type MatchType = 'broad' | 'phrase' | 'exact' | 'bmm';

export default function KeywordMixerPage() {
  const [listA, setListA] = useState('');
  const [listB, setListB] = useState('');
  const [matchType, setMatchType] = useState<MatchType>('broad');
  const [results, setResults] = useState<string[]>([]);
  const [warning, setWarning] = useState('');

  const run = () => {
    setWarning('');
    const a = listA.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    const b = listB.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (!a.length || !b.length) {
      setResults([]);
      return;
    }
    
    const MAX_LIMIT = 10000;
    const totalPossible = a.length * b.length;
    let hasWarning = false;
    
    if (totalPossible > MAX_LIMIT) {
      hasWarning = true;
    }

    const out: string[] = [];
    for (const x of a) {
      for (const y of b) {
        if (out.length >= MAX_LIMIT) break;
        
        const combined = `${x} ${y}`;
        let formatted = combined;
        
        switch (matchType) {
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
        
        out.push(formatted);
      }
      if (out.length >= MAX_LIMIT) break;
    }
    
    setResults(out);
    if (hasWarning) {
      setWarning(`Your lists generated ${totalPossible.toLocaleString()} combinations. Display is limited to the first ${MAX_LIMIT.toLocaleString()} results.`);
    }
  };

  return (
    <ToolShell title="Keyword Mixer" description="Combine two lists of words into every possible pair combination.">
      <div className="grid md:grid-cols-2 gap-3">
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
      </div>
      
      <div className="flex items-center gap-3 mt-2">
        <Select value={matchType} onValueChange={(val: MatchType) => setMatchType(val)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Match Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="broad">Broad Match</SelectItem>
            <SelectItem value="phrase">Phrase Match ("")</SelectItem>
            <SelectItem value="exact">Exact Match ([])</SelectItem>
            <SelectItem value="bmm">BMM (+)</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={run} className="w-fit">Mix</Button>
      </div>

      {warning && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <ZoruAlertTitle>Limit Exceeded</ZoruAlertTitle>
          <ZoruAlertDescription>
            {warning}
          </ZoruAlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <Card className="mt-4">
          <ZoruCardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">{results.length} combinations</div>
            <div className="grid md:grid-cols-2 gap-1 text-sm max-h-[400px] overflow-auto">
              {results.map((r, i) => (
                <div key={i} className="p-1.5 rounded bg-muted/40">{r}</div>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}

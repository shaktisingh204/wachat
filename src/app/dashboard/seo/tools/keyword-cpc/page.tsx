'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const COMMERCIAL = ['buy', 'best', 'price', 'cheap', 'deal', 'discount', 'purchase', 'order', 'shop', 'cost'];

function estimateCpc(kw: string): { low: number; high: number; intent: string } {
  const lc = kw.toLowerCase();
  const words = lc.split(/\s+/).filter(Boolean);
  let intentMultiplier = 0.5;
  let intent = 'Informational';
  for (const c of COMMERCIAL) {
    if (lc.includes(c)) {
      intentMultiplier = 2.5;
      intent = 'Commercial';
      break;
    }
  }
  const lengthFactor = Math.max(0.3, 1 - (words.length - 1) * 0.12);
  const base = 0.8 * intentMultiplier * lengthFactor;
  return {
    low: Math.max(0.05, +(base * 0.6).toFixed(2)),
    high: +(base * 2.2).toFixed(2),
    intent,
  };
}

export default function KeywordCpcPage() {
  const [kw, setKw] = useState('');
  const [result, setResult] = useState<ReturnType<typeof estimateCpc> | null>(null);

  const run = () => {
    const s = kw.trim();
    if (!s) return;
    setResult(estimateCpc(s));
  };

  return (
    <ToolShell title="Keyword CPC Estimator" description="Estimate cost-per-click range for a keyword based on intent and length heuristics.">
      <div className="flex gap-2">
        <Input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="Enter a keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run}>Estimate</Button>
      </div>
      {result && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">${result.low}</span>
              <span className="text-muted-foreground">–</span>
              <span className="text-4xl font-bold">${result.high}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Intent: </span>
              <span className="font-medium">{result.intent}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Heuristic estimate based on commercial intent words and keyword length. Use Google Keyword Planner for precise numbers.
            </p>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

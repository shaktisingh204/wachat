'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function difficultyFor(kw: string): number {
  const base = hashString(kw.toLowerCase()) % 100;
  const lengthBoost = Math.max(0, 30 - kw.split(/\s+/).length * 6);
  return Math.min(99, Math.max(1, Math.round(base * 0.7 + lengthBoost)));
}

function label(score: number): { text: string; color: string } {
  if (score < 25) return { text: 'Easy', color: 'text-green-600' };
  if (score < 50) return { text: 'Moderate', color: 'text-yellow-600' };
  if (score < 75) return { text: 'Hard', color: 'text-orange-600' };
  return { text: 'Very Hard', color: 'text-red-600' };
}

export default function KeywordDifficultyPage() {
  const [kw, setKw] = useState('');
  const [score, setScore] = useState<number | null>(null);

  const run = () => {
    const s = kw.trim();
    if (!s) return;
    setScore(difficultyFor(s));
  };

  const l = score !== null ? label(score) : null;

  return (
    <ToolShell title="Keyword Difficulty" description="Estimate how hard it will be to rank for a keyword (heuristic score).">
      <div className="flex gap-2">
        <Input
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          placeholder="Enter a keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run}>Check</Button>
      </div>
      {score !== null && l && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-baseline gap-3">
              <div className="text-5xl font-bold">{score}</div>
              <div className="text-sm text-muted-foreground">/ 100</div>
              <div className={`ml-auto text-xl font-semibold ${l.color}`}>{l.text}</div>
            </div>
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${score}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              Shorter, broader keywords tend to be more competitive. Long-tail keywords are easier to rank for but have less search volume. This is a heuristic score — integrate a SERP API for production-grade data.
            </p>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

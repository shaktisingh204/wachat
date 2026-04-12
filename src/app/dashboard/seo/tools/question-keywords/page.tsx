'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const QUESTION_TEMPLATES = [
  (s: string) => `how to ${s}`,
  (s: string) => `what is ${s}`,
  (s: string) => `why ${s}`,
  (s: string) => `when ${s}`,
  (s: string) => `where ${s}`,
  (s: string) => `can you ${s}`,
  (s: string) => `should I ${s}`,
  (s: string) => `is ${s}`,
  (s: string) => `are ${s}`,
  (s: string) => `which ${s}`,
];

export default function QuestionKeywordsPage() {
  const [seed, setSeed] = useState('');
  const [results, setResults] = useState<string[]>([]);

  const run = () => {
    const s = seed.trim().toLowerCase();
    if (!s) return;
    setResults(QUESTION_TEMPLATES.map((t) => `${t(s)}?`));
  };

  return (
    <ToolShell title="Question Keywords" description="Generate question-style keyword variants from a seed term.">
      <div className="flex gap-2">
        <Input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Enter seed keyword"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run}>Generate Questions</Button>
      </div>
      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <ul className="space-y-2 text-sm">
              {results.map((r) => (
                <li key={r} className="p-2 rounded bg-muted/40">{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

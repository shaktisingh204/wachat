'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

function groupKeywords(raw: string): Record<string, string[]> {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const groups: Record<string, string[]> = {};
  for (const line of lines) {
    const first = line.toLowerCase().split(/\s+/)[0] || 'other';
    if (!groups[first]) groups[first] = [];
    groups[first].push(line);
  }
  return groups;
}

export default function KeywordGrouperPage() {
  const [input, setInput] = useState('');
  const [groups, setGroups] = useState<Record<string, string[]> | null>(null);

  const run = () => {
    if (!input.trim()) return;
    setGroups(groupKeywords(input));
  };

  return (
    <ToolShell title="Keyword Grouper" description="Group a list of keywords by their common root/stem.">
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste keywords, one per line…"
        className="min-h-[200px]"
      />
      <Button onClick={run} className="w-fit">Group Keywords</Button>
      {groups && (
        <div className="grid md:grid-cols-2 gap-3">
          {Object.entries(groups).map(([key, items]) => (
            <Card key={key}>
              <CardContent className="p-4">
                <div className="font-semibold capitalize mb-2">{key} <span className="text-xs text-muted-foreground">({items.length})</span></div>
                <ul className="text-sm space-y-1">
                  {items.map((i) => <li key={i}>{i}</li>)}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ToolShell>
  );
}

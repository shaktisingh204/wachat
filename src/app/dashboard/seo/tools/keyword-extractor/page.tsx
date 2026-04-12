'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { wordFrequency } from '@/lib/seo-tools/text-utils';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'about', 'as', 'from',
  'and', 'or', 'but', 'if', 'then', 'so', 'than',
  'it', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we', 'they',
  'his', 'her', 'its', 'their', 'our', 'my', 'your',
  'do', 'does', 'did', 'have', 'has', 'had', 'will', 'would', 'could', 'should',
  'can', 'may', 'might', 'must', 'not', 'no', 'yes', 'also', 'very',
]);

export default function KeywordExtractorPage() {
  const [text, setText] = useState('');
  const [results, setResults] = useState<{ word: string; count: number }[]>([]);

  const run = () => {
    if (!text.trim()) return;
    const freq = wordFrequency(text, 200).filter((f) => !STOPWORDS.has(f.word) && f.word.length > 2);
    setResults(freq.slice(0, 30));
  };

  return (
    <ToolShell title="Keyword Extractor" description="Extract the most important keywords from a piece of text (stopwords filtered).">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste text content…"
        className="min-h-[220px]"
      />
      <Button onClick={run} className="w-fit">Extract Keywords</Button>
      {results.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              {results.map((r) => (
                <div key={r.word} className="flex justify-between p-2 rounded bg-muted/40">
                  <span>{r.word}</span>
                  <span className="text-muted-foreground">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}

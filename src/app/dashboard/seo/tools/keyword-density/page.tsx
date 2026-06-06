'use client';

import { Card, ZoruCardContent, Textarea, Tabs, ZoruTabsList, ZoruTabsTrigger, ZoruTabsContent, Switch, Label } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countWords, ngramDensity } from '@/lib/seo-tools/text-utils';

export default function KeywordDensityPage() {
  const [text, setText] = useState('');
  const [filterStopwords, setFilterStopwords] = useState(true);
  
  const density1 = useMemo(() => ngramDensity(text, 1, filterStopwords).slice(0, 30), [text, filterStopwords]);
  const density2 = useMemo(() => ngramDensity(text, 2, filterStopwords).slice(0, 30), [text, filterStopwords]);
  const density3 = useMemo(() => ngramDensity(text, 3, filterStopwords).slice(0, 30), [text, filterStopwords]);
  const total = useMemo(() => countWords(text), [text]);

  const renderTable = (density: { word: string; count: number; density: number }[]) => (
    <Card>
      <ZoruCardContent className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zoru-ink-muted">
              <th className="py-2">#</th>
              <th>Keyword</th>
              <th className="text-right">Count</th>
              <th className="text-right">Density</th>
            </tr>
          </thead>
          <tbody>
            {density.map((row, i) => (
              <tr key={row.word} className="border-t">
                <td className="py-2 text-zoru-ink-muted">{i + 1}</td>
                <td className="font-mono">{row.word}</td>
                <td className="text-right">{row.count}</td>
                <td className="text-right">{row.density.toFixed(2)}%</td>
              </tr>
            ))}
            {density.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-zoru-ink-muted py-6">
                  Start typing to see keyword density.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </ZoruCardContent>
    </Card>
  );

  return (
    <ToolShell title="Keyword Density Checker" description="Analyze keyword frequency and density in your content (1-word, 2-word, and 3-word n-grams).">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your content…"
        className="min-h-[240px] mb-4"
      />
      
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-zoru-ink-muted">Total words: {total}</div>
        <div className="flex items-center space-x-2">
          <Switch 
            id="stopword-filter" 
            checked={filterStopwords} 
            onCheckedChange={setFilterStopwords} 
          />
          <Label htmlFor="stopword-filter" className="text-sm font-medium">
            Exclude Stopwords
          </Label>
        </div>
      </div>
      
      <Tabs defaultValue="2-word">
        <ZoruTabsList className="mb-4">
          <ZoruTabsTrigger value="1-word">1-Word (Unigrams)</ZoruTabsTrigger>
          <ZoruTabsTrigger value="2-word">2-Word (Bigrams)</ZoruTabsTrigger>
          <ZoruTabsTrigger value="3-word">3-Word (Trigrams)</ZoruTabsTrigger>
        </ZoruTabsList>
        <ZoruTabsContent value="1-word">
          {renderTable(density1)}
        </ZoruTabsContent>
        <ZoruTabsContent value="2-word">
          {renderTable(density2)}
        </ZoruTabsContent>
        <ZoruTabsContent value="3-word">
          {renderTable(density3)}
        </ZoruTabsContent>
      </Tabs>
    </ToolShell>
  );
}

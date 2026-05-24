import { readFileSync, writeFileSync } from 'fs';

const p = 'src/app/dashboard/seo/tools/keyword-density/page.tsx';
const content = `'use client';

import { Card, ZoruCardContent, Textarea } from '@/components/zoruui';
import { useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countWords, ngramDensity } from '@/lib/seo-tools/text-utils';

export default function KeywordDensityPage() {
  const [text, setText] = useState('');
  
  const density1 = useMemo(() => ngramDensity(text, 1).slice(0, 30), [text]);
  const density2 = useMemo(() => ngramDensity(text, 2).slice(0, 30), [text]);
  const density3 = useMemo(() => ngramDensity(text, 3).slice(0, 30), [text]);
  const total = useMemo(() => countWords(text), [text]);

  const renderTable = (density: { word: string; count: number; density: number }[]) => (
    <Card>
      <ZoruCardContent className="p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2">#</th>
              <th>Keyword</th>
              <th className="text-right">Count</th>
              <th className="text-right">Density</th>
            </tr>
          </thead>
          <tbody>
            {density.map((row, i) => (
              <tr key={row.word} className="border-t">
                <td className="py-2 text-muted-foreground">{i + 1}</td>
                <td className="font-mono">{row.word}</td>
                <td className="text-right">{row.count}</td>
                <td className="text-right">{row.density.toFixed(2)}%</td>
              </tr>
            ))}
            {density.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground py-6">
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
        className="min-h-[240px]"
      />
      <div className="text-sm text-muted-foreground mb-4">Total words: {total}</div>
      
      <Tabs defaultValue="1-word">
        <TabsList className="mb-4">
          <TabsTrigger value="1-word">1-Word (Unigrams)</TabsTrigger>
          <TabsTrigger value="2-word">2-Word (Bigrams)</TabsTrigger>
          <TabsTrigger value="3-word">3-Word (Trigrams)</TabsTrigger>
        </TabsList>
        <TabsContent value="1-word">
          {renderTable(density1)}
        </TabsContent>
        <TabsContent value="2-word">
          {renderTable(density2)}
        </TabsContent>
        <TabsContent value="3-word">
          {renderTable(density3)}
        </TabsContent>
      </Tabs>
    </ToolShell>
  );
}
`;
writeFileSync(p, content, 'utf-8');
console.log('Page updated.');

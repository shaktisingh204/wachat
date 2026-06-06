'use client';

import {
  Card,
  CardBody,
  Textarea,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Switch,
  Label,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { Search } from 'lucide-react';
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
      <CardBody className="p-4">
        {density.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No keywords yet"
            description="Start typing to see keyword density."
          />
        ) : (
          <Table density="compact">
            <THead>
              <Tr>
                <Th>#</Th>
                <Th>Keyword</Th>
                <Th align="right">Count</Th>
                <Th align="right">Density</Th>
              </Tr>
            </THead>
            <TBody>
              {density.map((row, i) => (
                <Tr key={row.word}>
                  <Td className="text-[var(--st-text-secondary)]">{i + 1}</Td>
                  <Td className="font-mono">{row.word}</Td>
                  <Td align="right">{row.count}</Td>
                  <Td align="right">{row.density.toFixed(2)}%</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );

  return (
    <ToolShell title="Keyword Density Checker" description="Analyze keyword frequency and density in your content (1-word, 2-word, and 3-word n-grams).">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your content..."
        aria-label="Content to analyze"
        className="min-h-[240px] mb-4"
      />

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-[var(--st-text-secondary)]">Total words: {total}</div>
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

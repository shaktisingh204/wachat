'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import {
  countWords,
  countCharacters,
  countSentences,
  countParagraphs,
  readingTimeMinutes,
} from '@/lib/seo-tools/text-utils';

export default function WordCounterPage() {
  const [text, setText] = useState('');
  const stats = useMemo(
    () => ({
      words: countWords(text),
      chars: countCharacters(text, true),
      charsNoSpaces: countCharacters(text, false),
      sentences: countSentences(text),
      paragraphs: countParagraphs(text),
      readMin: readingTimeMinutes(text),
    }),
    [text],
  );

  const boxes: { label: string; value: number | string }[] = [
    { label: 'Words', value: stats.words },
    { label: 'Characters', value: stats.chars },
    { label: 'No-space chars', value: stats.charsNoSpaces },
    { label: 'Sentences', value: stats.sentences },
    { label: 'Paragraphs', value: stats.paragraphs },
    { label: 'Reading time', value: `${stats.readMin} min` },
  ];

  return (
    <ToolShell title="Word Counter" description="Count words, characters, sentences, and estimate reading time.">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your content…"
        className="min-h-[260px]"
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {boxes.map((b) => (
          <Card key={b.label}>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{b.value}</div>
              <div className="text-xs text-muted-foreground">{b.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ToolShell>
  );
}

'use client';

import { Card, ZoruCardContent, Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countParagraphs, countSentences, countWords } from '@/lib/seo-tools/text-utils';

export default function ParagraphCounterPage() {
  const [text, setText] = useState('');
  const p = useMemo(() => countParagraphs(text), [text]);
  const s = useMemo(() => countSentences(text), [text]);
  const w = useMemo(() => countWords(text), [text]);

  return (
    <ToolShell title="Paragraph Counter" description="Count paragraphs, sentences, and words in your content.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your text…" className="min-h-[260px]" />
      <div className="grid grid-cols-3 gap-3">
        <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{p}</div><div className="text-xs text-muted-foreground">Paragraphs</div></ZoruCardContent></Card>
        <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{s}</div><div className="text-xs text-muted-foreground">Sentences</div></ZoruCardContent></Card>
        <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{w}</div><div className="text-xs text-muted-foreground">Words</div></ZoruCardContent></Card>
      </div>
    </ToolShell>
  );
}

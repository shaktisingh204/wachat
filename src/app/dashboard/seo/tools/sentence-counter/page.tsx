'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countSentences, countWords } from '@/lib/seo-tools/text-utils';

export default function SentenceCounterPage() {
  const [text, setText] = useState('');
  const sentences = useMemo(() => countSentences(text), [text]);
  const words = useMemo(() => countWords(text), [text]);
  const avg = sentences ? (words / sentences).toFixed(1) : '0';

  return (
    <ToolShell title="Sentence Counter" description="Count sentences and average words per sentence.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your text…" className="min-h-[240px]" />
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{sentences}</div><div className="text-xs text-muted-foreground">Sentences</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{words}</div><div className="text-xs text-muted-foreground">Words</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{avg}</div><div className="text-xs text-muted-foreground">Words / sentence</div></CardContent></Card>
      </div>
    </ToolShell>
  );
}

'use client';

import { Card, ZoruCardContent, Textarea, Input, Label, cn } from '@/components/zoruui';
import {
  cn as _zoruCn,
  useMemo,
  useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countWords } from '@/lib/seo-tools/text-utils';

export default function ReadingTimePage() {
  const [text, setText] = useState('');
  const [wpm, setWpm] = useState(200);
  const words = useMemo(() => countWords(text), [text]);
  const minutes = words && wpm > 0 ? words / wpm : 0;
  const display = minutes < 1 ? `${Math.ceil(minutes * 60)} sec` : `${minutes.toFixed(1)} min`;

  return (
    <ToolShell title="Reading Time Calculator" description="Estimate reading time based on words per minute.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste content…" className="min-h-[220px]" />
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <ZoruLabel>Words / minute</ZoruLabel>
          <ZoruInput type="number" value={wpm} onChange={(e) => setWpm(Number(e.target.value) || 0)} className="w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{words}</div><div className="text-xs text-muted-foreground">Words</div></ZoruCardContent></ZoruCard>
        <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{display}</div><div className="text-xs text-muted-foreground">Reading time</div></ZoruCardContent></ZoruCard>
      </div>
    </ToolShell>
  );
}

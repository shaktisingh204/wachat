'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste content…" className="min-h-[220px]" />
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label>Words / minute</Label>
          <Input type="number" value={wpm} onChange={(e) => setWpm(Number(e.target.value) || 0)} className="w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{words}</div><div className="text-xs text-muted-foreground">Words</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{display}</div><div className="text-xs text-muted-foreground">Reading time</div></CardContent></Card>
      </div>
    </ToolShell>
  );
}

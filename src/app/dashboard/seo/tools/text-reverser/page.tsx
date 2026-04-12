'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { reverseCharacters, reverseWords } from '@/lib/seo-tools/text-utils';

export default function TextReverserPage() {
  const [text, setText] = useState('');

  return (
    <ToolShell title="Text Reverser" description="Reverse text by characters or word order.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste text…" className="min-h-[220px]" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setText(reverseCharacters(text))}>Reverse characters</Button>
        <Button variant="outline" onClick={() => setText(reverseWords(text))}>Reverse word order</Button>
        <Button variant="outline" onClick={() => setText(text.split(/\r?\n/).reverse().join('\n'))}>Reverse line order</Button>
        <Button variant="ghost" onClick={() => setText('')}>Clear</Button>
      </div>
    </ToolShell>
  );
}

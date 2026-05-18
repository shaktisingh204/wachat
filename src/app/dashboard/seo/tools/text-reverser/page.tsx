'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruButton } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { reverseCharacters, reverseWords } from '@/lib/seo-tools/text-utils';

export default function TextReverserPage() {
  const [text, setText] = useState('');

  return (
    <ToolShell title="Text Reverser" description="Reverse text by characters or word order.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or paste text…" className="min-h-[220px]" />
      <div className="flex flex-wrap gap-2">
        <ZoruButton variant="outline" onClick={() => setText(reverseCharacters(text))}>Reverse characters</ZoruButton>
        <ZoruButton variant="outline" onClick={() => setText(reverseWords(text))}>Reverse word order</ZoruButton>
        <ZoruButton variant="outline" onClick={() => setText(text.split(/\r?\n/).reverse().join('\n'))}>Reverse line order</ZoruButton>
        <ZoruButton variant="ghost" onClick={() => setText('')}>Clear</ZoruButton>
      </div>
    </ToolShell>
  );
}

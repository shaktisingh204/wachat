'use client';

import { ZoruButton, ZoruTextarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { removeLineBreaks } from '@/lib/seo-tools/text-utils';

export default function RemoveLineBreaksPage() {
  const [text, setText] = useState('');

  return (
    <ToolShell title="Remove Line Breaks" description="Strip line breaks from text.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text with line breaks…" className="min-h-[220px]" />
      <div className="flex gap-2">
        <ZoruButton onClick={() => setText(removeLineBreaks(text))}>Remove line breaks</ZoruButton>
        <ZoruButton variant="ghost" onClick={() => setText('')}>Clear</ZoruButton>
      </div>
    </ToolShell>
  );
}

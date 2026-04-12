'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { removeLineBreaks } from '@/lib/seo-tools/text-utils';

export default function RemoveLineBreaksPage() {
  const [text, setText] = useState('');

  return (
    <ToolShell title="Remove Line Breaks" description="Strip line breaks from text.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text with line breaks…" className="min-h-[220px]" />
      <div className="flex gap-2">
        <Button onClick={() => setText(removeLineBreaks(text))}>Remove line breaks</Button>
        <Button variant="ghost" onClick={() => setText('')}>Clear</Button>
      </div>
    </ToolShell>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { removeExtraSpaces } from '@/lib/seo-tools/text-utils';

export default function RemoveExtraSpacesPage() {
  const [text, setText] = useState('');

  return (
    <ToolShell title="Remove Extra Spaces" description="Collapse multiple spaces and blank lines.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text with extra spaces…" className="min-h-[220px]" />
      <div className="flex gap-2">
        <Button onClick={() => setText(removeExtraSpaces(text))}>Remove</Button>
        <Button variant="ghost" onClick={() => setText('')}>Clear</Button>
      </div>
    </ToolShell>
  );
}

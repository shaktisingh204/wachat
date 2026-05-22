'use client';

import { Button, Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { removeExtraSpaces } from '@/lib/seo-tools/text-utils';

export default function RemoveExtraSpacesPage() {
  const [text, setText] = useState('');

  return (
    <ToolShell title="Remove Extra Spaces" description="Collapse multiple spaces and blank lines.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text with extra spaces…" className="min-h-[220px]" />
      <div className="flex gap-2">
        <ZoruButton onClick={() => setText(removeExtraSpaces(text))}>Remove</ZoruButton>
        <ZoruButton variant="ghost" onClick={() => setText('')}>Clear</ZoruButton>
      </div>
    </ToolShell>
  );
}

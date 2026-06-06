'use client';

import { Button, Textarea, Input, Label, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { removeLineBreaks } from '@/lib/seo-tools/text-utils';

export default function RemoveLineBreaksPage() {
  const [text, setText] = useState('');
  const [separator, setSeparator] = useState(' ');

  return (
    <ToolShell title="Remove Line Breaks" description="Strip line breaks from text.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text with line breaks…" className="min-h-[220px]" />
      
      <div className="flex flex-col gap-2 max-w-sm">
        <Label htmlFor="separator">Replacement Separator</Label>
        <Input 
          id="separator" 
          value={separator} 
          onChange={(e) => setSeparator(e.target.value)} 
          placeholder="e.g., space or comma" 
        />
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setText(removeLineBreaks(text, separator))}>Remove line breaks</Button>
        <Button variant="ghost" onClick={() => setText('')}>Clear</Button>
      </div>
    </ToolShell>
  );
}

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { removeDuplicateLines } from '@/lib/seo-tools/text-utils';

export default function DuplicateLineRemoverPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');

  const run = () => setResult(removeDuplicateLines(text));

  const removed = text.split(/\r?\n/).length - (result ? result.split(/\r?\n/).length : text.split(/\r?\n/).length);

  return (
    <ToolShell title="Duplicate Line Remover" description="Remove duplicate lines while preserving order.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste lines…" className="min-h-[220px]" />
      <div className="flex gap-2">
        <Button onClick={run}>Remove duplicates</Button>
        <Button variant="ghost" onClick={() => { setText(''); setResult(''); }}>Clear</Button>
      </div>
      {result && (
        <>
          <div className="text-sm text-muted-foreground">Removed {removed} duplicate line(s)</div>
          <Textarea readOnly value={result} className="min-h-[220px] font-mono text-xs" />
        </>
      )}
    </ToolShell>
  );
}

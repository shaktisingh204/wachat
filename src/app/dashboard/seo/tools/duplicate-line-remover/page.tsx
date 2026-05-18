'use client';

import { ZoruButton, ZoruTextarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { removeDuplicateLines } from '@/lib/seo-tools/text-utils';

export default function DuplicateLineRemoverPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState('');

  const run = () => setResult(removeDuplicateLines(text));

  const removed = text.split(/\r?\n/).length - (result ? result.split(/\r?\n/).length : text.split(/\r?\n/).length);

  return (
    <ToolShell title="Duplicate Line Remover" description="Remove duplicate lines while preserving order.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste lines…" className="min-h-[220px]" />
      <div className="flex gap-2">
        <ZoruButton onClick={run}>Remove duplicates</ZoruButton>
        <ZoruButton variant="ghost" onClick={() => { setText(''); setResult(''); }}>Clear</ZoruButton>
      </div>
      {result && (
        <>
          <div className="text-sm text-muted-foreground">Removed {removed} duplicate line(s)</div>
          <ZoruTextarea readOnly value={result} className="min-h-[220px] font-mono text-xs" />
        </>
      )}
    </ToolShell>
  );
}

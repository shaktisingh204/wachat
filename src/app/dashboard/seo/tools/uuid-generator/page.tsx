'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default function UuidGeneratorPage() {
  const [list, setList] = useState<string[]>([]);

  const generate = () => setList((l) => [uuid(), ...l].slice(0, 10));

  return (
    <ToolShell title="UUID Generator" description="Generate cryptographically random UUID v4 identifiers.">
      <div className="flex gap-2">
        <ZoruButton onClick={generate}>Generate UUID</ZoruButton>
        {list[0] && <ZoruButton variant="outline" onClick={() => navigator.clipboard.writeText(list[0])}>Copy latest</ZoruButton>}
      </div>
      <ZoruCard><ZoruCardContent className="p-4 space-y-1">
        {list.length === 0 && <div className="text-sm text-muted-foreground">Click to generate.</div>}
        {list.map((u, i) => <div key={i} className="font-mono text-xs border-t last:border-0 first:border-t-0 py-1">{u}</div>)}
      </ZoruCardContent></ZoruCard>
    </ToolShell>
  );
}

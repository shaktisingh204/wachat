'use client';

import { ZoruInput, ZoruLabel, ZoruTextarea, ZoruSwitch, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function FindAndReplacePage() {
  const [text, setText] = useState('');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  const { output, count } = useMemo(() => {
    if (!find) return { output: text, count: 0 };
    try {
      const flags = caseSensitive ? 'g' : 'gi';
      const re = regex ? new RegExp(find, flags) : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      const matches = text.match(re);
      return { output: text.replace(re, replace), count: matches ? matches.length : 0 };
    } catch {
      return { output: text, count: 0 };
    }
  }, [text, find, replace, regex, caseSensitive]);

  return (
    <ToolShell title="Find and Replace" description="Find and replace text in bulk with optional regex.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste text…" className="min-h-[220px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <ZoruLabel>Find</ZoruLabel>
          <ZoruInput value={find} onChange={(e) => setFind(e.target.value)} />
        </div>
        <div className="space-y-1">
          <ZoruLabel>Replace with</ZoruLabel>
          <ZoruInput value={replace} onChange={(e) => setReplace(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2"><ZoruSwitch checked={regex} onCheckedChange={setRegex} /><ZoruLabel>Regex</ZoruLabel></div>
        <div className="flex items-center gap-2"><ZoruSwitch checked={caseSensitive} onCheckedChange={setCaseSensitive} /><ZoruLabel>Case sensitive</ZoruLabel></div>
        <div className="text-sm text-muted-foreground">{count} match(es)</div>
      </div>
      <div className="text-sm font-semibold">Output</div>
      <ZoruTextarea readOnly value={output} className="min-h-[220px]" />
    </ToolShell>
  );
}

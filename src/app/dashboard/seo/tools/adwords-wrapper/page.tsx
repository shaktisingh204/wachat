'use client';

import { ZoruLabel, ZoruTextarea } from '@/components/zoruui';
import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

type MatchType = 'broad' | 'phrase' | 'exact' | 'modified';

export default function AdwordsWrapperPage() {
  const [text, setText] = useState('');
  const [mt, setMt] = useState<MatchType>('phrase');
  const out = useMemo(() => {
    return text.split(/\r?\n/).filter(Boolean).map((kw) => {
      switch (mt) {
        case 'phrase': return `"${kw}"`;
        case 'exact': return `[${kw}]`;
        case 'modified': return kw.split(' ').map((w) => `+${w}`).join(' ');
        default: return kw;
      }
    }).join('\n');
  }, [text, mt]);

  return (
    <ToolShell title="AdWords Keyword Wrapper" description="Wrap a list of keywords with Google Ads match type syntax.">
      <div className="space-y-1">
        <ZoruLabel>Match type</ZoruLabel>
        <select className="border border-zoru-line rounded-[var(--zoru-radius)] h-9 px-2 bg-zoru-bg text-zoru-ink text-sm" value={mt} onChange={(e) => setMt(e.target.value as MatchType)}>
          <option value="broad">Broad</option>
          <option value="phrase">"Phrase"</option>
          <option value="exact">[Exact]</option>
          <option value="modified">+modified +broad</option>
        </select>
      </div>
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[180px] font-mono text-xs" placeholder="One keyword per line…" />
      <ZoruTextarea readOnly value={out} className="min-h-[180px] font-mono text-xs" />
    </ToolShell>
  );
}

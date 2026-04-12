'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
        <Label>Match type</Label>
        <select className="border rounded h-9 px-2 bg-background" value={mt} onChange={(e) => setMt(e.target.value as MatchType)}>
          <option value="broad">Broad</option>
          <option value="phrase">"Phrase"</option>
          <option value="exact">[Exact]</option>
          <option value="modified">+modified +broad</option>
        </select>
      </div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[180px] font-mono text-xs" placeholder="One keyword per line…" />
      <Textarea readOnly value={out} className="min-h-[180px] font-mono text-xs" />
    </ToolShell>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function RegexTesterPage() {
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [test, setTest] = useState('');
  const { error, matches, highlighted } = useMemo(() => {
    if (!pattern) return { error: '', matches: [] as RegExpMatchArray[], highlighted: test };
    try {
      const re = new RegExp(pattern, flags);
      const ms = Array.from(test.matchAll(flags.includes('g') ? re : new RegExp(pattern, flags + 'g')));
      let out = '';
      let last = 0;
      for (const m of ms) {
        out += escape(test.slice(last, m.index)) + `<mark>${escape(m[0])}</mark>`;
        last = (m.index || 0) + m[0].length;
      }
      out += escape(test.slice(last));
      return { error: '', matches: ms, highlighted: out };
    } catch (e: any) {
      return { error: e?.message || 'invalid regex', matches: [] as RegExpMatchArray[], highlighted: test };
    }
  }, [pattern, flags, test]);

  return (
    <ToolShell title="Regex Tester" description="Test regular expressions against sample text.">
      <div className="flex gap-2">
        <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="pattern" className="font-mono" />
        <Input value={flags} onChange={(e) => setFlags(e.target.value)} placeholder="flags" className="w-24 font-mono" />
      </div>
      <Textarea value={test} onChange={(e) => setTest(e.target.value)} placeholder="Test string…" className="min-h-[180px] font-mono text-xs" />
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      <div className="text-sm text-muted-foreground">{matches.length} match(es)</div>
      <Card><CardContent className="p-4">
        <div className="font-mono text-xs whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: highlighted }} />
      </CardContent></Card>
    </ToolShell>
  );
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

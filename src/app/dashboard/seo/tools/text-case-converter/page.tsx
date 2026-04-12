'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { toTitleCase, toSentenceCase, toCamelCase } from '@/lib/seo-tools/text-utils';

export default function TextCaseConverterPage() {
  const [text, setText] = useState('');
  const actions: { label: string; fn: (t: string) => string }[] = [
    { label: 'UPPER CASE', fn: (t) => t.toUpperCase() },
    { label: 'lower case', fn: (t) => t.toLowerCase() },
    { label: 'Title Case', fn: toTitleCase },
    { label: 'Sentence case', fn: toSentenceCase },
    { label: 'camelCase', fn: toCamelCase },
    { label: 'iNVERSE cASE', fn: (t) => t.split('').map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('') },
  ];

  return (
    <ToolShell title="Text Case Converter" description="Convert text between UPPER, lower, Title, Sentence, camelCase, etc.">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type or paste text…"
        className="min-h-[260px]"
      />
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button key={a.label} variant="outline" onClick={() => setText(a.fn(text))}>
            {a.label}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => setText('')}>
          Clear
        </Button>
      </div>
    </ToolShell>
  );
}

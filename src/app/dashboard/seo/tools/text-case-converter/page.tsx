'use client';

import { Button, Textarea, cn } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { toTitleCase, toSentenceCase, toCamelCase, toSnakeCase, toKebabCase } from '@/lib/seo-tools/text-utils';

export default function TextCaseConverterPage() {
  const [text, setText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (convertedText: string, id: string) => {
    navigator.clipboard.writeText(convertedText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const actions: { label: string; id: string; fn: (t: string) => string }[] = [
    { label: 'UPPER CASE', id: 'upper', fn: (t) => t.toUpperCase() },
    { label: 'lower case', id: 'lower', fn: (t) => t.toLowerCase() },
    { label: 'Title Case', id: 'title', fn: toTitleCase },
    { label: 'Sentence case', id: 'sentence', fn: toSentenceCase },
    { label: 'camelCase', id: 'camel', fn: toCamelCase },
    { label: 'snake_case', id: 'snake', fn: toSnakeCase },
    { label: 'kebab-case', id: 'kebab', fn: toKebabCase },
    { label: 'iNVERSE cASE', id: 'inverse', fn: (t) => t.split('').map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('') },
  ];

  return (
    <ToolShell title="Text Case Converter" description="Convert text between UPPER, lower, Title, Sentence, camelCase, snake_case, etc.">
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">Input Text</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text here..."
            className="min-h-[150px]"
          />
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setText('')} disabled={!text}>
              Clear Input
            </Button>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {actions.map((a) => {
            const converted = text ? a.fn(text) : '';
            return (
              <div key={a.id} className="rounded-md border bg-[var(--st-bg-secondary)] p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[var(--st-text-secondary)]">{a.label}</h3>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleCopy(converted, a.id)}
                    disabled={!text}
                    title="Copy to clipboard"
                  >
                    {copiedId === a.id ? <Check className="h-4 w-4 text-[var(--st-text)]" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="min-h-[80px] rounded-md bg-[var(--st-bg-muted)]/50 p-3 text-sm break-all whitespace-pre-wrap">
                  {converted || <span className="text-[var(--st-text-secondary)] opacity-50">Preview will appear here...</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ToolShell>
  );
}

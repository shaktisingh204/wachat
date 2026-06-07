'use client';

import { useMemo, useState } from 'react';

import { Card, CardBody, EmptyState, Field, Textarea } from '@/components/sabcrm/20ui';
import { ListOrdered } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { wordFrequency } from '@/lib/seo-tools/text-utils';

export default function WordFrequencyPage() {
  const [text, setText] = useState('');
  const freq = useMemo(() => wordFrequency(text, 100), [text]);
  const max = freq[0]?.count || 1;

  return (
    <ToolShell title="Word Frequency Counter" description="Rank the most used words in your content.">
      <Field label="Content" help="Paste an article or page copy to see which words appear most often.">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste your content here."
          className="min-h-[220px]"
        />
      </Field>
      <Card>
        <CardBody className="p-4 space-y-2">
          {freq.map((row) => (
            <div key={row.word} className="space-y-0.5">
              <div className="flex justify-between text-xs">
                <span className="font-mono">{row.word}</span>
                <span className="text-[var(--st-text-secondary)]">{row.count}</span>
              </div>
              <div className="h-1.5 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)]">
                <div
                  className="h-full rounded-[var(--st-radius)] bg-[var(--st-text)]"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {freq.length === 0 && (
            <EmptyState
              icon={ListOrdered}
              title="No words yet"
              description="Start typing to see word frequency."
            />
          )}
        </CardBody>
      </Card>
    </ToolShell>
  );
}

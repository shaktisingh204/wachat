'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { keywordDensity, countWords } from '@/lib/seo-tools/text-utils';

export default function KeywordDensityPage() {
  const [text, setText] = useState('');
  const density = useMemo(() => keywordDensity(text).slice(0, 30), [text]);
  const total = useMemo(() => countWords(text), [text]);

  return (
    <ToolShell title="Keyword Density Checker" description="Analyze keyword frequency and density in your content.">
      <ZoruTextarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste or type your content…"
        className="min-h-[240px]"
      />
      <div className="text-sm text-muted-foreground">Total words: {total}</div>
      <ZoruCard>
        <ZoruCardContent className="p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-2">#</th>
                <th>Keyword</th>
                <th className="text-right">Count</th>
                <th className="text-right">Density</th>
              </tr>
            </thead>
            <tbody>
              {density.map((row, i) => (
                <tr key={row.word} className="border-t">
                  <td className="py-2 text-muted-foreground">{i + 1}</td>
                  <td className="font-mono">{row.word}</td>
                  <td className="text-right">{row.count}</td>
                  <td className="text-right">{row.density.toFixed(2)}%</td>
                </tr>
              ))}
              {density.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground py-6">
                    Start typing to see keyword density.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </ZoruCardContent>
      </ZoruCard>
    </ToolShell>
  );
}

'use client';

/**
 * Tabbed code-sample widget used inside the in-app API reference.
 *
 * Renders one tab per language (cURL / HTTP / JS / TS SDK / Python /
 * httpx / Go / Ruby / PHP / Java / C# / Rust / Elixir / Swift / Kotlin)
 * with a click-to-copy button. Kept in `_components/` so it sits inside
 * the route segment and is not routed itself (Next.js convention).
 */

import { useState } from 'react';
import { Button, Tabs, TabsList, TabsTrigger } from '@/components/sabcrm/20ui';
import { Copy, Check } from 'lucide-react';

export interface CodeSample {
  /** Human label shown in the tab. */
  lang: string;
  /** Optional syntax-highlighter hint (e.g. `bash`, `python`). */
  highlight?: string;
  source: string;
}

interface Props {
  samples: CodeSample[];
}

export function CodeSamplesTabs({ samples }: Props): JSX.Element {
  const [activeLang, setActiveLang] = useState(samples[0]?.lang ?? '');
  const [copied, setCopied] = useState(false);
  const sample = samples.find((s) => s.lang === activeLang) ?? samples[0];

  const copy = async (): Promise<void> => {
    if (!sample) return;
    try {
      await navigator.clipboard.writeText(sample.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
      <Tabs
        value={activeLang}
        onValueChange={setActiveLang}
        className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
      >
        <TabsList className="flex-1 overflow-x-auto">
          {samples.map((s) => (
            <TabsTrigger key={s.lang} value={s.lang} noPill>
              {s.lang}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="px-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={copy}>
            {copied ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </Tabs>
      <pre className="px-4 py-3 text-xs text-[var(--st-text)] m-0 overflow-x-auto leading-relaxed">
        <code>{sample?.source}</code>
      </pre>
    </div>
  );
}

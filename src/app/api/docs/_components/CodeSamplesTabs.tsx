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
import { ZoruButton } from '@/components/zoruui';
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
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const sample = samples[active];

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(sample.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg overflow-hidden">
      <div className="flex items-center justify-between border-b border-zoru-line bg-zoru-surface">
        <div className="flex overflow-x-auto" role="tablist">
          {samples.map((s, i) => (
            <button
              key={s.lang}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={
                'px-3 py-2 text-xs font-medium border-r border-zoru-line whitespace-nowrap transition-colors ' +
                (i === active
                  ? 'text-zoru-ink bg-zoru-bg'
                  : 'text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-2')
              }
            >
              {s.lang}
            </button>
          ))}
        </div>
        <div className="px-2 flex-shrink-0">
          <ZoruButton variant="ghost" size="sm" onClick={copy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
          </ZoruButton>
        </div>
      </div>
      <pre className="px-4 py-3 text-xs text-zinc-100 m-0 overflow-x-auto leading-relaxed">
        <code>{sample.source}</code>
      </pre>
    </div>
  );
}

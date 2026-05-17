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
    <div className="rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden">
      <div className="flex items-center border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex" role="tablist">
          {samples.map((s, i) => (
            <button
              key={s.lang}
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={
                'px-3 py-2 text-xs font-medium border-r border-zinc-800 ' +
                (i === active
                  ? 'text-amber-300 bg-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200')
              }
            >
              {s.lang}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={copy}
          className="ml-auto mr-2 my-1 text-xs text-zinc-400 hover:text-zinc-100 px-2 py-1 rounded border border-zinc-800"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs leading-relaxed text-zinc-100 overflow-x-auto m-0">
        <code>{sample.source}</code>
      </pre>
    </div>
  );
}

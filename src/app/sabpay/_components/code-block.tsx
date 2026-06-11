'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';

export interface CodeBlockProps {
  code: string;
  /** Informational — set on the `<code>` element as `language-*` for tooling. */
  language?: string;
}

/**
 * Monospace code block with a copy button in the top-right — the shared
 * extraction of the snippet block from `developers-client.tsx`. Used for API
 * snippets, webhook secrets, and one-time key reveals.
 */
export function CodeBlock({ code, language }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast({ title: 'Copied to clipboard', tone: 'success' });
    } catch {
      // Clipboard unavailable (http origin) — the code is visible to select.
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <pre
        style={{
          margin: 0,
          padding: '14px 16px',
          borderRadius: 10,
          border: '1px solid var(--st-border)',
          background: 'var(--st-bg)',
          overflowX: 'auto',
          fontFamily: 'var(--st-font-mono, monospace)',
          fontSize: 12.5,
          lineHeight: 1.6,
        }}
      >
        <code className={language ? `language-${language}` : undefined}>{code}</code>
      </pre>
      <span style={{ position: 'absolute', top: 8, right: 8 }}>
        <Button
          variant="ghost"
          size="sm"
          onClick={copy}
          iconLeft={copied ? <Check size={14} /> : <Copy size={14} />}
          aria-label="Copy code"
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </span>
    </div>
  );
}

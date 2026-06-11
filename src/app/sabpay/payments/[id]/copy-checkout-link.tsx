'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

export function CopyCheckoutLink({ url }: { url: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable (http origin) — the URL is visible to select.
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span
        style={{
          fontFamily: 'var(--st-font-mono, monospace)',
          fontSize: 12.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {url}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={copy}
        iconLeft={copied ? <Check size={14} /> : <Copy size={14} />}
        aria-label={copied ? 'Copied' : 'Copy checkout link'}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </span>
  );
}

'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';

import { Button, toast } from '@/components/sabcrm/20ui';

/**
 * Monospace id with a small copy button — for pay_/ord_/rfnd_ ids in tables
 * and detail rows. Copies via the clipboard API and confirms with a toast.
 */
export function CopyableId({ value }: { value: string }): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
      toast({ title: 'Copied to clipboard', tone: 'success' });
    } catch {
      // Clipboard unavailable (http origin) — the id is visible to select.
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
        {value}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={copy}
        iconLeft={copied ? <Check size={14} /> : <Copy size={14} />}
        aria-label={copied ? 'Copied' : `Copy ${value}`}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </span>
  );
}

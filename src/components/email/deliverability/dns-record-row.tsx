'use client';

import { useCallback, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  Badge,
  Button,
  zoruToast,
} from '@/components/sabcrm/20ui/compat';
import type { DnsRecord, DnsRecordStatus } from '@/lib/rust-client/email-deliverability';

interface DnsRecordRowProps {
  record: DnsRecord | undefined;
  /** Override the displayed label — defaults to `record.type`. */
  label?: string;
}

const statusToTone: Record<DnsRecordStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  valid: 'success',
  pending: 'warning',
  invalid: 'destructive',
  missing: 'destructive',
};

const statusToLabel: Record<DnsRecordStatus, string> = {
  valid: 'Valid',
  pending: 'Pending',
  invalid: 'Invalid',
  missing: 'Missing',
};

export function DnsRecordRow({ record, label }: DnsRecordRowProps) {
  const [copied, setCopied] = useState(false);
  const status: DnsRecordStatus = record?.status ?? 'missing';
  const value = record?.expectedValue ?? record?.value ?? '';

  const handleCopy = useCallback(async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      zoruToast({ title: 'Copied to clipboard' });
    } catch {
      zoruToast({
        title: 'Copy failed',
        description: 'Your browser blocked clipboard access.',
        variant: 'destructive',
      });
    }
  }, [value]);

  return (
    <div className="flex flex-col gap-2 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3 sm:flex-row sm:items-center">
      <div className="flex min-w-[88px] items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zoru-ink">
          {label ?? record?.type ?? '—'}
        </span>
        <Badge variant={statusToTone[status] ?? 'secondary'}>
          {statusToLabel[status] ?? status}
        </Badge>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {record?.host ? (
          <span className="truncate text-xs text-zoru-ink-muted">
            {record.host}
          </span>
        ) : null}
        <code className="truncate text-xs text-zoru-ink">
          {value || '—'}
        </code>
        {record?.error ? (
          <span className="text-xs text-zoru-danger-ink">{record.error}</span>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        disabled={!value}
        aria-label="Copy DNS value"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}

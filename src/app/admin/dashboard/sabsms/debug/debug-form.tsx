'use client';

import { useEffect, useRef, useState } from 'react';

import {
  Badge,
  Button,
  Checkbox,
  Input,
  Label,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import { sendDebugSms, fetchDebugStatus } from './actions';
import type {
  SabsmsMessage,
  SabsmsMessageStatus,
} from '@/lib/sabsms/types';

const TERMINAL: SabsmsMessageStatus[] = [
  'delivered',
  'failed',
  'undelivered',
  'rejected',
  'suppressed',
];

function statusVariant(s: SabsmsMessageStatus) {
  if (s === 'delivered' || s === 'sent') return 'default' as const;
  if (s === 'failed' || s === 'rejected' || s === 'undelivered') return 'destructive' as const;
  return 'secondary' as const;
}

export function SabsmsDebugSendForm({ engineHealthy = true }: { engineHealthy?: boolean }) {
  const [to, setTo] = useState('');
  const [body, setBody] = useState('SabSMS debug send 🚀');
  const [dryRun, setDryRun] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [status, setStatus] = useState<SabsmsMessageStatus | null>(null);
  const [message, setMessage] = useState<SabsmsMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!engineHealthy) return;

    setError(null);
    setMessage(null);
    setMessageId(null);
    setStatus(null);
    setSubmitting(true);

    const res = await sendDebugSms({ to, body, dryRun });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMessageId(res.id);
    setStatus(res.status);

    if (TERMINAL.includes(res.status)) return;

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const next = await fetchDebugStatus(res.id);
      if (!next.ok) {
        setError(next.error);
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }
      setMessage(next.message);
      setStatus(next.message.status);
      if (TERMINAL.includes(next.message.status) && pollRef.current) {
        clearInterval(pollRef.current);
      }
    }, 1500);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sabsms-debug-to">Destination (E.164)</Label>
        <Input
          id="sabsms-debug-to"
          required
          placeholder="+15551234567"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          autoComplete="tel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sabsms-debug-body">Body</Label>
        <Textarea
          id="sabsms-debug-body"
          required
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <p className="text-xs text-zoru-ink-muted">
          {body.length} chars · GSM-7 splits at 160/153, UCS-2 at 70/67.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || !to || !body || !engineHealthy}>
          {submitting ? 'Sending…' : 'Send debug SMS'}
        </Button>
        <div className="flex items-center gap-2 ml-2">
          <Checkbox 
            id="sabsms-debug-dryrun" 
            checked={dryRun} 
            onCheckedChange={(checked) => setDryRun(checked === true)} 
            disabled={submitting || !engineHealthy}
          />
          <Label htmlFor="sabsms-debug-dryrun" className="text-sm cursor-pointer font-normal">
            Dry run (test engine ingestion without hitting Twilio)
          </Label>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        {status && (
          <Badge variant={statusVariant(status)}>{status}</Badge>
        )}
        {messageId && (
          <code className="rounded bg-zoru-surface px-2 py-1 text-xs">
            {messageId}
          </code>
        )}
      </div>

      {error && (
        <p className="rounded border border-zoru-line bg-zoru-surface-2 p-3 text-sm text-zoru-ink">
          {error}
        </p>
      )}

      {message && (
        <div className="rounded border border-zoru-line bg-zoru-surface p-3 text-xs">
          <div className="mb-2 font-semibold text-zoru-ink">Message doc</div>
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-zoru-ink">
{JSON.stringify(message, null, 2)}
          </pre>
        </div>
      )}
    </form>
  );
}

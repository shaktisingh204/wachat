'use client';

import { useCallback, useState } from 'react';
import { Zap, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Alert,
  Button,
  Field,
  Input,
  Separator,
  useToast,
} from '@/components/sabcrm/20ui';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface MakeComOptions {
  webhookUrl?: string;
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function MakeComSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const opts = (block.options ?? {}) as MakeComOptions;
  const webhookUrl = opts.webhookUrl ?? '';

  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [lastResponse, setLastResponse] = useState<{
    status: number;
    body: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const update = useCallback(
    (patch: Partial<MakeComOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  const handleTest = async () => {
    if (!webhookUrl) return;
    setIsTesting(true);
    setLastResponse(null);
    setTestError(null);
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'sabflow_test', timestamp: new Date().toISOString() }),
      });
      const text = await res.text();
      let body: string;
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        body = text;
      }
      setLastResponse({ status: res.status, body });
      if (res.status >= 200 && res.status < 300) {
        toast.success(`Test payload delivered (HTTP ${res.status}).`);
      } else {
        toast.error(`Webhook responded with HTTP ${res.status}.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTestError(message);
      toast.error(`Could not reach the webhook. ${message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigured = webhookUrl.startsWith('https://hook.');
  const responseOk =
    lastResponse !== null && lastResponse.status >= 200 && lastResponse.status < 300;

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)] text-white">
          <Zap size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text)]">
          Make.com
        </span>
      </div>

      {/* Status banner */}
      {isConfigured ? (
        <Alert tone="success" icon={CheckCircle2}>
          Scenario webhook is configured.
        </Alert>
      ) : (
        <Alert tone="warning" icon={AlertCircle}>
          Paste your Make.com scenario webhook URL below.
        </Alert>
      )}

      <Field
        label="Webhook URL"
        help={
          <>
            Get this URL from the{' '}
            <strong className="text-[var(--st-text)]">Webhooks</strong> module in your Make
            scenario.
          </>
        }
      >
        <Input
          type="url"
          value={webhookUrl}
          onChange={(e) => update({ webhookUrl: e.target.value })}
          placeholder="https://hook.eu2.make.com/abcdef123456"
          spellCheck={false}
        />
      </Field>

      <Separator />

      <Button
        variant="outline"
        block
        iconLeft={Play}
        loading={isTesting}
        disabled={!webhookUrl}
        onClick={handleTest}
      >
        {isTesting ? 'Sending test...' : 'Send test payload'}
      </Button>

      {testError && (
        <Alert tone="danger" title="Error">
          <span className="font-mono break-all">{testError}</span>
        </Alert>
      )}

      {lastResponse !== null && (
        <Alert
          tone={responseOk ? 'success' : 'warning'}
          title={`Last response ${lastResponse.status}`}
        >
          <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--st-text-secondary)]">
            {lastResponse.body || '(empty)'}
          </pre>
        </Alert>
      )}
    </div>
  );
}

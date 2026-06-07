'use client';

import { useCallback, useState } from 'react';
import { Zap, Play, CircleCheckBig, CircleAlert } from 'lucide-react';
import type { Block, Variable } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Button,
  Callout,
  Card,
  CardBody,
} from '@/components/sabcrm/20ui';

/* ── Types ───────────────────────────────────────────────────────────────── */

interface ZapierOptions {
  webhookUrl?: string;
}

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function ZapierSettings({ block, onBlockChange, variables: _variables = [] }: Props) {
  const opts = (block.options ?? {}) as ZapierOptions;
  const webhookUrl = opts.webhookUrl ?? '';

  const [isTesting, setIsTesting] = useState(false);
  const [lastResponse, setLastResponse] = useState<{
    status: number;
    body: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const update = useCallback(
    (patch: Partial<ZapierOptions>) => {
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
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTesting(false);
    }
  };

  const isConfigured = webhookUrl.startsWith('https://hooks.zapier.com');
  const isOk = lastResponse !== null && lastResponse.status >= 200 && lastResponse.status < 300;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] pb-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
          aria-hidden="true"
        >
          <Zap size={16} strokeWidth={1.8} />
        </span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text)]">
          Zapier
        </span>
      </div>

      {/* Status notice */}
      {isConfigured ? (
        <Callout tone="success" icon={CircleCheckBig}>
          Zap webhook is configured.
        </Callout>
      ) : (
        <Callout tone="warning" icon={CircleAlert}>
          Paste your Zapier catch-hook URL below.
        </Callout>
      )}

      <Field
        label="Webhook URL"
        help={
          <>
            Create a <strong>Webhooks by Zapier</strong> trigger in your Zap to get this URL.
          </>
        }
      >
        <Input
          type="url"
          value={webhookUrl}
          onChange={(e) => update({ webhookUrl: e.target.value })}
          placeholder="https://hooks.zapier.com/hooks/catch/12345/abcdef"
          spellCheck={false}
        />
      </Field>

      <div className="h-px bg-[var(--st-border)]" />

      <Button
        type="button"
        variant="outline"
        block
        iconLeft={Play}
        onClick={handleTest}
        disabled={!webhookUrl}
        loading={isTesting}
      >
        {isTesting ? 'Sending test...' : 'Send test payload'}
      </Button>

      {testError && (
        <Card variant="outlined" padding="none">
          <CardBody className="space-y-1 p-3">
            <p className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--st-danger)]">
              Error
            </p>
            <p className="break-all font-mono text-[11px] text-[var(--st-danger)]">{testError}</p>
          </CardBody>
        </Card>
      )}

      {lastResponse !== null && (
        <Card variant="outlined" padding="none">
          <CardBody className="space-y-1 p-3">
            <p className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
              Last response{' '}
              <span className={isOk ? 'text-[var(--st-status-ok)]' : 'text-[var(--st-danger)]'}>
                {lastResponse.status}
              </span>
            </p>
            <pre className="max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--st-text)]">
              {lastResponse.body || '(empty)'}
            </pre>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

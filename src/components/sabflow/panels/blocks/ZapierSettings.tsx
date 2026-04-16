'use client';

import { useCallback, useState } from 'react';
import { LuZap, LuPlay, LuCircleCheckBig, LuCircleAlert } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, Divider } from './shared/primitives';

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

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuZap} title="Zapier" />

      {/* Status badge */}
      {isConfigured ? (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2">
          <LuCircleCheckBig className="h-4 w-4 text-emerald-400 shrink-0" strokeWidth={1.8} />
          <span className="text-[12px] text-emerald-400 font-medium">
            Zap webhook is configured.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-[var(--gray-3)] border border-[var(--gray-5)] px-3 py-2">
          <LuCircleAlert className="h-4 w-4 text-[var(--gray-9)] shrink-0" strokeWidth={1.8} />
          <span className="text-[12px] text-[var(--gray-9)]">
            Paste your Zapier catch-hook URL below.
          </span>
        </div>
      )}

      <Field label="Webhook URL">
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => update({ webhookUrl: e.target.value })}
          placeholder="https://hooks.zapier.com/hooks/catch/12345/abcdef"
          className={inputClass}
          spellCheck={false}
        />
        <p className="text-[10.5px] text-[var(--gray-8)] mt-1">
          Create a{' '}
          <strong className="text-[var(--gray-10)]">Webhooks by Zapier</strong> trigger in your Zap
          to get this URL.
        </p>
      </Field>

      <Divider />

      <button
        type="button"
        onClick={handleTest}
        disabled={!webhookUrl || isTesting}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f76808] px-3 py-2 text-[12px] font-medium text-[#f76808] hover:bg-[#f7680814] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <LuPlay className="h-3.5 w-3.5" strokeWidth={2} />
        {isTesting ? 'Sending test…' : 'Send test payload'}
      </button>

      {testError && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 space-y-1">
          <p className="text-[10.5px] font-medium text-red-400 uppercase tracking-wide">Error</p>
          <p className="text-[11px] text-red-300 font-mono break-all">{testError}</p>
        </div>
      )}

      {lastResponse !== null && (
        <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-1">
          <p className="text-[10.5px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
            Last response{' '}
            <span
              className={
                lastResponse.status >= 200 && lastResponse.status < 300
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }
            >
              {lastResponse.status}
            </span>
          </p>
          <pre className="text-[11px] text-[var(--gray-11)] font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto">
            {lastResponse.body || '(empty)'}
          </pre>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * WebhooksClient — flow webhook management.
 *
 * Lists registered webhooks (active + inactive), shows the full public URL
 * with a copy-to-clipboard button, the method + auth scheme, and a "Test"
 * action that hits the URL with a sample payload so users can validate the
 * round-trip without leaving the page.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  LuArrowLeft,
  LuCheck,
  LuCopy,
  LuExternalLink,
  LuLoader,
  LuPlay,
  LuRefreshCw,
  LuTriangleAlert,
  LuWebhook,
} from 'react-icons/lu';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type WebhookRow = {
  webhookId: string;
  appEvent: string;
  method: string;
  authentication: string;
  responseMode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  publicUrl: string;
};

export function WebhooksClient({ flowId }: { flowId: string }) {
  const [rows, setRows] = useState<WebhookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    webhookId: string;
    status: number;
    body: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sabflow/${flowId}/webhooks`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Failed to load webhooks (${res.status})`);
      const json = (await res.json()) as { webhooks: WebhookRow[] };
      setRows(json.webhooks);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = useCallback((webhookId: string, url: string) => {
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedId(webhookId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }, []);

  const test = useCallback(async (row: WebhookRow) => {
    setTesting(row.webhookId);
    setTestResult(null);
    try {
      const res = await fetch(row.publicUrl, {
        method: row.method === 'ANY' ? 'POST' : row.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true, source: 'webhooks-management' }),
      });
      const text = await res.text();
      setTestResult({
        webhookId: row.webhookId,
        status: res.status,
        body: text.slice(0, 400),
      });
    } catch (e) {
      setTestResult({
        webhookId: row.webhookId,
        status: 0,
        body: e instanceof Error ? e.message : 'Network error',
      });
    } finally {
      setTesting(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 border-b border-[var(--gray-4)] px-6 py-4 shrink-0">
        <Link
          href={`/dashboard/sabflow/flow-builder/${flowId}`}
          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
        >
          <LuArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
          <LuWebhook className="h-4 w-4" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-tight">
          <h1 className="text-[15px] font-semibold text-[var(--gray-12)]">
            Webhooks
          </h1>
          <p className="text-[11.5px] text-[var(--gray-9)]">
            Public trigger URLs registered for this flow
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
        >
          <LuRefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[var(--gray-9)]">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading webhooks…</span>
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[12px] text-[var(--st-text)]">
            <LuTriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <p className="text-[13px] font-medium text-[var(--gray-12)]">
              No webhooks registered yet
            </p>
            <p className="max-w-md text-[11.5px] text-[var(--gray-9)] leading-relaxed">
              Add a webhook trigger to this flow and activate it — the public URL will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div
                key={row.webhookId}
                className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide',
                      row.isActive
                        ? 'bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]'
                        : 'bg-[var(--st-text)]/10 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]',
                    )}
                  >
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="rounded-md bg-[var(--gray-4)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--gray-11)]">
                    {row.method}
                  </span>
                  <span className="text-[12.5px] font-medium text-[var(--gray-12)]">
                    {row.appEvent}
                  </span>
                  <span className="ml-auto text-[10.5px] text-[var(--gray-9)]">
                    Auth: {row.authentication} · Response: {row.responseMode}
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)] px-3 py-2">
                  <code className="flex-1 truncate font-mono text-[11.5px] text-[var(--gray-11)]">
                    {row.publicUrl}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(row.webhookId, row.publicUrl)}
                    title="Copy URL"
                    className="rounded-md p-1.5 text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
                  >
                    {copiedId === row.webhookId ? (
                      <LuCheck className="h-3.5 w-3.5 text-[var(--st-text)]" />
                    ) : (
                      <LuCopy className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <a
                    href={row.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in new tab"
                    className="rounded-md p-1.5 text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
                  >
                    <LuExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => test(row)}
                    disabled={testing === row.webhookId || !row.isActive}
                    title={
                      row.isActive
                        ? 'Send a sample payload'
                        : 'Activate the webhook to test it'
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--gray-5)] bg-[var(--gray-2)] px-2 py-1 text-[11px] font-medium text-[var(--gray-11)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] disabled:opacity-50"
                  >
                    {testing === row.webhookId ? (
                      <LuLoader className="h-3 w-3 animate-spin" />
                    ) : (
                      <LuPlay className="h-3 w-3" />
                    )}
                    Test
                  </button>
                </div>

                {testResult && testResult.webhookId === row.webhookId && (
                  <div
                    className={cn(
                      'mt-2 rounded-lg border px-3 py-2 text-[11px]',
                      testResult.status >= 200 && testResult.status < 400
                        ? 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]'
                        : 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
                    )}
                  >
                    <div className="font-semibold mb-1">
                      HTTP {testResult.status || 'network error'}
                    </div>
                    {testResult.body && (
                      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10.5px] leading-snug">
                        {testResult.body}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

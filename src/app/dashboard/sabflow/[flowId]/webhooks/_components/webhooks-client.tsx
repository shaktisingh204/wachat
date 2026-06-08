'use client';

/**
 * WebhooksClient - flow webhook management.
 *
 * Lists registered webhooks (active + inactive), shows the full public URL
 * with a copy-to-clipboard button, the method + auth scheme, and a "Test"
 * action that hits the URL with a sample payload so users can validate the
 * round-trip without leaving the page.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Play,
  RefreshCw,
  Webhook,
} from 'lucide-react';
import Link from 'next/link';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Spinner,
  cn,
  useToast,
} from '@/components/sabcrm/20ui';

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
  const { toast } = useToast();
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

  const copy = useCallback(
    (webhookId: string, url: string) => {
      void navigator.clipboard.writeText(url).then(() => {
        setCopiedId(webhookId);
        toast.success('Webhook URL copied');
        setTimeout(() => setCopiedId(null), 2000);
      });
    },
    [toast],
  );

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
    <div className="20ui flex h-full flex-col">
      <PageHeader compact>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/sabflow/flow-builder/${flowId}`}
            aria-label="Back to flow builder"
            className="flex h-7 w-7 items-center justify-center rounded-[var(--st-radius)] text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <span
            className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
            aria-hidden="true"
          >
            <Webhook className="h-4 w-4" />
          </span>
          <PageHeaderHeading>
            <PageTitle>Webhooks</PageTitle>
            <PageDescription>
              Public trigger URLs registered for this flow
            </PageDescription>
          </PageHeaderHeading>
        </div>
        <PageActions>
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            disabled={loading}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 overflow-y-auto p-6">
        {loading && rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center gap-2 text-[var(--st-text-secondary)]">
            <Spinner size="sm" label="Loading webhooks" />
            <span className="text-[12px]">Loading webhooks.</span>
          </div>
        ) : error ? (
          <Alert tone="danger" title="Could not load webhooks">
            {error}
          </Alert>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhooks registered yet"
            description="Add a webhook trigger to this flow and activate it. The public URL will appear here."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.webhookId} padding="md">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={row.isActive ? 'success' : 'neutral'} dot>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge tone="neutral" kind="outline">
                    {row.method}
                  </Badge>
                  <span className="text-[12.5px] font-medium text-[var(--st-text)]">
                    {row.appEvent}
                  </span>
                  <span className="ml-auto text-[10.5px] text-[var(--st-text-secondary)]">
                    Auth: {row.authentication} , Response: {row.responseMode}
                  </span>
                </div>

                <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
                  <code className="flex-1 truncate font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                    {row.publicUrl}
                  </code>
                  <IconButton
                    label="Copy URL"
                    icon={copiedId === row.webhookId ? Check : Copy}
                    size="sm"
                    onClick={() => copy(row.webhookId, row.publicUrl)}
                  />
                  <IconButton
                    label="Open in new tab"
                    icon={ExternalLink}
                    size="sm"
                    onClick={() =>
                      window.open(row.publicUrl, '_blank', 'noopener,noreferrer')
                    }
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => test(row)}
                    disabled={testing === row.webhookId || !row.isActive}
                    loading={testing === row.webhookId}
                    iconLeft={Play}
                    title={
                      row.isActive
                        ? 'Send a sample payload'
                        : 'Activate the webhook to test it'
                    }
                  >
                    Test
                  </Button>
                </div>

                {testResult && testResult.webhookId === row.webhookId && (
                  <div
                    className={cn(
                      'mt-2 rounded-[var(--st-radius)] border px-3 py-2 text-[11px]',
                      'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <Badge
                        tone={
                          testResult.status >= 200 && testResult.status < 400
                            ? 'success'
                            : 'danger'
                        }
                      >
                        {testResult.status
                          ? `HTTP ${testResult.status}`
                          : 'Network error'}
                      </Badge>
                    </div>
                    {testResult.body && (
                      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10.5px] leading-snug text-[var(--st-text-secondary)]">
                        {testResult.body}
                      </pre>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * NetworkRequestItem — a single HTTP row in the "Network" tab.
 *
 * Expanded view shows Headers / Request body / Response body in
 * tabs.  Colors follow HTTP convention (2xx green, 4xx amber, 5xx red).
 */

import { memo, useState, type ReactNode } from 'react';
import { LuChevronDown, LuChevronRight } from 'react-icons/lu';
import type { DebugNetworkRequest } from '@/lib/sabflow/debug/types';

type NetTab = 'headers' | 'request' | 'response';

function methodClass(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'POST':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'PUT':
    case 'PATCH':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'DELETE':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-[var(--gray-3)] text-[var(--gray-11)]';
  }
}

function statusClass(status: number | undefined, error: string | undefined): string {
  if (error) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (status === undefined) return 'bg-[var(--gray-3)] text-[var(--gray-10)]';
  if (status >= 500) return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
  if (status >= 400) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  if (status >= 200 && status < 300)
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
  return 'bg-[var(--gray-3)] text-[var(--gray-11)]';
}

function fmtHeaders(h: Record<string, string> | undefined): string {
  if (!h) return '—';
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function prettyBody(body: string | undefined): string {
  if (!body) return '—';
  const trimmed = body.trim();
  if (!trimmed) return '—';
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

interface Props {
  request: DebugNetworkRequest;
}

function NetworkRequestItemImpl({ request }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NetTab>('response');

  const isPending = request.status === undefined && !request.error;

  return (
    <div className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-1)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--gray-3)]"
      >
        {open ? (
          <LuChevronDown className="h-3 w-3 shrink-0 text-[var(--gray-9)]" strokeWidth={2} />
        ) : (
          <LuChevronRight className="h-3 w-3 shrink-0 text-[var(--gray-9)]" strokeWidth={2} />
        )}

        <span
          className={
            'inline-flex h-[18px] min-w-[38px] items-center justify-center rounded px-1.5 font-mono text-[10px] font-bold uppercase shrink-0 ' +
            methodClass(request.method)
          }
        >
          {request.method}
        </span>

        <span
          className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[var(--gray-12)]"
          title={request.url}
        >
          {request.url}
        </span>

        <span
          className={
            'inline-flex h-[18px] min-w-[34px] items-center justify-center rounded px-1.5 font-mono text-[10px] font-semibold tabular-nums shrink-0 ' +
            statusClass(request.status, request.error)
          }
        >
          {request.error
            ? 'ERR'
            : isPending
              ? '…'
              : request.status}
        </span>

        {typeof request.duration === 'number' ? (
          <span className="shrink-0 rounded bg-[var(--gray-3)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--gray-9)]">
            {request.duration}ms
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="border-t border-[var(--gray-4)] bg-[var(--gray-2)]">
          <div className="flex gap-1 border-b border-[var(--gray-4)] px-2 pt-1.5">
            <TabBtn label="Headers" active={tab === 'headers'} onClick={() => setTab('headers')} />
            <TabBtn label="Request" active={tab === 'request'} onClick={() => setTab('request')} />
            <TabBtn label="Response" active={tab === 'response'} onClick={() => setTab('response')} />
          </div>
          <div className="px-2.5 py-2">
            {request.error ? (
              <Pane
                label="Error"
                body={request.error}
                tone="error"
              />
            ) : null}
            {tab === 'headers' ? (
              <>
                <Pane label="Request headers" body={fmtHeaders(request.requestHeaders)} />
                <Pane label="Response headers" body={fmtHeaders(request.responseHeaders)} />
              </>
            ) : null}
            {tab === 'request' ? <Pane label="Request body" body={prettyBody(request.requestBody)} /> : null}
            {tab === 'response' ? <Pane label="Response body" body={prettyBody(request.responseBody)} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'rounded-t px-2 py-1 text-[11px] font-medium transition-colors ' +
        (active
          ? 'bg-[var(--gray-1)] text-[var(--gray-12)] border border-[var(--gray-4)] border-b-[var(--gray-1)] -mb-px'
          : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]')
      }
    >
      {label}
    </button>
  );
}

function Pane({
  label,
  body,
  tone = 'default',
}: {
  label: string;
  body: string;
  tone?: 'default' | 'error';
}): ReactNode {
  return (
    <div className="mb-2 last:mb-0">
      <div
        className={
          'mb-1 text-[10px] font-semibold uppercase tracking-wide ' +
          (tone === 'error'
            ? 'text-red-600 dark:text-red-400'
            : 'text-[var(--gray-9)]')
        }
      >
        {label}
      </div>
      <pre
        className={
          'max-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded bg-[var(--gray-1)] p-2 font-mono text-[11px] leading-snug ' +
          (tone === 'error'
            ? 'text-red-700 dark:text-red-300'
            : 'text-[var(--gray-11)]')
        }
      >
        {body}
      </pre>
    </div>
  );
}

export const NetworkRequestItem = memo(NetworkRequestItemImpl);

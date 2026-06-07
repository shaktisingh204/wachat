'use client';

/**
 * NetworkRequestItem - a single HTTP row in the "Network" tab.
 *
 * Expanded view shows Headers / Request body / Response body in tabs.
 * Status colours follow HTTP convention (2xx ok, 4xx warn, 5xx danger) and are
 * carried by 20ui Badge tones so meaning never relies on colour alone.
 */

import { memo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import type { DebugNetworkRequest } from '@/lib/sabflow/debug/types';

type NetTab = 'headers' | 'request' | 'response';

function statusTone(status: number | undefined, error: string | undefined): BadgeTone {
  if (error) return 'danger';
  if (status === undefined) return 'neutral';
  if (status >= 500) return 'danger';
  if (status >= 400) return 'warning';
  if (status >= 200 && status < 300) return 'success';
  return 'neutral';
}

function fmtHeaders(h: Record<string, string> | undefined): string {
  if (!h) return '-';
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function prettyBody(body: string | undefined): string {
  if (!body) return '-';
  const trimmed = body.trim();
  if (!trimmed) return '-';
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
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]"
    >
      <CollapsibleTrigger
        hideChevron
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--st-bg-muted)]"
      >
        <ChevronDown
          size={12}
          strokeWidth={2}
          aria-hidden="true"
          className={
            'shrink-0 text-[var(--st-text-tertiary)] transition-transform ' +
            (open ? 'rotate-0' : '-rotate-90')
          }
        />

        <Badge
          tone="neutral"
          className="min-w-[38px] shrink-0 justify-center font-mono text-[10px] font-bold uppercase"
        >
          {request.method}
        </Badge>

        <span
          className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-[var(--st-text)]"
          title={request.url}
        >
          {request.url}
        </span>

        <Badge
          tone={statusTone(request.status, request.error)}
          className="min-w-[34px] shrink-0 justify-center font-mono text-[10px] font-semibold tabular-nums"
        >
          {request.error ? 'ERR' : isPending ? '...' : request.status}
        </Badge>

        {typeof request.duration === 'number' ? (
          <Badge
            tone="neutral"
            className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--st-text-secondary)]"
          >
            {request.duration}ms
          </Badge>
        ) : null}
      </CollapsibleTrigger>

      <CollapsibleContent className="border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <Tabs value={tab} onValueChange={(v) => setTab(v as NetTab)}>
          <TabsList className="px-2 pt-1.5">
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="request">Request</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
          </TabsList>

          <div className="px-2.5 py-2">
            {request.error ? <Pane label="Error" body={request.error} tone="error" /> : null}

            <TabsContent value="headers">
              <Pane label="Request headers" body={fmtHeaders(request.requestHeaders)} />
              <Pane label="Response headers" body={fmtHeaders(request.responseHeaders)} />
            </TabsContent>
            <TabsContent value="request">
              <Pane label="Request body" body={prettyBody(request.requestBody)} />
            </TabsContent>
            <TabsContent value="response">
              <Pane label="Response body" body={prettyBody(request.responseBody)} />
            </TabsContent>
          </div>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
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
          (tone === 'error' ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-tertiary)]')
        }
      >
        {label}
      </div>
      <pre
        className={
          'max-h-[220px] overflow-auto whitespace-pre-wrap break-all rounded-[var(--st-radius-sm)] bg-[var(--st-bg)] p-2 font-mono text-[11px] leading-snug ' +
          (tone === 'error' ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]')
        }
      >
        {body}
      </pre>
    </div>
  );
}

export const NetworkRequestItem = memo(NetworkRequestItemImpl);

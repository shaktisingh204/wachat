'use client';

import { Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, DatePicker, Input, Label, Table, TBody, Td, Th, THead, Tr, cn, useToast } from '@/components/sabcrm/20ui/compat';
import {
  format } from 'date-fns';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  RefreshCw,
  ScrollText,
  Search,
  } from 'lucide-react';

import {
  listAuditEntries,
  type SabwaAuditEntryRow,
  } from '@/app/actions/sabwa.actions';

/**
 * /sabwa/audit — Append-only audit log with rich filters and CSV export.
 *
 * Click a row to expand the full metadata JSON. Filters: session, date
 * range, action prefix (e.g. `message.*`), free-text search.
 *
 * Visual layer migrated to ZoruUI.
 */

import * as React from 'react';

import { EmptyState } from '@/app/sabwa/_components/empty-state';
import { formatJid, useResolveJid } from '@/lib/sabwa/format-jid';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function entriesToCsv(rows: SabwaAuditEntryRow[]): string {
  const headers = [
    'ts',
    'actor_email',
    'actor_id',
    'action',
    'target',
    'ip',
    'user_agent',
    'metadata',
  ];
  const lines = rows.map((r) =>
    [
      typeof r.ts === 'string' ? r.ts : new Date(r.ts).toISOString(),
      r.actorEmail ?? '',
      r.actorId ?? '',
      r.action,
      r.target ?? '',
      r.ip ?? '',
      r.userAgent ?? '',
      r.metadata ? JSON.stringify(r.metadata) : '',
    ]
      .map(csvEscape)
      .join(','),
  );
  return [headers.join(','), ...lines].join('\n');
}

export default function AuditPage() {
  const toast = useToast();
  const [rows, setRows] = React.useState<SabwaAuditEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Filters
  const [sessionId, setSessionId] = React.useState('');
  const resolve = useResolveJid(sessionId.trim());
  const [from, setFrom] = React.useState<Date | undefined>();
  const [to, setTo] = React.useState<Date | undefined>();
  const [actionPrefix, setActionPrefix] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAuditEntries({
        sessionId: sessionId.trim() || undefined,
        from,
        to,
        actionPrefix: actionPrefix.trim() || undefined,
        search: search.trim() || undefined,
        limit: 200,
      });
      if (res.ok) setRows(res.entries);
    } catch {
      // engine offline
    } finally {
      setLoading(false);
    }
  }, [sessionId, from, to, actionPrefix, search]);

  React.useEffect(() => {
    void load();
    // Only auto-load on mount; subsequent loads are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = React.useCallback(() => {
    if (rows.length === 0) {
      toast.toast({
        title: 'Nothing to export',
        description: 'No rows match.',
      });
      return;
    }
    const csv = entriesToCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabwa-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.toast({ title: 'CSV exported', description: `${rows.length} rows` });
  }, [rows, toast]);

  const reset = React.useCallback(() => {
    setSessionId('');
    setFrom(undefined);
    setTo(undefined);
    setActionPrefix('');
    setSearch('');
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Audit log</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[24px] leading-[1.2] tracking-[-0.015em] text-[var(--st-text)]">
              Audit Log
            </h1>
            <p className="mt-1 text-[13px] text-[var(--st-text-secondary)]">
              Append-only record of every actor / action / target for
              compliance.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>
            Narrow the log by session, date range, action prefix, or text.
          </CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Session
              </Label>
              <Input
                placeholder="sessionId or blank for all"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                From
              </Label>
              <DatePicker
                value={from}
                onChange={setFrom}
                placeholder="From"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                To
              </Label>
              <DatePicker
                value={to}
                onChange={setTo}
                placeholder="To"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Action prefix
              </Label>
              <Input
                placeholder="e.g. message.*"
                value={actionPrefix}
                onChange={(e) => setActionPrefix(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Search
              </Label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-secondary)]"
                  aria-hidden
                />
                <Input
                  placeholder="target or metadata text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={reset}>
              Clear
            </Button>
            <Button size="sm" onClick={() => void load()} disabled={loading}>
              Apply filters
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entries</CardTitle>
          <CardDescription>
            Click a row to expand its full metadata JSON.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {rows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No matching audit entries"
              description="Adjust the filters above or wait for activity to be logged."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th className="w-6" />
                    <Th>Timestamp</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Target</Th>
                    <Th>IP</Th>
                    <Th>User agent</Th>
                  </Tr>
                </THead>
                <TBody>
                  {rows.map((row) => {
                    const isOpen = expanded[row.id] === true;
                    return (
                      <React.Fragment key={row.id}>
                        <Tr
                          className="cursor-pointer"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [row.id]: !isOpen,
                            }))
                          }
                        >
                          <Td className="pr-0 align-top">
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                            )}
                          </Td>
                          <Td className="font-mono text-xs">
                            {format(new Date(row.ts), 'yyyy-MM-dd HH:mm:ss')}
                          </Td>
                          <Td className="text-xs">
                            {row.actorEmail ?? row.actorId ?? '—'}
                          </Td>
                          <Td>
                            <Badge
                              variant="secondary"
                              className="font-mono text-[10px]"
                            >
                              {row.action}
                            </Badge>
                          </Td>
                          <Td className="max-w-[220px] truncate text-xs">
                            {(() => {
                              const t = row.target;
                              if (!t) return '—';
                              const looksLikeJid = t.includes('@');
                              if (!looksLikeJid) {
                                return (
                                  <span className="font-mono">{t}</span>
                                );
                              }
                              const resolved =
                                sessionId.trim() && resolve
                                  ? resolve(t)
                                  : formatJid(t);
                              const pretty = formatJid(t);
                              return (
                                <div className="flex flex-col">
                                  <span className="truncate text-[var(--st-text)]">
                                    {resolved}
                                  </span>
                                  {resolved !== pretty && (
                                    <span className="truncate font-mono text-[10px] text-[var(--st-text-secondary)]">
                                      {pretty}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </Td>
                          <Td className="font-mono text-xs">
                            {row.ip ?? '—'}
                          </Td>
                          <Td
                            className={cn(
                              'max-w-[180px] truncate text-xs text-[var(--st-text-secondary)]',
                            )}
                            title={row.userAgent}
                          >
                            {row.userAgent ?? '—'}
                          </Td>
                        </Tr>
                        {isOpen ? (
                          <Tr>
                            <Td />
                            <Td
                              colSpan={6}
                              className="bg-[var(--st-bg-secondary)]"
                            >
                              <pre className="overflow-auto rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 text-[11px] leading-relaxed text-[var(--st-text)]">
                                {JSON.stringify(row, null, 2)}
                              </pre>
                            </Td>
                          </Tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

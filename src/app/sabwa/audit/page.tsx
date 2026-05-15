'use client';

/**
 * /sabwa/audit — Append-only audit log with rich filters and CSV export.
 *
 * Click a row to expand the full metadata JSON. Filters: session, date
 * range, action prefix (e.g. `message.*`), free-text search.
 */

import * as React from 'react';
import { format } from 'date-fns';
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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { EmptyState } from '@/app/sabwa/_components/empty-state';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'string' ? value : JSON.stringify(value);
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
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SabwaAuditEntryRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Filters
  const [sessionId, setSessionId] = React.useState('');
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
      toast({ title: 'Nothing to export', description: 'No rows match.' });
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
    toast({ title: 'CSV exported', description: `${rows.length} rows` });
  }, [rows, toast]);

  const reset = React.useCallback(() => {
    setSessionId('');
    setFrom(undefined);
    setTo(undefined);
    setActionPrefix('');
    setSearch('');
  }, []);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-secondary p-3">
            <ScrollText className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Audit Log
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
            className="h-9 gap-1.5"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="h-9 gap-1.5"
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
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Session
              </Label>
              <Input
                placeholder="sessionId or blank for all"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                From
              </Label>
              <DatePicker
                date={from}
                setDate={setFrom}
                placeholder="From"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                To
              </Label>
              <DatePicker
                date={to}
                setDate={setTo}
                placeholder="To"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Action prefix
              </Label>
              <Input
                placeholder="e.g. message.*"
                value={actionPrefix}
                onChange={(e) => setActionPrefix(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="target or metadata text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-7"
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entries</CardTitle>
          <CardDescription>
            Click a row to expand its full metadata JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No matching audit entries"
              description="Adjust the filters above or wait for activity to be logged."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-6" />
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>User agent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isOpen = expanded[row.id] === true;
                    return (
                      <React.Fragment key={row.id}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() =>
                            setExpanded((prev) => ({
                              ...prev,
                              [row.id]: !isOpen,
                            }))
                          }
                        >
                          <TableCell className="pr-0 align-top">
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {format(new Date(row.ts), 'yyyy-MM-dd HH:mm:ss')}
                          </TableCell>
                          <TableCell className="text-xs">
                            {row.actorEmail ?? row.actorId ?? '—'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className="font-mono text-[10px]"
                            >
                              {row.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate font-mono text-xs">
                            {row.target ?? '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.ip ?? '—'}
                          </TableCell>
                          <TableCell
                            className={cn(
                              'max-w-[180px] truncate text-xs text-muted-foreground',
                            )}
                            title={row.userAgent}
                          >
                            {row.userAgent ?? '—'}
                          </TableCell>
                        </TableRow>
                        {isOpen ? (
                          <TableRow>
                            <TableCell />
                            <TableCell colSpan={6} className="bg-muted/30">
                              <pre className="overflow-auto rounded-md border bg-background p-3 text-[11px] leading-relaxed">
                                {JSON.stringify(row, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

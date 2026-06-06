'use client';

import { Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, StatCard, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  Clock,
  ClipboardList,
  Download,
  Filter,
  RotateCcw,
  Timer,
} from 'lucide-react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTimeReport } from '@/app/actions/worksuite/time.actions';
import { downloadCsv } from '@/lib/crm-list-export';
import { format } from 'date-fns';
import { wsWeekBounds } from '@/lib/worksuite/time-types';
import type { WsTimeReportRow } from '@/lib/worksuite/time-types';

type Group = 'employee' | 'project' | 'date';

function toCsv(rows: WsTimeReportRow[], groupLabel: string): string {
  const header = `${groupLabel},Entries,Hours,Minutes\n`;
  const body = rows
    .map(
      (r) =>
        `"${String(r.label).replace(/"/g, '""')}",${r.entries},${r.totalHours},${r.totalMinutes}`,
    )
    .join('\n');
  return header + body;
}

function triggerCsvDownload(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function fmtDuration(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60)}h ${String(totalMinutes % 60).padStart(2, '0')}m`;
}

export default function TimeTrackingReportsPage() {
  const [group, setGroup] = useState<Group>('project');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<WsTimeReportRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  // "this week" rows fetched once on mount
  const [weekRows, setWeekRows] = useState<WsTimeReportRow[]>([]);
  const [, startWeekLoad] = useTransition();

  const refresh = useCallback(() => {
    startLoading(async () => {
      const list = await getTimeReport(group, from || undefined, to || undefined);
      setRows(list);
    });
  }, [group, from, to]);

  // Load this-week stats on mount (all groups summed)
  React.useEffect(() => {
    const { start, end } = wsWeekBounds();
    const s = start.toISOString().slice(0, 10);
    const e = end.toISOString().slice(0, 10);
    startWeekLoad(async () => {
      const list = await getTimeReport('date', s, e);
      setWeekRows(list);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const groupLabel =
    group === 'employee' ? 'Employee' : group === 'project' ? 'Project' : 'Date';

  const grandMinutes = rows.reduce(
    (s, r) => s + r.totalHours * 60 + r.totalMinutes,
    0,
  );
  const totalEntries = rows.reduce((s, r) => s + r.entries, 0);
  const avgPerEntry =
    totalEntries > 0 ? Math.round(grandMinutes / totalEntries) : 0;
  const weekMinutes = weekRows.reduce(
    (s, r) => s + r.totalHours * 60 + r.totalMinutes,
    0,
  );

  return (
    <EntityListShell
      title="Time Report"
      subtitle="Group logged time by employee, project, or date. Export as CSV."
      primaryAction={
        <Button
          onClick={() =>
            triggerCsvDownload(
              `time-report-${group}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
              toCsv(rows, groupLabel),
            )
          }
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Export CSV
        </Button>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total hours"
          value={fmtDuration(grandMinutes)}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Total entries"
          value={totalEntries}
          icon={<ClipboardList className="h-4 w-4" />}
        />
        <StatCard
          label="Avg per entry"
          value={totalEntries > 0 ? fmtDuration(avgPerEntry) : '—'}
          icon={<Timer className="h-4 w-4" />}
        />
        <StatCard
          label="This week"
          value={fmtDuration(weekMinutes)}
          icon={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Filter bar */}
      <Card className="p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-[var(--st-text-secondary)]">
              Group by
            </Label>
            <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
              <SelectTrigger className="mt-1 h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">Employee</SelectItem>
                <SelectItem value="project">Project</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-[var(--st-text-secondary)]">
              From
            </Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-[var(--st-text-secondary)]">
              To
            </Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 h-9 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
            />
          </div>
          <Button variant="outline" onClick={refresh}>
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            Apply
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setGroup('project');
              setFrom('');
              setTo('');
            }}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            Reset
          </Button>
        </div>
      </Card>

      {/* Results table */}
      <Card className="p-6">
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="text-[var(--st-text-secondary)]">{groupLabel}</Th>
                <Th className="text-[var(--st-text-secondary)]">Entries</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Hours</Th>
              </Tr>
            </THead>
            <TBody>
              {isLoading && rows.length === 0 ? (
                [0, 1, 2].map((i) => (
                  <Tr key={i} className="border-[var(--st-border)]">
                    <Td colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </Td>
                  </Tr>
                ))
              ) : rows.length === 0 ? (
                <Tr className="border-[var(--st-border)]">
                  <Td
                    colSpan={3}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    No logged time for the selected range.
                  </Td>
                </Tr>
              ) : (
                rows.map((r) => (
                  <Tr key={r.key} className="border-[var(--st-border)]">
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.label === 'unknown' ? (
                        <span className="text-[var(--st-text-secondary)]">(unassigned)</span>
                      ) : (
                        <span className="font-mono text-[12.5px]">{r.label}</span>
                      )}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {r.entries}
                    </Td>
                    <Td className="text-right font-mono tabular-nums text-[13px] text-[var(--st-text)]">
                      {r.totalHours}h {String(r.totalMinutes).padStart(2, '0')}m
                    </Td>
                  </Tr>
                ))
              )}
            </TBody>
          </Table>
          {rows.length > 0 ? (
            <div className="flex items-center justify-between border-t border-[var(--st-border)] bg-[var(--st-bg-muted)] px-4 py-3 text-[13px]">
              <span className="text-[11.5px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                Total
              </span>
              <span className="font-mono font-semibold tabular-nums text-[var(--st-text)]">
                {Math.floor(grandMinutes / 60)}h{' '}
                {String(grandMinutes % 60).padStart(2, '0')}m
              </span>
            </div>
          ) : null}
        </div>
      </Card>
    </EntityListShell>
  );
}

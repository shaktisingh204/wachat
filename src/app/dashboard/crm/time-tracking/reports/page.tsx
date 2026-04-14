'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { BarChart3, Download, Filter, RotateCcw } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getTimeReport,
  type WsTimeReportRow,
} from '@/app/actions/worksuite/time.actions';

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

function downloadCsv(filename: string, text: string) {
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

export default function TimeTrackingReportsPage() {
  const [group, setGroup] = useState<Group>('project');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<WsTimeReportRow[]>([]);
  const [isLoading, startLoading] = useTransition();

  const refresh = useCallback(() => {
    startLoading(async () => {
      const list = await getTimeReport(group, from || undefined, to || undefined);
      setRows(list);
    });
  }, [group, from, to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const groupLabel =
    group === 'employee' ? 'Employee' : group === 'project' ? 'Project' : 'Date';

  const grandMinutes = rows.reduce(
    (s, r) => s + r.totalHours * 60 + r.totalMinutes,
    0,
  );

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Time Report"
        subtitle="Group logged time by employee, project, or date. Export as CSV."
        icon={BarChart3}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Download className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() =>
              downloadCsv(
                `time-report-${group}-${new Date().toISOString().slice(0, 10)}.csv`,
                toCsv(rows, groupLabel),
              )
            }
            disabled={rows.length === 0}
          >
            Export CSV
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
              Group by
            </Label>
            <Select value={group} onValueChange={(v) => setGroup(v as Group)}>
              <SelectTrigger className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
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
            <Label className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
              From
            </Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <Label className="text-[11px] uppercase tracking-[0.18em] text-clay-ink-muted">
              To
            </Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <ClayButton
            variant="pill"
            leading={<Filter className="h-4 w-4" strokeWidth={1.75} />}
            onClick={refresh}
          >
            Apply
          </ClayButton>
          <ClayButton
            variant="ghost"
            leading={<RotateCcw className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setGroup('project');
              setFrom('');
              setTo('');
            }}
          >
            Reset
          </ClayButton>
        </div>
      </ClayCard>

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">{groupLabel}</TableHead>
                <TableHead className="text-clay-ink-muted">Entries</TableHead>
                <TableHead className="text-right text-clay-ink-muted">
                  Hours
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                [0, 1, 2].map((i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={3}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No logged time for the selected range.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.key} className="border-clay-border">
                    <TableCell className="text-[13px] text-clay-ink">
                      {r.label === 'unknown' ? (
                        <span className="text-clay-ink-muted">(unassigned)</span>
                      ) : (
                        <span className="font-mono text-[12.5px]">{r.label}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink-muted">
                      {r.entries}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-[13px] text-clay-ink">
                      {r.totalHours}h {String(r.totalMinutes).padStart(2, '0')}m
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {rows.length > 0 ? (
            <div className="flex items-center justify-between border-t border-clay-border bg-clay-surface-2 px-4 py-3 text-[13px]">
              <span className="text-[11.5px] uppercase tracking-[0.1em] text-clay-ink-muted">
                Total
              </span>
              <span className="font-mono font-semibold tabular-nums text-clay-ink">
                {Math.floor(grandMinutes / 60)}h{' '}
                {String(grandMinutes % 60).padStart(2, '0')}m
              </span>
            </div>
          ) : null}
        </div>
      </ClayCard>
    </div>
  );
}

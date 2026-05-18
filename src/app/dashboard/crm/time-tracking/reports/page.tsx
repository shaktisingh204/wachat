'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  Download,
  Filter,
  RotateCcw } from 'lucide-react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getTimeReport } from '@/app/actions/worksuite/time.actions';
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
    <EntityListShell
      title="Time Report"
      subtitle="Group logged time by employee, project, or date. Export as CSV."
      primaryAction={
        <ZoruButton
          onClick={() =>
            downloadCsv(
              `time-report-${group}-${new Date().toISOString().slice(0, 10)}.csv`,
              toCsv(rows, groupLabel),
            )
          }
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Export CSV
        </ZoruButton>
      }
    >

      <ZoruCard className="p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
              Group by
            </ZoruLabel>
            <ZoruSelect value={group} onValueChange={(v) => setGroup(v as Group)}>
              <ZoruSelectTrigger className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="employee">Employee</ZoruSelectItem>
                <ZoruSelectItem value="project">Project</ZoruSelectItem>
                <ZoruSelectItem value="date">Date</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="min-w-[140px] flex-1">
            <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
              From
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <ZoruLabel className="text-[11px] uppercase tracking-[0.18em] text-zoru-ink-muted">
              To
            </ZoruLabel>
            <ZoruInput
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
            />
          </div>
          <ZoruButton variant="outline" onClick={refresh}>
            <Filter className="h-4 w-4" strokeWidth={1.75} />
            Apply
          </ZoruButton>
          <ZoruButton
            variant="ghost"
            onClick={() => {
              setGroup('project');
              setFrom('');
              setTo('');
            }}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            Reset
          </ZoruButton>
        </div>
      </ZoruCard>

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="text-zoru-ink-muted">{groupLabel}</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Entries</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">
                  Hours
                </ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                [0, 1, 2].map((i) => (
                  <ZoruTableRow key={i} className="border-zoru-line">
                    <ZoruTableCell colSpan={3}>
                      <ZoruSkeleton className="h-8 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : rows.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={3}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    No logged time for the selected range.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((r) => (
                  <ZoruTableRow key={r.key} className="border-zoru-line">
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {r.label === 'unknown' ? (
                        <span className="text-zoru-ink-muted">(unassigned)</span>
                      ) : (
                        <span className="font-mono text-[12.5px]">{r.label}</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {r.entries}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right font-mono tabular-nums text-[13px] text-zoru-ink">
                      {r.totalHours}h {String(r.totalMinutes).padStart(2, '0')}m
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
          {rows.length > 0 ? (
            <div className="flex items-center justify-between border-t border-zoru-line bg-zoru-surface-2 px-4 py-3 text-[13px]">
              <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                Total
              </span>
              <span className="font-mono font-semibold tabular-nums text-zoru-ink">
                {Math.floor(grandMinutes / 60)}h{' '}
                {String(grandMinutes % 60).padStart(2, '0')}m
              </span>
            </div>
          ) : null}
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}

'use client';

/**
 * KPI tracking — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Total · On-track · Achieved · Behind.
 * Server actions preserved: getCrmKpis / deleteCrmKpi / bulkDeleteCrmKpis.
 * Export: CSV + XLSX of KPI name, employee, period, target, actual,
 *         achievement %, status.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { Download, LineChart } from 'lucide-react';

import {
  ZoruButton,
} from '@/components/zoruui';

import {
  getCrmKpis,
  deleteCrmKpi,
  type CrmKpi,
} from '@/app/actions/crm-hr-appraisals.actions';
import type { WithId } from 'mongodb';

import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
  HrChip,
  HrListShell,
  HrStatusCell,
} from '../../hr/_components/hr-list-shell';

type Row = WithId<CrmKpi>;
type StringRow = Omit<Row, '_id'> & { _id: string };

function AchievementBar({ target, actual }: { target: number; actual: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const color =
    pct >= 100 ? 'bg-green-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-zoru-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] tabular-nums text-zoru-ink-muted">{pct}%</span>
    </div>
  );
}

function achievementPct(target: number, actual: number): number {
  return target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
}

export default function KpiTrackingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = (await getCrmKpis()) as Row[];
      setRows(Array.isArray(data) ? data : []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const kpis = React.useMemo(() => {
    const total = rows.length;
    const onTrack = rows.filter((r) => r.status === 'on-track').length;
    const achieved = rows.filter((r) => r.status === 'achieved').length;
    const behind = rows.filter((r) => r.status === 'behind').length;
    return [
      { label: 'Total', value: total },
      { label: 'On track', value: onTrack, tone: 'amber' as const },
      { label: 'Achieved', value: achieved, tone: 'green' as const },
      { label: 'Behind', value: behind, tone: 'red' as const },
    ];
  }, [rows]);

  const stringRows: StringRow[] = rows.map((r) => ({
    ...r,
    _id: String(r._id),
  })) as StringRow[];

  // HrListShell handles bulk delete by iterating onDelete per id serially.
  // Export buttons are surfaced via extraFilters slot.

  const handleExportCsv = useCallback(() => {
    const headers = ['KPI Name', 'Employee', 'Period', 'Target', 'Actual', 'Achievement %', 'Status'];
    const exportData = rows.map((r) => ({
      'KPI Name': r.kpi_name,
      Employee: r.employee_id,
      Period: r.period,
      Target: String(r.target_value),
      Actual: String(r.actual_value),
      'Achievement %': String(achievementPct(r.target_value, r.actual_value)),
      Status: r.status,
    }));
    downloadCsv(`kpi-tracking-${dateStamp()}.csv`, headers, exportData);
  }, [rows]);

  const handleExportXlsx = useCallback(async () => {
    const headers = ['KPI Name', 'Employee', 'Period', 'Target', 'Actual', 'Achievement %', 'Status'];
    const exportData = rows.map((r) => ({
      'KPI Name': r.kpi_name,
      Employee: r.employee_id,
      Period: r.period,
      Target: String(r.target_value),
      Actual: String(r.actual_value),
      'Achievement %': String(achievementPct(r.target_value, r.actual_value)),
      Status: r.status,
    }));
    await downloadXlsx(`kpi-tracking-${dateStamp()}.xlsx`, headers, exportData, 'KPI Tracking');
  }, [rows]);

  return (
    <HrListShell<StringRow>
      title="KPI tracking"
      subtitle="Key performance indicators with target vs actual achievement."
      icon={LineChart}
      newHref="/dashboard/crm/hr-payroll/kpi-tracking/new"
      editHref={(r) => `/dashboard/crm/hr-payroll/kpi-tracking/${r._id}/edit`}
      detailHref={(r) => `/dashboard/crm/hr-payroll/kpi-tracking/${r._id}`}
      rows={stringRows}
      loading={isLoading}
      kpis={kpis}
      statusOptions={[
        { value: 'on-track', label: 'On track' },
        { value: 'achieved', label: 'Achieved' },
        { value: 'behind', label: 'Behind' },
      ]}
      getRowStatus={(r) => String(r.status ?? '')}
      searchPlaceholder="Search KPIs…"
      searchPredicate={(r, q) =>
        String(r.kpi_name ?? '').toLowerCase().includes(q) ||
        String(r.employee_id ?? '').toLowerCase().includes(q)
      }
      onDelete={deleteCrmKpi}
      onAfterChange={refresh}
      emptyText="No KPIs yet"
      extraFilters={
        <div className="flex items-center gap-2">
          <ZoruButton size="sm" variant="ghost" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> CSV
          </ZoruButton>
          <ZoruButton size="sm" variant="ghost" onClick={handleExportXlsx}>
            <Download className="h-3.5 w-3.5" /> XLSX
          </ZoruButton>
        </div>
      }
      columns={[
        {
          key: 'name',
          label: 'KPI',
          render: (r) => (
            <span className="block max-w-[220px] truncate font-medium">
              {r.kpi_name}
            </span>
          ),
        },
        {
          key: 'employee',
          label: 'Employee',
          render: (r) =>
            r.employee_id ? (
              <span className="block max-w-[140px] truncate">{r.employee_id}</span>
            ) : (
              <span className="text-zoru-ink-muted">—</span>
            ),
        },
        {
          key: 'period',
          label: 'Period',
          render: (r) =>
            r.period ? <HrChip>{r.period}</HrChip> : <span className="text-zoru-ink-muted">—</span>,
        },
        {
          key: 'target',
          label: 'Target',
          render: (r) => (
            <span className="tabular-nums">
              {r.target_value}
              <span className="ml-0.5 text-[11px] text-zoru-ink-muted">{r.unit}</span>
            </span>
          ),
        },
        {
          key: 'actual',
          label: 'Actual',
          render: (r) => (
            <span className="tabular-nums">
              {r.actual_value}
              <span className="ml-0.5 text-[11px] text-zoru-ink-muted">{r.unit}</span>
            </span>
          ),
        },
        {
          key: 'achievement',
          label: 'Achievement',
          render: (r) => (
            <AchievementBar
              target={r.target_value}
              actual={r.actual_value}
            />
          ),
        },
        {
          key: 'status',
          label: 'Status',
          render: (r) => <HrStatusCell value={String(r.status ?? '')} />,
        },
      ]}
    />
  );
}

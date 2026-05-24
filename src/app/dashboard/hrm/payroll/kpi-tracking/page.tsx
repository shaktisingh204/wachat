'use client';

/**
 * KPI tracking — list page rebuilt to §1D.1 bar.
 *
 * KPI strip: Total · On-track · Achieved · Behind.
 * Server actions preserved: getCrmKpis / deleteCrmKpi.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { LineChart, Pencil } from 'lucide-react';

import {
  getCrmKpis,
  deleteCrmKpi,
  saveCrmKpi,
  type CrmKpi,
} from '@/app/actions/crm-hr-appraisals.actions';
import type { WithId } from 'mongodb';

import {
  HrChip,
  HrListShell,
  HrStatusCell,
} from '../../hr/_components/hr-list-shell';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Input,
  useZoruToast,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/zoruui';

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

function InlineActualEditor({ row, onRefresh }: { row: StringRow; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(row.actual_value));
  const { toast } = useZoruToast();
  
  const save = async () => {
    setEditing(false);
    const num = Number(val);
    if (isNaN(num) || num === row.actual_value) {
      setVal(String(row.actual_value));
      return;
    }
    
    const formData = new FormData();
    formData.set('id', row._id);
    formData.set('employee_id', row.employee_id);
    formData.set('kpi_name', row.kpi_name);
    formData.set('target_value', String(row.target_value));
    formData.set('actual_value', String(num));
    formData.set('unit', row.unit);
    formData.set('period', row.period);
    
    // Auto-update status
    let newStatus = row.status;
    if (num >= row.target_value) {
       newStatus = 'achieved';
    } else if (num > 0) {
       newStatus = 'on-track';
    } else {
       newStatus = 'behind';
    }
    formData.set('status', newStatus);

    const res = await saveCrmKpi(null, formData);
    if (res?.error) {
       toast({ title: 'Error', description: res.error, variant: 'destructive' });
       setVal(String(row.actual_value));
    } else {
       toast({ title: 'Saved successfully' });
       onRefresh();
    }
  };
  
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input 
          autoFocus 
          size="sm" 
          value={val} 
          onChange={e => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') {
              setEditing(false);
              setVal(String(row.actual_value));
            }
          }}
          className="w-16 h-7 text-xs tabular-nums px-2 py-1 bg-background"
        />
        <span className="text-[11px] text-zoru-ink-muted">{row.unit}</span>
      </div>
    );
  }

  return (
    <div 
      className="group cursor-pointer flex items-center gap-1 tabular-nums hover:bg-zoru-surface-2 p-1 rounded -m-1 transition-colors" 
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {row.actual_value}
      <span className="text-[11px] text-zoru-ink-muted">{row.unit}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-zoru-ink-muted transition-opacity" />
    </div>
  );
}

export default function KpiTrackingPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [periodFilter, setPeriodFilter] = useState('all');

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        setError(null);
        const data = (await getCrmKpis()) as Row[];
        setRows(Array.isArray(data) ? data : []);
      } catch (err) {
        setError((err as Error).message);
        setRows([]);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const periods = React.useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.period).filter(Boolean))).sort();
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    if (periodFilter === 'all') return rows;
    return rows.filter((r) => r.period === periodFilter);
  }, [rows, periodFilter]);

  const kpis = React.useMemo(() => {
    const total = filteredRows.length;
    const onTrack = filteredRows.filter((r) => r.status === 'on-track').length;
    const achieved = filteredRows.filter((r) => r.status === 'achieved').length;
    const behind = filteredRows.filter((r) => r.status === 'behind').length;
    return [
      { label: 'Total', value: total },
      { label: 'On track', value: onTrack, tone: 'amber' as const },
      { label: 'Achieved', value: achieved, tone: 'green' as const },
      { label: 'Behind', value: behind, tone: 'red' as const },
    ];
  }, [filteredRows]);

  const stringRows: StringRow[] = filteredRows.map((r) => ({
    ...r,
    _id: String(r._id),
  })) as StringRow[];

  const extraFilters = periods.length > 0 ? (
    <Select value={periodFilter} onValueChange={setPeriodFilter}>
      <SelectTrigger className="h-8 w-[150px]">
        <SelectValue placeholder="All Periods" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Periods</SelectItem>
        {periods.map((p) => (
          <SelectItem key={p} value={p}>{p}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error loading KPIs</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <HrListShell<StringRow>
        title="KPI tracking"
        subtitle="Key performance indicators with target vs actual achievement."
        icon={LineChart}
        newHref="/dashboard/hrm/payroll/kpi-tracking/new"
        editHref={(r) => `/dashboard/hrm/payroll/kpi-tracking/${r._id}/edit`}
        detailHref={(r) => `/dashboard/hrm/payroll/kpi-tracking/${r._id}`}
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
        extraFilters={extraFilters}
        columns={[
          {
            key: 'name',
            label: 'KPI',
            render: (r) => (
              <span className="block max-w-[220px] truncate font-medium hover:underline cursor-pointer">
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
            render: (r) => <InlineActualEditor row={r} onRefresh={refresh} />,
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
    </div>
  );
}

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

import { Alert, AlertDescription, AlertTitle, Input, useToast, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Button, Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, Label, Textarea, DateRangePicker } from '@/components/sabcrm/20ui/compat';
import type { DateRange } from 'react-day-picker';

type Row = WithId<CrmKpi>;
type StringRow = Omit<Row, '_id'> & { _id: string };

function AchievementBar({ target, actual }: { target: number; actual: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0;
  const color =
    pct >= 100 ? 'bg-[var(--st-text)]' : pct >= 60 ? 'bg-[var(--st-text)]' : 'bg-[var(--st-text)]';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[var(--st-border)]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] tabular-nums text-[var(--st-text-secondary)]">{pct}%</span>
    </div>
  );
}

function InlineActualEditor({ row, onRefresh }: { row: StringRow; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(row.actual_value));
  const { toast } = useToast();
  
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
          className="w-16 h-7 text-xs tabular-nums px-2 py-1 bg-[var(--st-bg-secondary)]"
        />
        <span className="text-[11px] text-[var(--st-text-secondary)]">{row.unit}</span>
      </div>
    );
  }

  return (
    <div 
      className="group cursor-pointer flex items-center gap-1 tabular-nums hover:bg-[var(--st-bg-muted)] p-1 rounded -m-1 transition-colors" 
      onClick={() => setEditing(true)}
      title="Click to edit"
    >
      {row.actual_value}
      <span className="text-[11px] text-[var(--st-text-secondary)]">{row.unit}</span>
      <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-[var(--st-text-secondary)] transition-opacity" />
    </div>
  );
}

function QuickAddModal({ onRefresh }: { onRefresh: () => void }) {
  const [open, setOpen] = useState(false);
  const [kpiName, setKpiName] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('%');
  const [period, setPeriod] = useState('');
  const [employees, setEmployees] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    const employeeList = employees.split(',').map(e => e.trim()).filter(Boolean);
    if (!kpiName || !targetValue || employeeList.length === 0) {
      toast({ title: 'Validation Error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    let ok = 0;
    for (const emp of employeeList) {
      const formData = new FormData();
      formData.set('employee_id', emp);
      formData.set('kpi_name', kpiName);
      formData.set('target_value', targetValue);
      formData.set('actual_value', '0');
      formData.set('unit', unit);
      formData.set('period', period);
      formData.set('status', 'on-track');
      
      const res = await saveCrmKpi(null, formData);
      if (!res?.error) ok++;
    }
    setIsSubmitting(false);
    toast({ title: `Successfully created ${ok} KPIs` });
    setOpen(false);
    onRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Quick Add</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Create KPIs</DialogTitle>
          <DialogDescription>
            Quickly create a KPI for multiple employees.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>KPI Name</Label>
              <Input value={kpiName} onChange={e => setKpiName(e.target.value)} placeholder="e.g. Sales Target" />
            </div>
            <div className="space-y-2">
              <Label>Period</Label>
              <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="e.g. May 2024" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
               <Label>Target Value</Label>
               <Input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
             </div>
             <div className="space-y-2">
               <Label>Unit</Label>
               <Input value={unit} onChange={e => setUnit(e.target.value)} />
             </div>
          </div>
          <div className="space-y-2">
            <Label>Employee IDs (comma separated)</Label>
            <Textarea value={employees} onChange={e => setEmployees(e.target.value)} placeholder="EMP-001, EMP-002" />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Create KPIs'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function KpiTrackingClient({ initialData }: { initialData: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startTransition] = useTransition();
  const [periodFilter, setPeriodFilter] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

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

  // Initial load relies on server data, but refresh can re-fetch
  // useEffect removed for initial fetch

  const periods = React.useMemo(() => {
    return Array.from(new Set(rows.map((r) => r.period).filter(Boolean))).sort();
  }, [rows]);

  const filteredRows = React.useMemo(() => {
    let result = rows;
    if (periodFilter !== 'all') {
      result = result.filter((r) => r.period === periodFilter);
    }
    if (dateRange?.from) {
      const fromTime = dateRange.from.getTime();
      const toTime = dateRange.to ? dateRange.to.getTime() : fromTime;
      result = result.filter((r) => {
        if (!r.createdAt) return true;
        const d = new Date(r.createdAt).getTime();
        return d >= fromTime && d <= toTime + 86400000;
      });
    }
    return result;
  }, [rows, periodFilter, dateRange]);

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

  const extraFilters = (
    <div className="flex items-center gap-2">
      {periods.length > 0 && (
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
      )}
      <DateRangePicker
        value={dateRange}
        onChange={setDateRange}
        className="h-8 w-[220px] text-xs"
      />
      <QuickAddModal onRefresh={refresh} />
    </div>
  );

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
                <span className="text-[var(--st-text-secondary)]">—</span>
              ),
          },
          {
            key: 'period',
            label: 'Period',
            render: (r) =>
              r.period ? <HrChip>{r.period}</HrChip> : <span className="text-[var(--st-text-secondary)]">—</span>,
          },
          {
            key: 'target',
            label: 'Target',
            render: (r) => (
              <span className="tabular-nums">
                {r.target_value}
                <span className="ml-0.5 text-[11px] text-[var(--st-text-secondary)]">{r.unit}</span>
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

'use client';

import { Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  CalendarHeart,
  PartyPopper,
  Plus,
  Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * Holidays — list page (rebuilt per §1D.1, thin upgrade).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards) — Total this year · By-type breakdown ·
 *       This quarter · Recurring count.
 *     • Filter row (type, year, recurring, location, date range).
 *     • Bulk action bar (delete · export CSV).
 *     • <HolidaysTable> — 8 columns (select · Date · Name · Type ·
 *       Recurring · Locations · Notes · Actions).
 *
 * Data source: legacy `crm-hr.actions` (Mongo-backed `crm_holidays`
 * collection). Per the rebuild plan §1D, this is the thin upgrade —
 * new/detail/edit pages already exist under `/holidays/new/`,
 * `/holidays/[id]/`, `/holidays/[id]/edit/` and use the canonical
 * `crm/holidays.actions` Rust BFF.
 */

import * as React from 'react';
import Link from 'next/link';

import { useT } from '@/lib/i18n/client';

import {
  deleteCrmHoliday,
  getCrmHolidays,
  saveCrmHoliday,
} from '@/app/actions/crm-hr.actions';

import {
  HolidaysKpiStrip,
  type HolidaysKpiKey,
  type HolidaysKpiSnapshot,
} from './_components/holidays-kpi-strip';
import {
  HolidaysFiltersRow,
  type HolidayTypeFilter,
  type RecurringFilter,
} from './_components/holidays-filters';
import {
  HolidaysTable,
  locationsText,
  type HolidayRow,
} from './_components/holidays-table';

const NATIONAL_HOLIDAYS_IN = [
  { name: 'Republic Day', date: '2026-01-26', type: 'national', recurring: true },
  { name: 'Independence Day', date: '2026-08-15', type: 'national', recurring: true },
  { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'national', recurring: true },
  { name: 'Christmas Day', date: '2026-12-25', type: 'national', recurring: true },
  { name: "New Year's Day", date: '2026-01-01', type: 'national', recurring: true },
  { name: 'Holi', date: '2026-03-04', type: 'national', recurring: false },
  { name: 'Eid ul-Fitr', date: '2026-03-21', type: 'national', recurring: false },
  { name: 'Diwali', date: '2026-10-19', type: 'national', recurring: false },
  { name: 'Dussehra', date: '2026-10-08', type: 'national', recurring: false },
  { name: 'Good Friday', date: '2026-04-03', type: 'national', recurring: false },
  { name: 'Ambedkar Jayanti', date: '2026-04-14', type: 'national', recurring: true },
  { name: 'Maha Shivratri', date: '2026-02-19', type: 'national', recurring: false },
  { name: 'Guru Nanak Jayanti', date: '2026-11-14', type: 'national', recurring: false },
];

function csvCell(v: unknown): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: HolidayRow[]): string {
  const head = ['date', 'name', 'type', 'recurring', 'locations', 'notes'];
  const body = rows.map((r) =>
    [
      csvCell(
        r.date instanceof Date ? r.date.toISOString().slice(0, 10) : r.date,
      ),
      csvCell(r.name),
      csvCell(r.type ?? 'national'),
      csvCell(r.recurring ? 'yes' : 'no'),
      csvCell(locationsText(r)),
      csvCell(r.notes ?? ''),
    ].join(','),
  );
  return [head.join(','), ...body].join('\n');
}

function quarterOf(d: Date): number {
  return Math.floor(d.getMonth() / 3);
}

export default function HolidaysPage(): React.JSX.Element {
  const { toast } = useToast();
  const { t } = useT();

  /* Data */
  const [holidays, setHolidays] = React.useState<HolidayRow[]>([]);
  const [isPending, startTransition] = React.useTransition();
  const [bulkBusy, startBulk] = React.useTransition();

  /* Filters */
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState<HolidayTypeFilter>('all');
  const [yearFilter, setYearFilter] = React.useState<string>('all');
  const [recurringFilter, setRecurringFilter] =
    React.useState<RecurringFilter>('all');
  const [locationFilter, setLocationFilter] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  /* Selection */
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  /* Confirm */
  const [deletePending, setDeletePending] = React.useState(false);
  const [singleDeleteId, setSingleDeleteId] = React.useState<string | null>(
    null,
  );

  const fetchAll = React.useCallback(() => {
    startTransition(async () => {
      const rows = await getCrmHolidays();
      setHolidays(rows as HolidayRow[]);
    });
  }, []);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* Year options */
  const yearOptions = React.useMemo(() => {
    const years = new Set<number>();
    for (const h of holidays) {
      const d = new Date(h.date as unknown as string | Date);
      if (!Number.isNaN(d.getTime())) years.add(d.getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [holidays]);

  /* KPI snapshot */
  const kpi: HolidaysKpiSnapshot = React.useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentQuarter = quarterOf(today);
    let totalThisYear = 0;
    let national = 0;
    let regional = 0;
    let religious = 0;
    let optional = 0;
    let restricted = 0;
    let thisQuarter = 0;
    let recurringCount = 0;
    for (const h of holidays) {
      const d = new Date(h.date as unknown as string | Date);
      if (!Number.isNaN(d.getTime()) && d.getFullYear() === currentYear) {
        totalThisYear++;
        if (
          quarterOf(d) === currentQuarter &&
          d.getFullYear() === currentYear
        ) {
          thisQuarter++;
        }
      }
      const t = (h.type ?? 'national').toLowerCase();
      if (t === 'national') national++;
      else if (t === 'regional') regional++;
      else if (t === 'religious') religious++;
      else if (t === 'optional') optional++;
      else if (t === 'restricted') restricted++;
      if (h.recurring) recurringCount++;
    }
    return {
      totalThisYear,
      byTypeNational: national,
      byTypeRegional: regional,
      byTypeReligious: religious,
      byTypeOptional: optional,
      byTypeRestricted: restricted,
      thisQuarter,
      recurringCount,
    };
  }, [holidays]);

  /* Filtering */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const yr = yearFilter === 'all' ? null : Number(yearFilter);
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    return holidays.filter((h) => {
      if (q) {
        const hay = `${h.name} ${locationsText(h)} ${h.notes ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (typeFilter !== 'all') {
        const t = (h.type ?? 'national').toLowerCase();
        if (t !== typeFilter) return false;
      }
      const d = new Date(h.date as unknown as string | Date);
      if (yr !== null) {
        if (Number.isNaN(d.getTime()) || d.getFullYear() !== yr) return false;
      }
      if (recurringFilter === 'yes' && !h.recurring) return false;
      if (recurringFilter === 'no' && h.recurring) return false;
      if (locationFilter) {
        const locs = locationsText(h).toLowerCase();
        if (!locs.includes(locationFilter.toLowerCase())) return false;
      }
      if (fromTs && !Number.isNaN(d.getTime()) && d.getTime() < fromTs)
        return false;
      if (toTs && !Number.isNaN(d.getTime()) && d.getTime() > toTs)
        return false;
      return true;
    });
  }, [
    holidays,
    search,
    typeFilter,
    yearFilter,
    recurringFilter,
    locationFilter,
    fromDate,
    toDate,
  ]);

  /* KPI clicks */
  const onKpiSelect = React.useCallback((key: HolidaysKpiKey) => {
    const now = new Date();
    if (key === 'all-year') {
      setYearFilter(String(now.getFullYear()));
      setTypeFilter('all');
      setRecurringFilter('all');
      setFromDate('');
      setToDate('');
    } else if (key === 'breakdown') {
      setYearFilter(String(now.getFullYear()));
      setTypeFilter('national');
    } else if (key === 'this-quarter') {
      const q = quarterOf(now);
      const first = new Date(now.getFullYear(), q * 3, 1);
      const last = new Date(now.getFullYear(), q * 3 + 3, 0);
      setFromDate(first.toISOString().slice(0, 10));
      setToDate(last.toISOString().slice(0, 10));
      setYearFilter('all');
    } else if (key === 'recurring') {
      setRecurringFilter('yes');
      setYearFilter('all');
    }
  }, []);

  /* Clear */
  const clearFilters = React.useCallback(() => {
    setSearch('');
    setTypeFilter('all');
    setYearFilter('all');
    setRecurringFilter('all');
    setLocationFilter('');
    setFromDate('');
    setToDate('');
  }, []);

  const hasActiveFilters =
    !!search ||
    typeFilter !== 'all' ||
    yearFilter !== 'all' ||
    recurringFilter !== 'all' ||
    !!locationFilter ||
    !!fromDate ||
    !!toDate;

  /* Selection */
  const toggleOne = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const toggleAll = React.useCallback(
    (all: boolean) => {
      setSelected(
        all ? new Set(filtered.map((h) => h._id.toString())) : new Set(),
      );
    },
    [filtered],
  );

  /* Bulk delete */
  const runBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selected);
    let processed = 0;
    for (const id of ids) {
      const res = await deleteCrmHoliday(id);
      if (res.success) processed++;
    }
    toast({
      title: t('hrm.payroll.holidays.toast.deleted'),
      description: t('hrm.payroll.holidays.toast.deletedDescription', {
        processed,
        total: ids.length,
      }),
    });
    setSelected(new Set());
    fetchAll();
  }, [selected, toast, fetchAll, t]);

  const runSingleDelete = React.useCallback(
    async (id: string) => {
      const res = await deleteCrmHoliday(id);
      if (res.success) {
        toast({ title: t('hrm.payroll.holidays.toast.singleDeleted') });
        fetchAll();
      } else {
        toast({
          title: t('hrm.payroll.holidays.toast.deleteFailed'),
          description: res.error,
          variant: 'destructive',
        });
      }
    },
    [toast, fetchAll, t],
  );

  /* Add public holidays */
  const addPublicHolidays = () => {
    startBulk(async () => {
      let added = 0;
      for (const h of NATIONAL_HOLIDAYS_IN) {
        const fd = new FormData();
        fd.set('name', h.name);
        fd.set('date', new Date(h.date).toISOString());
        fd.set('type', h.type);
        fd.set('recurring', String(h.recurring));
        const res = await saveCrmHoliday(null, fd);
        if (res.message) added++;
      }
      toast({
        title: t('hrm.payroll.holidays.toast.publicAdded'),
        description: t('hrm.payroll.holidays.toast.publicAddedDescription', { count: added }),
      });
      fetchAll();
    });
  };

  /* Export */
  const exportCsv = React.useCallback(() => {
    const out =
      selected.size > 0
        ? filtered.filter((h) => selected.has(h._id.toString()))
        : filtered;
    if (out.length === 0) {
      toast({
        title: t('hrm.payroll.holidays.toast.nothingToExport'),
        description: t('hrm.payroll.holidays.toast.nothingToExportDescription'),
      });
      return;
    }
    const blob = new Blob([toCsv(out)], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `holidays-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: t('hrm.payroll.holidays.toast.exported'),
      description: t('hrm.payroll.holidays.toast.exportedDescription', { count: out.length }),
    });
  }, [filtered, selected, toast, t]);

  return (
    <>
      <EntityListShell
        title={t('hrm.payroll.holidays.title')}
        subtitle={t('hrm.payroll.holidays.subtitle')}
        search={{
          value: search,
          onChange: setSearch,
          placeholder: t('hrm.payroll.holidays.search.placeholder'),
        }}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={addPublicHolidays}
              disabled={bulkBusy}
            >
              <PartyPopper className="h-3.5 w-3.5" />
              {bulkBusy ? t('hrm.payroll.holidays.action.addingPublic') : t('hrm.payroll.holidays.action.addPublic')}
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/hrm/payroll/holidays/new">
                <Plus className="h-3.5 w-3.5" /> {t('hrm.payroll.holidays.action.new')}
              </Link>
            </Button>
          </div>
        }
        filters={
          <HolidaysFiltersRow
            typeFilter={typeFilter}
            onTypeChange={setTypeFilter}
            yearFilter={yearFilter}
            onYearChange={setYearFilter}
            yearOptions={yearOptions}
            recurringFilter={recurringFilter}
            onRecurringChange={setRecurringFilter}
            locationFilter={locationFilter}
            onLocationChange={setLocationFilter}
            fromDate={fromDate}
            onFromDate={setFromDate}
            toDate={toDate}
            onToDate={setToDate}
            hasActiveFilters={hasActiveFilters}
            onClear={clearFilters}
          />
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-[var(--st-text)]">
                {selected.size === 1
                  ? t('hrm.payroll.holidays.selection.one', { count: selected.size })
                  : t('hrm.payroll.holidays.selection.many', { count: selected.size })}
              </span>
              <span className="mx-1 h-4 w-px bg-[var(--st-border)]" aria-hidden />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeletePending(true)}
              >
                <Trash2 className="h-3.5 w-3.5 text-[var(--st-text)]" /> {t('hrm.payroll.holidays.bulk.delete')}
              </Button>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                {t('hrm.payroll.holidays.bulk.export')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(new Set())}
                className="ml-auto"
              >
                {t('hrm.payroll.holidays.bulk.clear')}
              </Button>
            </div>
          ) : null
        }
        loading={isPending && holidays.length === 0}
        empty={
          !isPending && holidays.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <CalendarHeart className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">
                {t('hrm.payroll.holidays.empty.title')}
              </h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                {t('hrm.payroll.holidays.empty.subtitle')}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={addPublicHolidays}>
                  <PartyPopper className="h-4 w-4" /> {t('hrm.payroll.holidays.action.addPublic')}
                </Button>
                <Button asChild>
                  <Link href="/dashboard/hrm/payroll/holidays/new">
                    <Plus className="h-4 w-4" /> {t('hrm.payroll.holidays.empty.actionAdd')}
                  </Link>
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          <HolidaysKpiStrip kpi={kpi} active={null} onSelect={onKpiSelect} />

          <HolidaysTable
            rows={filtered}
            selected={selected}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
            onDelete={setSingleDeleteId}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={deletePending}
        onOpenChange={setDeletePending}
        title={
          selected.size === 1
            ? t('hrm.payroll.holidays.delete.bulkTitleOne', { count: selected.size })
            : t('hrm.payroll.holidays.delete.bulkTitleMany', { count: selected.size })
        }
        description={t('hrm.payroll.holidays.delete.bulkDescription')}
        confirmLabel={t('hrm.payroll.holidays.delete.confirm')}
        requireTyped="DELETE"
        onConfirm={async () => {
          await runBulkDelete();
          setDeletePending(false);
        }}
      />

      <ConfirmDialog
        open={!!singleDeleteId}
        onOpenChange={(o) => !o && setSingleDeleteId(null)}
        title={t('hrm.payroll.holidays.delete.singleTitle')}
        description={t('hrm.payroll.holidays.delete.singleDescription')}
        requireTyped="DELETE"
        confirmLabel={t('hrm.payroll.holidays.delete.confirm')}
        onConfirm={async () => {
          if (singleDeleteId) await runSingleDelete(singleDeleteId);
          setSingleDeleteId(null);
        }}
      />
    </>
  );
}

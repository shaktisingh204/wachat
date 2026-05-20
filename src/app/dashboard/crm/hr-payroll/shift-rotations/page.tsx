'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  useZoruToast,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Edit,
  Layers,
  Play,
  Plus,
  Trash2,
  Users,
  X,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  deleteShiftRotation,
  getAutomateShifts,
  getShiftRotations,
  saveShiftRotation,
} from '@/app/actions/worksuite/shifts.actions';
import { getSession } from '@/app/actions/user.actions';
import type {
  WsAutomateShift,
  WsShiftRotation,
} from '@/lib/worksuite/shifts-types';

const PAGE_SIZE = 10;

type StatusFilter = 'all' | 'active' | 'inactive';

export default function ShiftRotationsPage() {
  const { toast } = useZoruToast();
  const [rotations, setRotations] = useState<WsShiftRotation[]>([]);
  const [automateShifts, setAutomateShifts] = useState<WsAutomateShift[]>([]);
  const [pending, startTransition] = useTransition();
  const [authed, setAuthed] = useState(false);

  // create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // filters + pagination + selection
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSession().then((s) => {
      if (cancelled) return;
      setAuthed(!!s?.user);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(() => {
    startTransition(async () => {
      const [rows, auto] = await Promise.all([
        getShiftRotations(),
        getAutomateShifts().catch(() => [] as WsAutomateShift[]),
      ]);
      setRotations(rows);
      setAutomateShifts(auto);
    });
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  // KPIs
  const kpis = useMemo(() => {
    const total = rotations.length;
    const active = rotations.filter((r) => r.is_active).length;
    const employeesCovered = new Set<string>();
    let upcomingChanges = 0;
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    for (const a of automateShifts) {
      for (const u of a.user_ids ?? []) employeesCovered.add(String(u));
      const start = a.start_date ? new Date(a.start_date).getTime() : 0;
      if (start >= now && start <= week) upcomingChanges += 1;
    }
    return {
      total,
      active,
      employees: employeesCovered.size,
      upcoming: upcomingChanges,
    };
  }, [rotations, automateShifts]);

  // filter
  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rotations.filter((r) => {
      if (statusFilter === 'active' && !r.is_active) return false;
      if (statusFilter === 'inactive' && r.is_active) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [rotations, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAll.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paged = useMemo(
    () => filteredAll.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredAll, page],
  );

  const hasActiveFilters = !!search || statusFilter !== 'all';
  const clearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  }, []);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    startTransition(async () => {
      await saveShiftRotation({ name, description, is_active: true });
      setName('');
      setDescription('');
      toast({ title: 'Rotation created' });
      load();
    });
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetId) return;
    const res = await deleteShiftRotation(deleteTargetId);
    if (res?.success === false) {
      toast({
        title: 'Delete failed',
        description: res.error,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Rotation deleted' });
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deleteTargetId);
        return next;
      });
      load();
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, load, toast]);

  const runBulkDelete = useCallback(async () => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    let ok = 0;
    for (const id of ids) {
      const res = await deleteShiftRotation(id);
      if (res?.success !== false) ok += 1;
    }
    toast({ title: `${ok} rotation${ok === 1 ? '' : 's'} deleted` });
    setSelected(new Set());
    setBulkDeleteOpen(false);
    load();
  }, [selected, load, toast]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (all: boolean) => {
      setSelected(
        all
          ? new Set(paged.map((r) => String(r._id)).filter(Boolean) as string[])
          : new Set(),
      );
    },
    [paged],
  );

  const allSelected = paged.length > 0 && paged.every((r) => selected.has(String(r._id)));

  const exportCsv = useCallback(
    (kind: 'csv' | 'xlsx') => {
      const ids = selected.size > 0 ? selected : null;
      const rows = ids
        ? filteredAll.filter((r) => ids.has(String(r._id)))
        : filteredAll;
      const header = ['Name', 'Description', 'Status', 'CreatedAt'];
      const escape = (v: unknown) =>
        `"${String(v ?? '').replace(/"/g, '""')}"`;
      const csv = [
        header.join(','),
        ...rows.map((r) =>
          [
            escape(r.name),
            escape(r.description ?? ''),
            escape(r.is_active ? 'active' : 'inactive'),
            escape(r.createdAt ? new Date(r.createdAt).toISOString() : ''),
          ].join(','),
        ),
      ].join('\n');
      const mime =
        kind === 'xlsx'
          ? 'application/vnd.ms-excel;charset=utf-8;'
          : 'text/csv;charset=utf-8;';
      const ext = kind === 'xlsx' ? 'xls' : 'csv';
      const blob = new Blob([csv], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shift-rotations-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [filteredAll, selected],
  );

  return (
    <>
      <EntityListShell
        title="Shift Rotations"
        subtitle="Define cyclical shift sequences to automate assignment."
        search={{
          value: search,
          onChange: (v) => {
            setSearch(v);
            setPage(1);
          },
          placeholder: 'Search rotations…',
        }}
        primaryAction={
          <Link href="/dashboard/crm/hr-payroll/shift-rotations/automate">
            <ZoruButton>
              <Play className="h-4 w-4" strokeWidth={1.75} />
              Automate Shift
            </ZoruButton>
          </Link>
        }
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-36 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => exportCsv('csv')}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </ZoruButton>
            <ZoruButton
              variant="outline"
              size="sm"
              onClick={() => exportCsv('xlsx')}
            >
              <Download className="h-3.5 w-3.5" />
              Export XLSX
            </ZoruButton>
            {hasActiveFilters && (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" />
                Clear
              </ZoruButton>
            )}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zoru-line bg-zoru-surface-2 px-4 py-2.5">
              <div className="text-[13px] text-zoru-ink">
                {selected.size} selected
              </div>
              <div className="flex items-center gap-2">
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => exportCsv('csv')}
                >
                  <Download className="h-3.5 w-3.5" />
                  Export selected
                </ZoruButton>
                <ZoruButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={pending && rotations.length === 0}
        pagination={
          filteredAll.length > 0 ? (
            <PaginationBar
              page={page}
              limit={PAGE_SIZE}
              hasMore={page < totalPages}
              total={filteredAll.length}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <ZoruStatCard
            label="Total Rotations"
            value={kpis.total}
            period="defined templates"
            icon={<Layers />}
          />
          <ZoruStatCard
            label="Active"
            value={kpis.active}
            period={`of ${kpis.total}`}
            icon={<CheckCircle2 />}
          />
          <ZoruStatCard
            label="Employees Covered"
            value={kpis.employees}
            period="across automations"
            icon={<Users />}
          />
          <ZoruStatCard
            label="Upcoming Changes"
            value={kpis.upcoming}
            period="next 7 days"
            icon={<CalendarClock />}
          />
        </div>

        <ZoruCard className="p-6">
          <h2 className="mb-3 text-[16px] text-zoru-ink">Create Rotation</h2>
          <form
            onSubmit={handleCreate}
            className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto]"
          >
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Name
              </ZoruLabel>
              <ZoruInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="2-2-3 rotation"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                Description
              </ZoruLabel>
              <ZoruInput
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex items-end">
              <ZoruButton type="submit" disabled={pending}>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Add
              </ZoruButton>
            </div>
          </form>
        </ZoruCard>

        <ZoruCard className="p-6">
          <h2 className="mb-3 text-[16px] text-zoru-ink">All Rotations</h2>
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="w-10 px-3 py-2.5 text-left">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="h-4 w-4 accent-zoru-accent"
                    />
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">
                    Name
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-zoru-ink-muted">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-zoru-ink-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pending && rotations.length === 0 ? (
                  <tr className="border-b border-zoru-line">
                    <td
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : paged.length > 0 ? (
                  paged.map((r) => {
                    const id = String(r._id);
                    const checked = selected.has(id);
                    return (
                      <tr
                        key={id}
                        className="border-b border-zoru-line last:border-0 hover:bg-zoru-surface-2/50"
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            aria-label={`Select ${r.name}`}
                            checked={checked}
                            onChange={() => toggleOne(id)}
                            className="h-4 w-4 accent-zoru-accent"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <EntityRowLink
                            href={`/dashboard/crm/hr-payroll/shift-rotations/${id}`}
                            label={r.name}
                          />
                        </td>
                        <td className="px-4 py-2.5 text-[13px] text-zoru-ink-muted">
                          {r.description || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <ZoruBadge
                            variant={r.is_active ? 'success' : 'secondary'}
                          >
                            {r.is_active ? 'active' : 'inactive'}
                          </ZoruBadge>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/dashboard/crm/hr-payroll/shift-rotations/${id}`}
                            >
                              <ZoruButton
                                variant="outline"
                                size="icon"
                                aria-label="Edit rotation"
                              >
                                <Edit className="h-4 w-4" />
                              </ZoruButton>
                            </Link>
                            <ZoruButton
                              variant="outline"
                              size="icon"
                              aria-label="Delete rotation"
                              onClick={() => setDeleteTargetId(id)}
                            >
                              <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                            </ZoruButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="border-b border-zoru-line">
                    <td
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      {hasActiveFilters
                        ? 'No rotations match the current filters.'
                        : 'No rotations yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ZoruCard>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this rotation?"
        description="This permanently removes the rotation and its sequence. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(o) => setBulkDeleteOpen(o)}
        title={`Delete ${selected.size} rotation${selected.size === 1 ? '' : 's'}?`}
        description="The selected rotations and their sequences will be permanently removed."
        confirmLabel="Delete all"
        requireTyped="DELETE"
        onConfirm={runBulkDelete}
      />
    </>
  );
}

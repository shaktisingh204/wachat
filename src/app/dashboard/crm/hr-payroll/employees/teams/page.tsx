'use client';

/**
 * Employee Teams — deepened list per Deep template (ref
 * src/app/dashboard/crm/sales-crm/all-leads/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (4 cards: total teams, total members, lead count, avg team size)
 *     • Filter row (search + status select + department)
 *     • Bulk action bar (bulk delete + bulk export)
 *     • CSV / XLSX export (all or selection)
 *     • Pagination
 *     • EntityRowLink on primary cell
 *     • ConfirmDialog for single + bulk delete
 *
 * Multi-tenant via getSession() inside the underlying server actions.
 */

import * as React from 'react';
import {
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  Users,
  UserCog,
  UsersRound,
  Layers,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  getEmployeeTeams,
  saveEmployeeTeam,
  deleteEmployeeTeam,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeTeam } from '@/lib/worksuite/hr-ext-types';

type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  departmentName?: string;
};

type TeamRow = WsEmployeeTeam & { _id: string };

type StatusFilter = 'all' | 'active' | 'inactive' | 'with-leader' | 'no-leader';

const EMPTY: Partial<TeamRow> = { team_name: '', leader_user_id: '' };
const ROWS_PER_PAGE = 20;

export default function EmployeeTeamsPage() {
  const { toast } = useZoruToast();
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);
  const [isLoading, startLoad] = React.useTransition();
  const [isSaving, startSave] = React.useTransition();

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Partial<TeamRow>>(EMPTY);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const load = React.useCallback(() => {
    startLoad(async () => {
      const [rows, emps] = await Promise.all([getEmployeeTeams(), getCrmEmployees()]);
      setTeams(rows as TeamRow[]);
      setEmployees(
        (emps as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
          departmentName: e.departmentName,
        })),
      );
      setSelected(new Set());
    });
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const employeeMap = React.useMemo(() => {
    const m = new Map<string, EmployeeLite>();
    for (const e of employees) m.set(e._id, e);
    return m;
  }, [employees]);

  const empName = React.useCallback(
    (id?: string) => {
      if (!id) return '';
      const e = employeeMap.get(id);
      if (!e) return id;
      return [e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed';
    },
    [employeeMap],
  );

  const teamDepartment = React.useCallback(
    (t: TeamRow): string => {
      const leader = t.leader_user_id ? employeeMap.get(t.leader_user_id) : undefined;
      return leader?.departmentName ?? '';
    },
    [employeeMap],
  );

  const debouncedSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const t of teams) {
      const d = teamDepartment(t);
      if (d) set.add(d);
    }
    return Array.from(set).sort();
  }, [teams, teamDepartment]);

  const filteredTeams = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      if (q) {
        const haystack = [t.team_name, empName(t.leader_user_id), teamDepartment(t)]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (departmentFilter !== 'all' && teamDepartment(t) !== departmentFilter) return false;
      switch (statusFilter) {
        case 'active':
          if (t.is_active === false) return false;
          break;
        case 'inactive':
          if (t.is_active !== false) return false;
          break;
        case 'with-leader':
          if (!t.leader_user_id) return false;
          break;
        case 'no-leader':
          if (t.leader_user_id) return false;
          break;
      }
      return true;
    });
  }, [teams, search, statusFilter, departmentFilter, empName, teamDepartment]);

  const total = filteredTeams.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filteredTeams.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredTeams, page],
  );

  // KPIs over the filtered set.
  const kpis = React.useMemo(() => {
    const totalTeams = filteredTeams.length;
    const totalMembers = filteredTeams.reduce(
      (s, t) => s + ((t.member_ids?.length ?? 0) || 0),
      0,
    );
    const leadCount = filteredTeams.filter((t) => !!t.leader_user_id).length;
    const avgSize =
      totalTeams > 0 ? Math.round((totalMembers / totalTeams) * 10) / 10 : 0;
    return { totalTeams, totalMembers, leadCount, avgSize };
  }, [filteredTeams]);

  // ── Form helpers ────────────────────────────────────────────────────
  const openAdd = React.useCallback(() => {
    setForm(EMPTY);
    setOpen(true);
  }, []);

  const openEdit = React.useCallback((t: TeamRow) => {
    setForm({ ...t });
    setOpen(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!form.team_name?.trim()) {
      toast({ title: 'Team name is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('team_name', form.team_name ?? '');
      fd.append('leader_user_id', form.leader_user_id ?? '');
      const res = await saveEmployeeTeam(null, fd);
      if (res?.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: form._id ? 'Updated' : 'Created' });
      setOpen(false);
      load();
    });
  }, [form, load, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const res = await deleteEmployeeTeam(id);
      if ((res as any)?.error) {
        toast({
          title: 'Delete failed',
          description: (res as any).error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Team deleted' });
      load();
    },
    [load, toast],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    await handleDelete(deleteTargetId);
    setDeleteTargetId(null);
  }, [deleteTargetId, handleDelete]);

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const res = await deleteEmployeeTeam(id);
      if (!(res as any)?.error) ok += 1;
    }
    toast({ title: `${ok} team${ok === 1 ? '' : 's'} deleted` });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }, [selected, load, toast]);

  // ── Selection ───────────────────────────────────────────────────────
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
      setSelected(all ? new Set(pageRows.map((r) => r._id)) : new Set());
    },
    [pageRows],
  );

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  // ── Export ──────────────────────────────────────────────────────────
  const exportRows = React.useCallback(
    (format: 'csv' | 'xlsx') => {
      const source =
        selected.size > 0 ? filteredTeams.filter((t) => selected.has(t._id)) : filteredTeams;
      const header = ['Team', 'Leader', 'Department', 'Members', 'Status'];
      const sep = format === 'xlsx' ? '\t' : ',';
      const escape = (v: unknown) => {
        const s = String(v ?? '');
        if (format === 'xlsx') return s.replace(/\t|\r|\n/g, ' ');
        return `"${s.replace(/"/g, '""')}"`;
      };
      const lines = [
        header.join(sep),
        ...source.map((t) =>
          [
            t.team_name,
            empName(t.leader_user_id) || '—',
            teamDepartment(t) || '—',
            t.member_ids?.length ?? 0,
            t.is_active === false ? 'Inactive' : 'Active',
          ]
            .map(escape)
            .join(sep),
        ),
      ];
      const mime =
        format === 'xlsx'
          ? 'application/vnd.ms-excel;charset=utf-8;'
          : 'text/csv;charset=utf-8;';
      const blob = new Blob([lines.join('\n')], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employee-teams-${new Date().toISOString().slice(0, 10)}.${format === 'xlsx' ? 'xls' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [filteredTeams, selected, empName, teamDepartment],
  );

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setStatusFilter('all');
    setDepartmentFilter('all');
    setPage(1);
  }, []);

  const hasActiveFilters =
    !!search || statusFilter !== 'all' || departmentFilter !== 'all';

  return (
    <>
      <EntityListShell
        title="Employee Teams"
        subtitle="Define employee teams with designated leaders."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search team or leader…',
        }}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={() => exportRows('csv')}>
              <Download className="h-4 w-4" /> CSV
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={() => exportRows('xlsx')}>
              <Download className="h-4 w-4" /> XLSX
            </ZoruButton>
            <ZoruButton onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Team
            </ZoruButton>
          </div>
        }
        filters={
          <>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v as StatusFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-44 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                <ZoruSelectItem value="with-leader">With leader</ZoruSelectItem>
                <ZoruSelectItem value="no-leader">No leader</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={departmentFilter}
              onValueChange={(v) => {
                setDepartmentFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-48 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Department" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All departments</ZoruSelectItem>
                {departments.map((d) => (
                  <ZoruSelectItem key={d} value={d}>
                    {d}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            {hasActiveFilters ? (
              <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </ZoruButton>
            ) : null}
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[13px] text-zoru-ink">
                {selected.size} team{selected.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton variant="outline" size="sm" onClick={() => exportRows('csv')}>
                  <Download className="h-4 w-4" /> Export CSV
                </ZoruButton>
                <ZoruButton variant="outline" size="sm" onClick={() => exportRows('xlsx')}>
                  <Download className="h-4 w-4" /> Export XLSX
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="text-zoru-danger-ink"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </ZoruButton>
                <ZoruButton variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  Clear selection
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        pagination={
          total > 0 ? (
            <PaginationBar
              page={page}
              limit={ROWS_PER_PAGE}
              hasMore={page < totalPages}
              total={total}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
        loading={isLoading && teams.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<UsersRound className="h-4 w-4" />}
              label="Total teams"
              value={kpis.totalTeams.toLocaleString('en-IN')}
              hint="Visible after filters"
            />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Total members"
              value={kpis.totalMembers.toLocaleString('en-IN')}
              hint="Sum of members across teams"
            />
            <KpiCard
              icon={<UserCog className="h-4 w-4" />}
              label="Leaders assigned"
              value={kpis.leadCount.toLocaleString('en-IN')}
              hint={`${Math.max(0, kpis.totalTeams - kpis.leadCount)} teams without a leader`}
            />
            <KpiCard
              icon={<Layers className="h-4 w-4" />}
              label="Avg team size"
              value={kpis.avgSize.toLocaleString('en-IN')}
              hint="Members per team"
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Teams</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                Organisational teams with designated leaders.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-2.5">
                      <ZoruCheckbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Team
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Leader
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Department
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Members
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-10 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasActiveFilters
                          ? 'No teams match the current filters.'
                          : 'No teams yet.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((t) => {
                      const isSelected = selected.has(t._id);
                      const leaderName = empName(t.leader_user_id);
                      const teamHref = t.leader_user_id
                        ? `/dashboard/crm/hr-payroll/employees/${t.leader_user_id}`
                        : '';
                      return (
                        <tr
                          key={t._id}
                          className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-2.5">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(t._id)}
                              aria-label={`Select ${t.team_name}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            {teamHref ? (
                              <EntityRowLink
                                href={teamHref}
                                label={t.team_name}
                                subtitle={
                                  t.is_active === false ? 'Inactive' : leaderName || '—'
                                }
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEdit(t)}
                                className="inline-flex flex-col items-start text-left font-medium text-zoru-ink transition-colors hover:text-primary hover:underline"
                              >
                                <span>{t.team_name}</span>
                                <span className="text-[12px] text-zoru-ink-muted">
                                  {t.is_active === false ? 'Inactive' : 'No leader'}
                                </span>
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {leaderName || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {teamDepartment(t) || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-zoru-ink">
                            {(t.member_ids?.length ?? 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(t)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </ZoruButton>
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTargetId(t._id)}
                                disabled={isSaving}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                              </ZoruButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </ZoruCard>
        </div>

        <ZoruDialog open={open} onOpenChange={setOpen}>
          <ZoruDialogContent className="sm:max-w-[440px]">
            <ZoruDialogHeader>
              <ZoruDialogTitle>{form._id ? 'Edit Team' : 'Add Team'}</ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Team Name <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  value={form.team_name ?? ''}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, team_name: e.target.value }))
                  }
                  placeholder="e.g. Engineering Squad"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Team Leader</ZoruLabel>
                <ZoruSelect
                  value={form.leader_user_id || undefined}
                  onValueChange={(v) => setForm((p) => ({ ...p, leader_user_id: v }))}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue placeholder="Select employee" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {employees.map((e) => (
                      <ZoruSelectItem key={e._id} value={e._id}>
                        {[e.firstName, e.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            </div>
            <ZoruDialogFooter>
              <ZoruButton variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {form._id ? 'Save' : 'Create'}
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this team?"
        description="This permanently removes the team. Members are not deleted."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} team${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected teams. Members are not deleted."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <ZoruCard className="p-5">
      <div className="flex items-center gap-2 text-zoru-ink-muted">
        {icon}
        <p className="text-[12.5px] font-medium">{label}</p>
      </div>
      <div className="mt-2 text-2xl text-zoru-ink">{value}</div>
      {hint ? <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p> : null}
    </ZoruCard>
  );
}

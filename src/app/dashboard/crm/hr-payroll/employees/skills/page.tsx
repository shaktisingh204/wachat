'use client';

/**
 * Skills (master) — deepened list per Deep template (ref
 * src/app/dashboard/crm/hr-payroll/employees/teams/page.tsx).
 *
 * Composition:
 *   <EntityListShell>
 *     - KPI strip (total skills, employees per skill, top skill, needs renewal)
 *     - Filter row (search + department + status + date range)
 *     - Bulk action bar (bulk delete + bulk archive + bulk export)
 *     - CSV / XLSX export (all or selection) via src/lib/crm-list-export.ts
 *     - Pagination via <PaginationBar>
 *     - <EntityRowLink> on primary cell linking to the top-assignee detail
 *     - <ConfirmDialog> for single + bulk delete
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
  Archive,
  Award,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  deleteSkill,
  getEmployeeSkills,
  getSkills,
  saveSkill,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type {
  WsEmployeeSkill,
  WsSkill,
} from '@/lib/worksuite/hr-ext-types';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

type SkillRow = WsSkill & { _id: string };
type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentName?: string;
  status?: string;
};
type AssignmentRow = WsEmployeeSkill & { _id: string };
type StatusFilter = 'all' | 'assigned' | 'unassigned' | 'needs-renewal';
type FormState = { _id: string; name: string; category: string; description: string };

const EMPTY_FORM: FormState = { _id: '', name: '', category: '', description: '' };
const ROWS_PER_PAGE = 20;

function toDate(v: any): Date | null {
  if (!v) return null;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export default function SkillsMasterPage() {
  const { toast } = useZoruToast();

  const [skills, setSkills] = React.useState<SkillRow[]>([]);
  const [assignments, setAssignments] = React.useState<AssignmentRow[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);

  const [isLoading, startLoad] = React.useTransition();
  const [isSaving, startSave] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = React.useState<string>('');
  const [dateTo, setDateTo] = React.useState<string>('');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);

  const load = React.useCallback(() => {
    startLoad(async () => {
      const [rows, asg, emps] = await Promise.all([
        getSkills(),
        getEmployeeSkills(),
        getCrmEmployees(),
      ]);
      setSkills(rows as SkillRow[]);
      setAssignments(asg as AssignmentRow[]);
      setEmployees(
        (emps as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          departmentName: e.departmentName,
          status: e.status,
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

  // Per-skill employee count (deduped across assignments).
  const assigneeCounts = React.useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const a of assignments) {
      const sid = String(a.skill_id);
      const set = counts.get(sid) ?? new Set<string>();
      set.add(String(a.user_id));
      counts.set(sid, set);
    }
    return counts;
  }, [assignments]);

  // Per-skill departments (derived from assignees).
  const skillDepartments = React.useCallback(
    (skillId: string): Set<string> => {
      const set = new Set<string>();
      const assignees = assigneeCounts.get(skillId);
      if (!assignees) return set;
      for (const uid of assignees) {
        const dep = employeeMap.get(uid)?.departmentName;
        if (dep) set.add(dep);
      }
      return set;
    },
    [assigneeCounts, employeeMap],
  );

  // A skill "needs renewal" when its description / category contains "cert"
  // or "renew" — heuristic until a dedicated renewal date is added.
  const needsRenewal = React.useCallback((s: SkillRow): boolean => {
    const blob = `${s.category ?? ''} ${s.description ?? ''}`.toLowerCase();
    return blob.includes('cert') || blob.includes('renew') || blob.includes('expir');
  }, []);

  const debouncedSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      if (e.departmentName) set.add(e.departmentName);
    }
    return Array.from(set).sort();
  }, [employees]);

  const filteredSkills = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo).getTime() + 86_400_000 - 1 : null;
    return skills.filter((s) => {
      if (q) {
        const haystack = [s.name, s.category, s.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (departmentFilter !== 'all') {
        if (!skillDepartments(String(s._id)).has(departmentFilter)) return false;
      }
      const assigneeCount = assigneeCounts.get(String(s._id))?.size ?? 0;
      switch (statusFilter) {
        case 'assigned':
          if (assigneeCount === 0) return false;
          break;
        case 'unassigned':
          if (assigneeCount > 0) return false;
          break;
        case 'needs-renewal':
          if (!needsRenewal(s)) return false;
          break;
      }
      const created = toDate((s as any).createdAt);
      if (created) {
        if (fromTs && created.getTime() < fromTs) return false;
        if (toTs && created.getTime() > toTs) return false;
      } else if (fromTs || toTs) {
        return false;
      }
      return true;
    });
  }, [
    skills,
    search,
    departmentFilter,
    statusFilter,
    dateFrom,
    dateTo,
    assigneeCounts,
    skillDepartments,
    needsRenewal,
  ]);

  const total = filteredSkills.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filteredSkills.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filteredSkills, page],
  );

  // KPIs (over filtered set).
  const kpis = React.useMemo(() => {
    const totalSkills = filteredSkills.length;
    let totalAssignees = 0;
    let topSkill: { name: string; count: number } | null = null;
    let renewalCount = 0;
    for (const s of filteredSkills) {
      const count = assigneeCounts.get(String(s._id))?.size ?? 0;
      totalAssignees += count;
      if (!topSkill || count > topSkill.count) topSkill = { name: s.name, count };
      if (needsRenewal(s)) renewalCount += 1;
    }
    const avgPerSkill =
      totalSkills > 0 ? Math.round((totalAssignees / totalSkills) * 10) / 10 : 0;
    return {
      totalSkills,
      avgPerSkill,
      topSkill: topSkill && topSkill.count > 0 ? topSkill : null,
      renewalCount,
    };
  }, [filteredSkills, assigneeCounts, needsRenewal]);

  // ── Form helpers ───────────────────────────────────────────────────
  const openAdd = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((s: SkillRow) => {
    setForm({
      _id: String(s._id),
      name: s.name,
      category: s.category ?? '',
      description: s.description ?? '',
    });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!form.name.trim()) {
      toast({ title: 'Skill name is required', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('name', form.name.trim());
      if (form.category) fd.append('category', form.category);
      if (form.description) fd.append('description', form.description);
      const res = await saveSkill(null, fd);
      if (res?.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: form._id ? 'Updated' : 'Created' });
      setDialogOpen(false);
      load();
    });
  }, [form, load, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const res = await deleteSkill(id);
      if ((res as any)?.error) {
        toast({
          title: 'Delete failed',
          description: (res as any).error,
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Skill deleted' });
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
      const res = await deleteSkill(id);
      if (!(res as any)?.error) ok += 1;
    }
    toast({ title: `${ok} skill${ok === 1 ? '' : 's'} deleted` });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }, [selected, load, toast]);

  // Archive = re-save the skill with category prefixed by "[archived]" since
  // the WsSkill type has no dedicated archived flag. Non-destructive.
  const handleBulkArchive = React.useCallback(async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let ok = 0;
    for (const id of ids) {
      const skill = skills.find((s) => String(s._id) === id);
      if (!skill) continue;
      const fd = new FormData();
      fd.append('_id', id);
      fd.append('name', skill.name);
      fd.append(
        'category',
        skill.category?.toLowerCase().startsWith('[archived]')
          ? skill.category
          : `[archived] ${skill.category ?? ''}`.trim(),
      );
      fd.append('description', skill.description ?? '');
      const res = await saveSkill(null, fd);
      if (!res?.error) ok += 1;
    }
    toast({ title: `${ok} skill${ok === 1 ? '' : 's'} archived` });
    setBulkArchiveOpen(false);
    setSelected(new Set());
    load();
  }, [selected, skills, load, toast]);

  // ── Selection ─────────────────────────────────────────────────────
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

  // ── Export ─────────────────────────────────────────────────────────
  const buildExportRows = React.useCallback((): {
    headers: string[];
    rows: ExportRow[];
  } => {
    const source =
      selected.size > 0
        ? filteredSkills.filter((s) => selected.has(s._id))
        : filteredSkills;
    const headers = [
      'Name',
      'Category',
      'Description',
      'Employees',
      'Departments',
      'Needs Renewal',
    ];
    const rows = source.map((s) => {
      const id = String(s._id);
      const departments = Array.from(skillDepartments(id)).join('; ');
      return {
        Name: s.name,
        Category: s.category ?? '',
        Description: s.description ?? '',
        Employees: assigneeCounts.get(id)?.size ?? 0,
        Departments: departments,
        'Needs Renewal': needsRenewal(s) ? 'Yes' : 'No',
      } satisfies ExportRow;
    });
    return { headers, rows };
  }, [selected, filteredSkills, assigneeCounts, skillDepartments, needsRenewal]);

  const exportCsv = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    downloadCsv(`skills-${dateStamp()}.csv`, headers, rows);
  }, [buildExportRows]);

  const exportXlsx = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    void downloadXlsx(`skills-${dateStamp()}.xlsx`, headers, rows, 'Skills');
  }, [buildExportRows]);

  // ── Filters helpers ────────────────────────────────────────────────
  const hasActiveFilters =
    !!search ||
    departmentFilter !== 'all' ||
    statusFilter !== 'all' ||
    !!dateFrom ||
    !!dateTo;

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setDepartmentFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }, []);

  // Pick top assignee for a skill to drive the EntityRowLink href.
  const topAssignee = React.useCallback(
    (skillId: string): EmployeeLite | null => {
      const set = assigneeCounts.get(skillId);
      if (!set || set.size === 0) return null;
      const first = set.values().next().value as string;
      return employeeMap.get(first) ?? null;
    },
    [assigneeCounts, employeeMap],
  );

  return (
    <>
      <EntityListShell
        title="Skills Master"
        subtitle="Manage the catalogue of skills used across the organisation."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search skill name, category…',
        }}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" /> CSV
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
              <Download className="h-4 w-4" /> XLSX
            </ZoruButton>
            <ZoruButton onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Skill
            </ZoruButton>
          </div>
        }
        filters={
          <>
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
                <ZoruSelectItem value="assigned">Assigned</ZoruSelectItem>
                <ZoruSelectItem value="unassigned">Unassigned</ZoruSelectItem>
                <ZoruSelectItem value="needs-renewal">Needs renewal</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
            <div className="flex items-center gap-1.5">
              <ZoruInput
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[140px] rounded-full border-zoru-line bg-zoru-bg text-[12.5px]"
                aria-label="Created from"
              />
              <span className="text-[12px] text-zoru-ink-muted">to</span>
              <ZoruInput
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-[140px] rounded-full border-zoru-line bg-zoru-bg text-[12.5px]"
                aria-label="Created to"
              />
            </div>
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
                {selected.size} skill{selected.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </ZoruButton>
                <ZoruButton variant="outline" size="sm" onClick={exportXlsx}>
                  <Download className="h-4 w-4" /> Export XLSX
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkArchiveOpen(true)}
                >
                  <Archive className="h-4 w-4" /> Archive
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="text-zoru-danger-ink"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </ZoruButton>
                <ZoruButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
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
        loading={isLoading && skills.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Wrench className="h-4 w-4" />}
              label="Total skills"
              value={kpis.totalSkills.toLocaleString('en-IN')}
              hint="Visible after filters"
            />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Avg employees per skill"
              value={kpis.avgPerSkill.toLocaleString('en-IN')}
              hint="Dedup across assignments"
            />
            <KpiCard
              icon={<Award className="h-4 w-4" />}
              label="Top skill"
              value={kpis.topSkill ? kpis.topSkill.name : '—'}
              hint={
                kpis.topSkill
                  ? `${kpis.topSkill.count.toLocaleString('en-IN')} employees`
                  : 'No assignments yet'
              }
            />
            <KpiCard
              icon={<RefreshCw className="h-4 w-4" />}
              label="Needs renewal"
              value={kpis.renewalCount.toLocaleString('en-IN')}
              hint="Heuristic: cert/renew/expir tag"
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Skills</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                Master catalogue of organisational skills.
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
                      Skill
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Category
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Employees
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Departments
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
                          ? 'No skills match the current filters.'
                          : 'No skills defined yet.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((s) => {
                      const id = String(s._id);
                      const isSelected = selected.has(id);
                      const assigneeCount = assigneeCounts.get(id)?.size ?? 0;
                      const depCsv = Array.from(skillDepartments(id))
                        .slice(0, 3)
                        .join(', ');
                      const top = topAssignee(id);
                      const href = top
                        ? `/dashboard/crm/hr-payroll/employees/${top._id}`
                        : '';
                      const subtitle = needsRenewal(s)
                        ? 'Needs renewal'
                        : s.description?.slice(0, 60) || (s.category ?? '—');
                      return (
                        <tr
                          key={id}
                          className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-2.5">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select ${s.name}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            {href ? (
                              <EntityRowLink href={href} label={s.name} subtitle={subtitle} />
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEdit(s)}
                                className="inline-flex flex-col items-start text-left font-medium text-zoru-ink transition-colors hover:text-primary hover:underline"
                              >
                                <span>{s.name}</span>
                                <span className="text-[12px] text-zoru-ink-muted">
                                  {subtitle}
                                </span>
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {s.category || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-zoru-ink">
                            {assigneeCount.toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {depCsv || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(s)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </ZoruButton>
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTargetId(id)}
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

        <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <ZoruDialogContent className="sm:max-w-[480px]">
            <ZoruDialogHeader>
              <ZoruDialogTitle>{form._id ? 'Edit Skill' : 'Add Skill'}</ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Skill Name <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSave();
                  }}
                  placeholder="e.g. JavaScript, Project Management"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                  autoFocus
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Category</ZoruLabel>
                <ZoruInput
                  value={form.category}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, category: e.target.value }))
                  }
                  placeholder="e.g. Programming, Soft skills"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">Description</ZoruLabel>
                <ZoruInput
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Short summary shown in the catalog"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
            <ZoruDialogFooter>
              <ZoruButton variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {form._id ? 'Update' : 'Add'}
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this skill?"
        description="This permanently removes the skill from the master list. Employee assignments are not deleted."
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} skill${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected skills."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <ConfirmDialog
        open={bulkArchiveOpen}
        onOpenChange={setBulkArchiveOpen}
        title={`Archive ${selected.size} skill${selected.size === 1 ? '' : 's'}?`}
        description="Archived skills stay in the catalogue but are tagged so they can be filtered out."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={handleBulkArchive}
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
      <div className="mt-2 truncate text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p>
      ) : null}
    </ZoruCard>
  );
}

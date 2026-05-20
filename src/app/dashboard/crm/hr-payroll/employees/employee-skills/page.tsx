'use client';

/**
 * Employee Skills (assignments) — deepened list.
 *
 * KPI strip: total assignments, unique employees, unique skills, avg skills/employee.
 * Filters: search (employee or skill name), skill category filter.
 * Bulk: bulk delete, export CSV / XLSX.
 * Pagination: 20 rows per page.
 *
 * Multi-tenant via getSession() inside the server actions.
 */

import * as React from 'react';
import {
  ZoruBadge,
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
  Award,
  Download,
  LoaderCircle,
  Pencil,
  Plus,
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
  deleteEmployeeSkill,
  getEmployeeSkills,
  getSkills,
  saveEmployeeSkill,
} from '@/app/actions/worksuite/hr-ext.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { WsEmployeeSkill, WsSkill } from '@/lib/worksuite/hr-ext-types';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

type AssignmentRow = WsEmployeeSkill & { _id: string };
type SkillLite = WsSkill & { _id: string };
type EmployeeLite = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  departmentName?: string;
};
type FormState = { _id: string; user_id: string; skill_id: string };

const EMPTY_FORM: FormState = { _id: '', user_id: '', skill_id: '' };
const ROWS_PER_PAGE = 20;

export default function EmployeeSkillsPage() {
  const { toast } = useZoruToast();

  const [assignments, setAssignments] = React.useState<AssignmentRow[]>([]);
  const [skills, setSkills] = React.useState<SkillLite[]>([]);
  const [employees, setEmployees] = React.useState<EmployeeLite[]>([]);

  const [isLoading, startLoad] = React.useTransition();
  const [isSaving, startSave] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);

  const [searchInput, setSearchInput] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [page, setPage] = React.useState(1);

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

  const load = React.useCallback(() => {
    startLoad(async () => {
      const [asg, sk, emps] = await Promise.all([
        getEmployeeSkills(),
        getSkills(),
        getCrmEmployees(),
      ]);
      setAssignments(asg as AssignmentRow[]);
      setSkills(sk as SkillLite[]);
      setEmployees(
        (emps as any[]).map((e) => ({
          _id: String(e._id),
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
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

  const skillMap = React.useMemo(() => {
    const m = new Map<string, SkillLite>();
    for (const s of skills) m.set(s._id, s);
    return m;
  }, [skills]);

  const empName = React.useCallback(
    (id?: string) => {
      if (!id) return '';
      const e = employeeMap.get(String(id));
      if (!e) return String(id);
      return [e.firstName, e.lastName].filter(Boolean).join(' ') || e.email || 'Unnamed';
    },
    [employeeMap],
  );

  const debouncedSearch = useDebouncedCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, 300);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const s of skills) if (s.category) set.add(s.category);
    return Array.from(set).sort();
  }, [skills]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      const skill = skillMap.get(String(a.skill_id));
      if (categoryFilter !== 'all' && skill?.category !== categoryFilter) return false;
      if (q) {
        const haystack = [
          empName(String(a.user_id)),
          skill?.name,
          skill?.category,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [assignments, search, categoryFilter, skillMap, empName]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const pageRows = React.useMemo(
    () => filtered.slice((page - 1) * ROWS_PER_PAGE, page * ROWS_PER_PAGE),
    [filtered, page],
  );

  // KPIs (over the full, unfiltered list — reflects org-wide state).
  const kpis = React.useMemo(() => {
    const totalAssignments = assignments.length;
    const uniqueEmployees = new Set(assignments.map((a) => String(a.user_id))).size;
    const uniqueSkills = new Set(assignments.map((a) => String(a.skill_id))).size;
    const avgSkillsPerEmployee =
      uniqueEmployees > 0
        ? Math.round((totalAssignments / uniqueEmployees) * 10) / 10
        : 0;
    return { totalAssignments, uniqueEmployees, uniqueSkills, avgSkillsPerEmployee };
  }, [assignments]);

  // Form helpers.
  const openAdd = React.useCallback(() => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((a: AssignmentRow) => {
    setForm({ _id: String(a._id), user_id: String(a.user_id), skill_id: String(a.skill_id) });
    setDialogOpen(true);
  }, []);

  const handleSave = React.useCallback(() => {
    if (!form.user_id || !form.skill_id) {
      toast({ title: 'Select both employee and skill', variant: 'destructive' });
      return;
    }
    startSave(async () => {
      const fd = new FormData();
      if (form._id) fd.append('_id', form._id);
      fd.append('user_id', form.user_id);
      fd.append('skill_id', form.skill_id);
      const r = await saveEmployeeSkill(null, fd);
      if (r.message) {
        toast({ title: 'Saved' });
        setDialogOpen(false);
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
  }, [form, load, toast]);

  const handleDelete = React.useCallback(
    async (id: string) => {
      const r = await deleteEmployeeSkill(id);
      if (r.success) {
        toast({ title: 'Removed' });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
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
      const r = await deleteEmployeeSkill(id);
      if (r.success) ok += 1;
    }
    toast({ title: `${ok} assignment${ok === 1 ? '' : 's'} removed` });
    setBulkDeleteOpen(false);
    setSelected(new Set());
    load();
  }, [selected, load, toast]);

  // Selection.
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

  // Export.
  const buildExportRows = React.useCallback((): { headers: string[]; rows: ExportRow[] } => {
    const source =
      selected.size > 0 ? filtered.filter((a) => selected.has(a._id)) : filtered;
    const headers = ['Employee', 'Department', 'Skill', 'Category'];
    const rows = source.map((a) => {
      const emp = employeeMap.get(String(a.user_id));
      const skill = skillMap.get(String(a.skill_id));
      return {
        Employee: empName(String(a.user_id)),
        Department: emp?.departmentName ?? '',
        Skill: skill?.name ?? String(a.skill_id),
        Category: skill?.category ?? '',
      } satisfies ExportRow;
    });
    return { headers, rows };
  }, [selected, filtered, employeeMap, skillMap, empName]);

  const exportCsv = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    downloadCsv(`employee-skills-${dateStamp()}.csv`, headers, rows);
  }, [buildExportRows]);

  const exportXlsx = React.useCallback(() => {
    const { headers, rows } = buildExportRows();
    void downloadXlsx(`employee-skills-${dateStamp()}.xlsx`, headers, rows, 'Employee Skills');
  }, [buildExportRows]);

  const hasActiveFilters = !!search || categoryFilter !== 'all';

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setCategoryFilter('all');
    setPage(1);
  }, []);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <>
      <EntityListShell
        title="Employee Skills"
        subtitle="Assign skills from the master catalogue to employees."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search employee or skill…',
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
              <Plus className="h-4 w-4" /> Assign Skill
            </ZoruButton>
          </div>
        }
        filters={
          <>
            <ZoruSelect
              value={categoryFilter}
              onValueChange={(v) => {
                setCategoryFilter(v);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-48 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All categories</ZoruSelectItem>
                {categories.map((c) => (
                  <ZoruSelectItem key={c} value={c}>
                    {c}
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
                {selected.size} assignment{selected.size === 1 ? '' : 's'} selected
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
        loading={isLoading && assignments.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<Award className="h-4 w-4" />}
              label="Total assignments"
              value={kpis.totalAssignments.toLocaleString('en-IN')}
              hint="Employee-skill pairs"
            />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              label="Employees with skills"
              value={kpis.uniqueEmployees.toLocaleString('en-IN')}
              hint="With at least one skill assigned"
            />
            <KpiCard
              icon={<Wrench className="h-4 w-4" />}
              label="Unique skills used"
              value={kpis.uniqueSkills.toLocaleString('en-IN')}
              hint="Distinct skills assigned to someone"
            />
            <KpiCard
              icon={<Award className="h-4 w-4" />}
              label="Avg skills / employee"
              value={kpis.avgSkillsPerEmployee.toLocaleString('en-IN')}
              hint="Across employees who have at least one"
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Assignments</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                One row per employee-skill assignment.
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
                      Employee
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Skill
                    </th>
                    <th className="px-4 py-2.5 text-left text-[12px] text-zoru-ink-muted">
                      Category
                    </th>
                    <th className="px-4 py-2.5 text-right text-[12px] text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-10 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasActiveFilters
                          ? 'No assignments match the current filters.'
                          : 'No skill assignments found.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((a) => {
                      const id = String(a._id);
                      const isSelected = selected.has(id);
                      const emp = employeeMap.get(String(a.user_id));
                      const skill = skillMap.get(String(a.skill_id));
                      const empHref = `/dashboard/crm/hr-payroll/employees/${String(a.user_id)}`;
                      return (
                        <tr
                          key={id}
                          className="border-t border-zoru-line hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-2.5">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select assignment for ${empName(String(a.user_id))}`}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <EntityRowLink
                              href={empHref}
                              label={empName(String(a.user_id)) || 'Unnamed'}
                              subtitle={emp?.departmentName ?? emp?.email ?? '—'}
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <ZoruBadge variant="secondary">
                              {skill?.name ?? String(a.skill_id)}
                            </ZoruBadge>
                          </td>
                          <td className="px-4 py-2.5 text-zoru-ink-muted">
                            {skill?.category || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(a)}
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
              <ZoruDialogTitle>
                {form._id ? 'Edit Skill Assignment' : 'Assign Skill to Employee'}
              </ZoruDialogTitle>
            </ZoruDialogHeader>
            <div className="grid gap-4 py-2">
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Employee <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect
                  value={form.user_id || '__none__'}
                  onValueChange={(v) => setField('user_id', v === '__none__' ? '' : v)}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue placeholder="Select employee" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="__none__">— Select employee —</ZoruSelectItem>
                    {employees.map((e) => (
                      <ZoruSelectItem key={e._id} value={e._id}>
                        {[e.firstName, e.lastName].filter(Boolean).join(' ') ||
                          e.email ||
                          'Unnamed'}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
              <div>
                <ZoruLabel className="text-[12px] text-zoru-ink-muted">
                  Skill <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruSelect
                  value={form.skill_id || '__none__'}
                  onValueChange={(v) => setField('skill_id', v === '__none__' ? '' : v)}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 w-full rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue placeholder="Select skill" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="__none__">— Select skill —</ZoruSelectItem>
                    {skills.map((s) => (
                      <ZoruSelectItem key={s._id} value={s._id}>
                        {s.name}
                        {s.category ? ` (${s.category})` : ''}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            </div>
            <ZoruDialogFooter>
              <ZoruButton variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </ZoruButton>
              <ZoruButton onClick={handleSave} disabled={isSaving}>
                {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {form._id ? 'Update' : 'Assign'}
              </ZoruButton>
            </ZoruDialogFooter>
          </ZoruDialogContent>
        </ZoruDialog>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Remove this skill assignment?"
        description="The skill stays in the master catalogue — only this employee's assignment is removed."
        confirmLabel="Remove"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Remove ${selected.size} assignment${selected.size === 1 ? '' : 's'}?`}
        description="Only the assignments are removed. Skills remain in the master catalogue."
        requireTyped="DELETE"
        confirmLabel="Remove"
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
      <div className="mt-2 truncate text-2xl text-zoru-ink">{value}</div>
      {hint ? (
        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{hint}</p>
      ) : null}
    </ZoruCard>
  );
}

'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCheckbox,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
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
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useActionState,
  useRef,
  useMemo,
} from 'react';
import { useFormStatus } from 'react-dom';
import {
  BadgeCheck,
  Download,
  Layers,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import {
  getCrmDesignations,
  saveCrmDesignation,
  deleteCrmDesignation,
  getCrmDepartments,
} from '@/app/actions/crm-employees.actions';
import type { WithId, CrmDesignation, CrmDepartment } from '@/lib/definitions';

const SAVE_INITIAL: { message: string | null; error: string | null } = {
  message: null,
  error: null,
};

const GRADE_OPTIONS = [
  'L1 — Junior',
  'L2 — Mid',
  'L3 — Senior',
  'L4 — Lead',
  'L5 — Principal',
  'L6 — Staff',
  'L7 — Director',
  'L8 — VP',
  'L9 — C-Level',
];

const ENTRY_GRADES = new Set(['L1 — Junior', 'L2 — Mid']);
const SENIOR_GRADES = new Set([
  'L4 — Lead',
  'L5 — Principal',
  'L6 — Staff',
  'L7 — Director',
  'L8 — VP',
  'L9 — C-Level',
]);

interface DesigKpi {
  total: number;
  deptsCovered: number;
  entryLevel: number;
  seniorLevel: number;
}

function computeKpi(
  designations: WithId<CrmDesignation>[],
): DesigKpi {
  const deptIds = new Set<string>();
  let entryLevel = 0;
  let seniorLevel = 0;
  for (const d of designations) {
    const deptId = (d as Record<string, unknown>).department_id;
    if (deptId) deptIds.add(String(deptId));
    const level = (d as Record<string, unknown>).level as string | undefined;
    if (level && ENTRY_GRADES.has(level)) entryLevel += 1;
    if (level && SENIOR_GRADES.has(level)) seniorLevel += 1;
  }
  return {
    total: designations.length,
    deptsCovered: deptIds.size,
    entryLevel,
    seniorLevel,
  };
}

interface KpiPillProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}

function KpiPill({ icon, label, value }: KpiPillProps) {
  return (
    <ZoruCard>
      <ZoruCardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface-2 text-zoru-ink-muted">
          {icon}
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            {label}
          </p>
          <p className="text-[18px] font-semibold leading-tight text-zoru-ink">
            {value}
          </p>
        </div>
      </ZoruCardContent>
    </ZoruCard>
  );
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      {label}
    </ZoruButton>
  );
}

export default function DesignationsPage() {
  const [designations, setDesignations] = useState<WithId<CrmDesignation>[]>([]);
  const [departments, setDepartments] = useState<WithId<CrmDepartment>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [saveState, formAction] = useActionState(saveCrmDesignation, SAVE_INITIAL);
  const { toast } = useZoruToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WithId<CrmDesignation> | null>(null);
  const [deptId, setDeptId] = useState('__none__');
  const [level, setLevel] = useState('__none__');

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('__all__');

  // Bulk
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkDeleting, startBulkDelete] = useTransition();
  const [deleteTransition, startDeleteTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<WithId<CrmDesignation> | null>(null);

  const fetchData = useCallback(() => {
    startLoading(async () => {
      const [desigs, depts] = await Promise.all([
        getCrmDesignations(),
        getCrmDepartments(),
      ]);
      setDesignations(desigs);
      setDepartments(depts);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (saveState.message) {
      toast({ title: 'Success', description: saveState.message });
      fetchData();
      formRef.current?.reset();
      setDialogOpen(false);
      setEditing(null);
      setDeptId('__none__');
      setLevel('__none__');
    }
    if (saveState.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, toast, fetchData]);

  const deptNameById = useMemo(
    () =>
      departments.reduce<Record<string, string>>((acc, d) => {
        acc[d._id.toString()] = d.name;
        return acc;
      }, {}),
    [departments],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return designations.filter((d) => {
      if (deptFilter !== '__all__') {
        const rawDeptId = (d as Record<string, unknown>).department_id;
        if (String(rawDeptId ?? '') !== deptFilter) return false;
      }
      if (q && !d.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [designations, search, deptFilter]);

  const kpi = useMemo(() => computeKpi(designations), [designations]);

  /* ── Selection ── */
  const headChecked =
    filtered.length > 0 && filtered.every((d) => selected.has(d._id.toString()));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(filtered.map((d) => d._id.toString())) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* ── Single delete ── */
  const handleDelete = (desig: WithId<CrmDesignation>) => {
    startDeleteTransition(async () => {
      const result = await deleteCrmDesignation(desig._id.toString());
      if (result.success) {
        toast({ title: 'Deleted', description: `"${desig.name}" removed.` });
        fetchData();
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  /* ── Bulk delete ── */
  const runBulkDelete = () => {
    if (selected.size === 0) return;
    setBulkConfirmOpen(false);
    const ids = Array.from(selected);
    startBulkDelete(async () => {
      let ok = 0;
      let failed = 0;
      for (const id of ids) {
        const res = await deleteCrmDesignation(id);
        if (res.success) ok += 1;
        else failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ok} designation${ok === 1 ? '' : 's'} deleted`
            : `${ok} deleted · ${failed} failed`,
        variant: failed > 0 ? 'destructive' : undefined,
      });
      setSelected(new Set());
      fetchData();
    });
  };

  /* ── Export CSV ── */
  const handleExportCsv = () => {
    const headers = ['Designation', 'Department', 'Level / Grade', 'Description'];
    const exportRows = filtered.map((d) => {
      const rawDeptId = (d as Record<string, unknown>).department_id;
      const deptName = rawDeptId ? deptNameById[String(rawDeptId)] ?? '' : '';
      const lvl = (d as Record<string, unknown>).level as string | undefined;
      return {
        Designation: d.name,
        Department: deptName,
        'Level / Grade': lvl ?? '',
        Description: d.description ?? '',
      };
    });
    downloadCsv(`designations-${dateStamp()}.csv`, headers, exportRows);
  };

  const openAdd = () => {
    setEditing(null);
    setDeptId('__none__');
    setLevel('__none__');
    setDialogOpen(true);
  };

  const openEdit = (desig: WithId<CrmDesignation>) => {
    setEditing(desig);
    setDeptId(
      (desig as Record<string, unknown>).department_id
        ? String((desig as Record<string, unknown>).department_id)
        : '__none__',
    );
    setLevel(
      (desig as Record<string, unknown>).level
        ? String((desig as Record<string, unknown>).level)
        : '__none__',
    );
    setDialogOpen(true);
  };

  return (
    <>
      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiPill icon={<Layers className="h-4 w-4" />} label="Total" value={kpi.total} />
        <KpiPill
          icon={<BadgeCheck className="h-4 w-4" />}
          label="Depts covered"
          value={kpi.deptsCovered}
        />
        <KpiPill
          icon={<TrendingUp className="h-4 w-4" />}
          label="Entry-level"
          value={kpi.entryLevel}
        />
        <KpiPill
          icon={<TrendingUp className="h-4 w-4" />}
          label="Senior-level"
          value={kpi.seniorLevel}
        />
      </div>

      <EntityListShell
        title="Designations"
        subtitle="Manage job titles with department mapping and grade levels."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              CSV
            </ZoruButton>
            <ZoruButton onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Add Designation
            </ZoruButton>
          </div>
        }
        search={{ value: search, onChange: setSearch, placeholder: 'Search designations…' }}
        filters={
          <ZoruSelect value={deptFilter} onValueChange={setDeptFilter}>
            <ZoruSelectTrigger className="h-9 w-[200px]">
              <ZoruSelectValue placeholder="All departments" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="__all__">All departments</ZoruSelectItem>
              {departments.map((d) => (
                <ZoruSelectItem key={d._id.toString()} value={d._id.toString()}>
                  {d.name}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <ListChecks className="h-4 w-4 text-zoru-primary" />
                {selected.size} selected
              </div>
              <div className="flex items-center gap-1">
                <ZoruButton
                  size="sm"
                  variant="destructive"
                  onClick={() => setBulkConfirmOpen(true)}
                  disabled={bulkDeleting}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </ZoruButton>
                <ZoruButton
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set())}
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </ZoruButton>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && designations.length === 0}
      >
        <ZoruCard className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[16px] text-zoru-ink">All Designations</h2>
            <ZoruBadge variant="secondary">{filtered.length} of {designations.length}</ZoruBadge>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zoru-line bg-zoru-surface-2">
                  <th className="w-8 px-4 py-3">
                    <ZoruCheckbox
                      checked={headChecked}
                      onCheckedChange={(c) => toggleAll(Boolean(c))}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    Designation
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    Department
                  </th>
                  <th className="px-4 py-3 text-[12px] uppercase text-zoru-ink-muted">
                    Level / Grade
                  </th>
                  <th className="px-4 py-3 text-right text-[12px] uppercase text-zoru-ink-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center">
                      <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((desig) => {
                    const rawDeptId = (desig as Record<string, unknown>).department_id;
                    const deptName = rawDeptId
                      ? deptNameById[String(rawDeptId)] ?? '—'
                      : '—';
                    const lvl = (desig as Record<string, unknown>).level as
                      | string
                      | undefined;
                    const id = desig._id.toString();
                    return (
                      <tr
                        key={id}
                        className="border-b border-zoru-line last:border-0 transition-colors hover:bg-zoru-surface-2/50"
                      >
                        <td className="px-4 py-3">
                          <ZoruCheckbox
                            checked={selected.has(id)}
                            onCheckedChange={() => toggleOne(id)}
                            aria-label={`Select ${desig.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <EntityRowLink
                            href={`/dashboard/crm/hr-payroll/designations/${id}`}
                            label={desig.name}
                            subtitle={desig.description || undefined}
                          />
                        </td>
                        <td className="px-4 py-3 text-zoru-ink-muted">{deptName}</td>
                        <td className="px-4 py-3">
                          {lvl ? (
                            <ZoruBadge variant="info">{lvl}</ZoruBadge>
                          ) : (
                            <span className="text-zoru-ink-muted">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ZoruButton
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(desig)}
                              aria-label="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </ZoruButton>
                            <ZoruButton
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingDelete(desig)}
                              disabled={deleteTransition}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </ZoruButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No designations match. Click &quot;Add Designation&quot; to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ZoruCard>
      </EntityListShell>

      {/* Add / Edit dialog */}
      <ZoruDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">
              {editing ? 'Edit Designation' : 'Add Designation'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Fill in the designation details. Only the name is required.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={formAction} ref={formRef} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id.toString()} />
            ) : null}
            <input
              type="hidden"
              name="department_id"
              value={deptId === '__none__' ? '' : deptId}
            />
            <input
              type="hidden"
              name="level"
              value={level === '__none__' ? '' : level}
            />

            <div>
              <ZoruLabel htmlFor="desig-name" className="text-[13px] text-zoru-ink">
                Designation Name <span className="text-red-500">*</span>
              </ZoruLabel>
              <ZoruInput
                id="desig-name"
                name="name"
                required
                defaultValue={editing?.name ?? ''}
                placeholder="e.g. Senior Software Engineer"
                className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div>
              <ZoruLabel htmlFor="desig-desc" className="text-[13px] text-zoru-ink">
                Description
              </ZoruLabel>
              <ZoruTextarea
                id="desig-desc"
                name="description"
                rows={2}
                defaultValue={editing?.description ?? ''}
                placeholder="Optional description"
                className="mt-1.5 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div>
              <ZoruLabel htmlFor="desig-dept" className="text-[13px] text-zoru-ink">
                Department
              </ZoruLabel>
              <ZoruSelect value={deptId} onValueChange={setDeptId}>
                <ZoruSelectTrigger
                  id="desig-dept"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                >
                  <ZoruSelectValue placeholder="— No department —" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— No department —</ZoruSelectItem>
                  {departments.map((d) => (
                    <ZoruSelectItem key={d._id.toString()} value={d._id.toString()}>
                      {d.name}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <div>
              <ZoruLabel htmlFor="desig-level" className="text-[13px] text-zoru-ink">
                Level / Grade
              </ZoruLabel>
              <ZoruSelect value={level} onValueChange={setLevel}>
                <ZoruSelectTrigger
                  id="desig-level"
                  className="mt-1.5 h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                >
                  <ZoruSelectValue placeholder="— No level —" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="__none__">— No level —</ZoruSelectItem>
                  {GRADE_OPTIONS.map((g) => (
                    <ZoruSelectItem key={g} value={g}>
                      {g}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </ZoruSelect>
            </div>

            <ZoruDialogFooter>
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </ZoruButton>
              <SaveButton label={editing ? 'Save Changes' : 'Add Designation'} />
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Single delete confirm */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete designation?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes &ldquo;{pendingDelete?.name}&rdquo;.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                if (pendingDelete) handleDelete(pendingDelete);
                setPendingDelete(null);
              }}
              disabled={deleteTransition}
            >
              {deleteTransition ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} designation{selected.size === 1 ? '' : 's'}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the selected designations. This action cannot
              be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={runBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? 'Deleting…' : 'Delete all'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}

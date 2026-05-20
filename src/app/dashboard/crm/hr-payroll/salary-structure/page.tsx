'use client';

/**
 * Salary Structures — deepened list.
 *
 * KPI strip: total structures, with earnings, with deductions, default structure.
 * Filters: search (name/description), type filter (earnings-only / deductions-only / mixed).
 * Bulk: bulk delete, export CSV / XLSX.
 * Pagination: 20 rows per page via in-client slice.
 *
 * Multi-tenant via getSalaryStructures() which scopes by userId server-side.
 */

import * as React from 'react';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
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
  ZoruRadioGroup,
  ZoruRadioGroupItem,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  CheckSquare,
  Download,
  Edit,
  FileSpreadsheet,
  LayersIcon,
  LoaderCircle,
  Plus,
  Save,
  Square,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useActionState, useEffect, useTransition, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { useDebouncedCallback } from 'use-debounce';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  deleteSalaryStructure,
  getSalaryStructures,
  saveSalaryStructure,
} from '@/app/actions/crm-payroll.actions';
import type { WithId, CrmSalaryStructure } from '@/lib/definitions';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
  type ExportRow,
} from '@/lib/crm-list-export';

const ROWS_PER_PAGE = 20;
const SAVE_INITIAL = { success: false, error: undefined as string | undefined };

type ComponentTypeFilter = 'all' | 'earnings-only' | 'deductions-only' | 'mixed';

type ComponentRow = {
  name: string;
  type: 'earning' | 'deduction';
  calculationType: 'fixed' | 'percentage';
  value: number;
  taxable?: boolean;
};

// ── Form sub-components ──────────────────────────────────────────────────────

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      {isEditing ? 'Save Structure' : 'Create Structure'}
    </ZoruButton>
  );
}

function StructureFormDialog({
  isOpen,
  onOpenChange,
  onSave,
  structure,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  structure?: WithId<CrmSalaryStructure> | null;
}) {
  const [state, formAction] = useActionState(saveSalaryStructure, SAVE_INITIAL);
  const { toast } = useZoruToast();
  const isEditing = !!structure;
  const [components, setComponents] = useState<ComponentRow[]>(
    structure?.components ?? [],
  );

  useEffect(() => {
    if (isOpen) setComponents(structure?.components ?? []);
  }, [isOpen, structure]);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Saved', description: 'Salary structure saved.' });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSave, onOpenChange]);

  const updateComponent = (
    index: number,
    field: string,
    value: string | number | boolean,
  ) =>
    setComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    );

  const addComponent = (type: 'earning' | 'deduction') =>
    setComponents((prev) => [
      ...prev,
      { name: '', type, calculationType: 'fixed', value: 0, taxable: false },
    ]);

  const removeComponent = (index: number) =>
    setComponents((prev) => prev.filter((_, i) => i !== index));

  const renderComponents = (type: 'earning' | 'deduction') => {
    const filteredWithIdx = components
      .map((c, originalIndex) => ({ ...c, originalIndex }))
      .filter((c) => c.type === type);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="capitalize text-[13px] text-zoru-ink">{type}s</h4>
          <ZoruButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addComponent(type)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add {type}
          </ZoruButton>
        </div>
        {filteredWithIdx.length === 0 && (
          <p className="rounded-lg border border-dashed border-zoru-line p-3 text-center text-[12.5px] text-zoru-ink-muted">
            No {type}s defined yet.
          </p>
        )}
        {filteredWithIdx.map((comp) => (
          <div
            key={comp.originalIndex}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] items-end gap-2 rounded-lg border border-zoru-line bg-zoru-surface-2 p-3"
          >
            <div className="space-y-1">
              <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">
                Component Name
              </ZoruLabel>
              <ZoruInput
                placeholder={type === 'earning' ? 'e.g. Basic Pay' : 'e.g. Prof. Tax'}
                value={comp.name}
                onChange={(e) =>
                  updateComponent(comp.originalIndex, 'name', e.target.value)
                }
                className="h-9 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">
                Calc. Type
              </ZoruLabel>
              <ZoruRadioGroup
                value={comp.calculationType}
                onValueChange={(val) =>
                  updateComponent(comp.originalIndex, 'calculationType', val)
                }
                className="flex h-9 items-center gap-3"
              >
                <label className="flex cursor-pointer items-center gap-1 text-[12.5px] text-zoru-ink">
                  <ZoruRadioGroupItem value="fixed" /> Fixed
                </label>
                <label className="flex cursor-pointer items-center gap-1 text-[12.5px] text-zoru-ink">
                  <ZoruRadioGroupItem value="percentage" /> %
                </label>
              </ZoruRadioGroup>
            </div>
            <div className="space-y-1">
              <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">
                {comp.calculationType === 'percentage' ? 'Rate (%)' : 'Amount (₹)'}
              </ZoruLabel>
              <ZoruInput
                type="number"
                value={comp.value}
                onChange={(e) =>
                  updateComponent(comp.originalIndex, 'value', Number(e.target.value))
                }
                className="h-9 w-24 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>
            <div className="space-y-1">
              <ZoruLabel className="text-[11.5px] text-zoru-ink-muted">Taxable</ZoruLabel>
              <button
                type="button"
                onClick={() =>
                  updateComponent(comp.originalIndex, 'taxable', !comp.taxable)
                }
                className="flex h-9 items-center text-zoru-ink-muted transition-colors hover:text-zoru-ink"
              >
                {comp.taxable ? (
                  <CheckSquare className="h-4 w-4 text-primary" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
            </div>
            <ZoruButton
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeComponent(comp.originalIndex)}
              className="text-zoru-danger-ink hover:text-zoru-danger-ink"
            >
              <Trash2 className="h-4 w-4" />
            </ZoruButton>
          </div>
        ))}
      </div>
    );
  };

  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-2xl">
        <form action={formAction}>
          <input type="hidden" name="id" value={structure?._id.toString()} />
          <input type="hidden" name="components" value={JSON.stringify(components)} />
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {isEditing ? 'Edit' : 'Create'} Salary Structure
            </ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto py-4 pr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <ZoruLabel>
                  Structure Name <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  name="name"
                  defaultValue={structure?.name}
                  required
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
              <div className="space-y-2">
                <ZoruLabel>Description</ZoruLabel>
                <ZoruInput
                  name="description"
                  defaultValue={structure?.description}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
            <div className="space-y-4 rounded-lg border border-zoru-line bg-zoru-bg p-4">
              {renderComponents('earning')}
            </div>
            <div className="space-y-4 rounded-lg border border-zoru-line bg-zoru-bg p-4">
              {renderComponents('deduction')}
            </div>
          </div>
          <ZoruDialogFooter className="pt-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton isEditing={isEditing} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SalaryStructurePage() {
  const [structures, setStructures] = useState<WithId<CrmSalaryStructure>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStructure, setEditingStructure] =
    useState<WithId<CrmSalaryStructure> | null>(null);
  const { toast } = useZoruToast();

  // Filters.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ComponentTypeFilter>('all');
  const [page, setPage] = useState(1);

  // Selection.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  const fetchData = React.useCallback(() => {
    startLoading(async () => {
      const data = await getSalaryStructures();
      setStructures(data);
      setSelected(new Set());
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const debouncedSearch = useDebouncedCallback((v: string) => {
    setSearch(v);
    setPage(1);
  }, 300);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return structures.filter((s) => {
      if (q) {
        const hay = [s.name, s.description ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const earningCount = s.components?.filter((c) => c.type === 'earning').length ?? 0;
      const deductionCount = s.components?.filter((c) => c.type === 'deduction').length ?? 0;
      switch (typeFilter) {
        case 'earnings-only':
          if (earningCount === 0 || deductionCount > 0) return false;
          break;
        case 'deductions-only':
          if (deductionCount === 0 || earningCount > 0) return false;
          break;
        case 'mixed':
          if (earningCount === 0 || deductionCount === 0) return false;
          break;
      }
      return true;
    });
  }, [structures, search, typeFilter]);

  // KPIs (over full list).
  const kpis = React.useMemo(() => {
    const total = structures.length;
    const withEarnings = structures.filter(
      (s) => (s.components ?? []).some((c) => c.type === 'earning'),
    ).length;
    const withDeductions = structures.filter(
      (s) => (s.components ?? []).some((c) => c.type === 'deduction'),
    ).length;
    const defaultStructure = structures.find((s) => s.isDefault);
    return { total, withEarnings, withDeductions, defaultStructure };
  }, [structures]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = React.useMemo(
    () => filtered.slice((pageSafe - 1) * ROWS_PER_PAGE, pageSafe * ROWS_PER_PAGE),
    [filtered, pageSafe],
  );

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter]);

  // Actions.
  const handleEdit = (s: WithId<CrmSalaryStructure> | null) => {
    setEditingStructure(s);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    const result = await deleteSalaryStructure(id);
    if (result.success) {
      toast({ title: 'Deleted' });
      fetchData();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  const handleBulkDelete = React.useCallback(() => {
    if (selected.size === 0) return;
    startDelete(async () => {
      const ids = Array.from(selected);
      let ok = 0;
      for (const id of ids) {
        const r = await deleteSalaryStructure(id);
        if (r.success) ok += 1;
      }
      toast({ title: `${ok} structure${ok === 1 ? '' : 's'} deleted` });
      setBulkDeleteOpen(false);
      setSelected(new Set());
      fetchData();
    });
  }, [selected, fetchData, toast]);

  // Selection.
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((s) => selected.has(s._id.toString()));

  const toggleAll = (all: boolean) =>
    setSelected(
      all ? new Set(pageRows.map((s) => s._id.toString())) : new Set(),
    );

  // Export.
  const buildExport = React.useCallback((): { headers: string[]; rows: ExportRow[] } => {
    const source =
      selected.size > 0
        ? filtered.filter((s) => selected.has(s._id.toString()))
        : filtered;
    const headers = [
      'Name',
      'Description',
      'Earnings',
      'Deductions',
      'Total Components',
      'Default',
    ];
    const rows: ExportRow[] = source.map((s) => {
      const earnings = s.components?.filter((c) => c.type === 'earning') ?? [];
      const deductions = s.components?.filter((c) => c.type === 'deduction') ?? [];
      return {
        Name: s.name,
        Description: s.description ?? '',
        Earnings: earnings.length,
        Deductions: deductions.length,
        'Total Components': (s.components ?? []).length,
        Default: s.isDefault ? 'Yes' : 'No',
      };
    });
    return { headers, rows };
  }, [selected, filtered]);

  const onExportCsv = React.useCallback(() => {
    const { headers, rows } = buildExport();
    downloadCsv(`salary-structures-${dateStamp()}.csv`, headers, rows);
  }, [buildExport]);

  const onExportXlsx = React.useCallback(() => {
    const { headers, rows } = buildExport();
    void downloadXlsx(
      `salary-structures-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Salary Structures',
    );
  }, [buildExport]);

  const hasActiveFilters = !!search || typeFilter !== 'all';

  const clearFilters = React.useCallback(() => {
    setSearch('');
    setSearchInput('');
    setTypeFilter('all');
    setPage(1);
  }, []);

  return (
    <>
      <StructureFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={fetchData}
        structure={editingStructure}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title={`Delete ${selected.size} structure${selected.size === 1 ? '' : 's'}?`}
        description="Past payrolls referencing these structures are not affected."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <EntityListShell
        title="Salary Structures"
        subtitle="Define salary templates with earnings and deductions for different employee roles or grades."
        search={{
          value: searchInput,
          onChange: (v) => {
            setSearchInput(v);
            debouncedSearch(v);
          },
          placeholder: 'Search name or description…',
        }}
        primaryAction={
          <div className="flex flex-wrap items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
              <Download className="h-3.5 w-3.5" /> CSV
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={onExportXlsx}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> XLSX
            </ZoruButton>
            <ZoruButton onClick={() => handleEdit(null)}>
              <Plus className="h-4 w-4" /> Create Structure
            </ZoruButton>
          </div>
        }
        filters={
          <>
            <ZoruSelect
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as ComponentTypeFilter);
                setPage(1);
              }}
            >
              <ZoruSelectTrigger className="h-9 w-44 rounded-full border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Type" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                <ZoruSelectItem value="mixed">Mixed</ZoruSelectItem>
                <ZoruSelectItem value="earnings-only">Earnings only</ZoruSelectItem>
                <ZoruSelectItem value="deductions-only">Deductions only</ZoruSelectItem>
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
                {selected.size} structure{selected.size === 1 ? '' : 's'} selected
              </span>
              <div className="flex items-center gap-2">
                <ZoruButton variant="outline" size="sm" onClick={onExportCsv}>
                  <Download className="h-4 w-4" /> Export CSV
                </ZoruButton>
                <ZoruButton variant="outline" size="sm" onClick={onExportXlsx}>
                  <FileSpreadsheet className="h-4 w-4" /> Export XLSX
                </ZoruButton>
                <ZoruButton
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  disabled={isDeleting}
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
          filtered.length > ROWS_PER_PAGE ? (
            <PaginationBar
              page={pageSafe}
              limit={ROWS_PER_PAGE}
              hasMore={pageSafe < totalPages}
              total={filtered.length}
              controlled={{ onChange: (next) => setPage(next.page) }}
            />
          ) : null
        }
        loading={isLoading && structures.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={<LayersIcon className="h-4 w-4" />}
              label="Total structures"
              value={kpis.total.toLocaleString('en-IN')}
              hint="Salary structure templates"
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="With earnings"
              value={kpis.withEarnings.toLocaleString('en-IN')}
              hint="Structures that define earning components"
            />
            <KpiCard
              icon={<TrendingDown className="h-4 w-4" />}
              label="With deductions"
              value={kpis.withDeductions.toLocaleString('en-IN')}
              hint="Structures that define deduction components"
            />
            <KpiCard
              icon={<Star className="h-4 w-4" />}
              label="Default structure"
              value={kpis.defaultStructure ? kpis.defaultStructure.name : 'None set'}
              hint={
                kpis.defaultStructure
                  ? `${(kpis.defaultStructure.components ?? []).length} component(s)`
                  : 'Mark a structure as default to auto-assign'
              }
            />
          </div>

          <ZoruCard className="p-6">
            <div className="mb-4">
              <h2 className="text-[16px] text-zoru-ink">Your Structures</h2>
              <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                {filtered.length} structure{filtered.length !== 1 ? 's' : ''} visible.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-3">
                      <ZoruCheckbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) => toggleAll(Boolean(c))}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">Name</th>
                    <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">
                      Description
                    </th>
                    <th className="px-4 py-3 text-center text-[12px] text-zoru-ink-muted">
                      Earnings
                    </th>
                    <th className="px-4 py-3 text-center text-[12px] text-zoru-ink-muted">
                      Deductions
                    </th>
                    <th className="px-4 py-3 text-[12px] text-zoru-ink-muted">
                      Components
                    </th>
                    <th className="px-4 py-3 text-right text-[12px] text-zoru-ink-muted">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="h-24 text-center">
                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                      </td>
                    </tr>
                  ) : pageRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                      >
                        {hasActiveFilters
                          ? 'No structures match the current filters.'
                          : 'No salary structures created yet.'}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((s) => {
                      const id = s._id.toString();
                      const isSelected = selected.has(id);
                      const earnings =
                        s.components?.filter((c) => c.type === 'earning') ?? [];
                      const deductions =
                        s.components?.filter((c) => c.type === 'deduction') ?? [];
                      return (
                        <tr
                          key={id}
                          className="border-b border-zoru-line last:border-0 transition-colors hover:bg-zoru-surface-2/50"
                        >
                          <td className="px-3 py-3">
                            <ZoruCheckbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select ${s.name}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <EntityRowLink
                                href={`/dashboard/crm/hr-payroll/salary-structure/${id}`}
                                label={s.name}
                              />
                              {s.isDefault ? (
                                <ZoruBadge variant="secondary">Default</ZoruBadge>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zoru-ink-muted">
                            {s.description ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ZoruBadge variant="success">
                              {earnings.length} earning{earnings.length !== 1 ? 's' : ''}
                            </ZoruBadge>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <ZoruBadge variant="danger">
                              {deductions.length} deduction
                              {deductions.length !== 1 ? 's' : ''}
                            </ZoruBadge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {(s.components ?? []).slice(0, 3).map((c, i) => (
                                <ZoruBadge key={i} variant="secondary">
                                  {c.name}
                                </ZoruBadge>
                              ))}
                              {(s.components?.length ?? 0) > 3 && (
                                <ZoruBadge variant="secondary">
                                  +{(s.components?.length ?? 0) - 3} more
                                </ZoruBadge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <ZoruButton
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(s)}
                              >
                                <Edit className="h-4 w-4" />
                              </ZoruButton>
                              <ZoruAlertDialog>
                                <ZoruAlertDialogTrigger asChild>
                                  <ZoruButton
                                    variant="ghost"
                                    size="icon"
                                    className="text-zoru-danger-ink hover:text-zoru-danger-ink"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </ZoruButton>
                                </ZoruAlertDialogTrigger>
                                <ZoruAlertDialogContent>
                                  <ZoruAlertDialogHeader>
                                    <ZoruAlertDialogTitle>
                                      Delete Structure?
                                    </ZoruAlertDialogTitle>
                                    <ZoruAlertDialogDescription>
                                      This will delete &ldquo;{s.name}&rdquo;. It
                                      won&apos;t affect past payrolls.
                                    </ZoruAlertDialogDescription>
                                  </ZoruAlertDialogHeader>
                                  <ZoruAlertDialogFooter>
                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                    <ZoruAlertDialogAction
                                      onClick={() => handleDelete(id)}
                                    >
                                      Delete
                                    </ZoruAlertDialogAction>
                                  </ZoruAlertDialogFooter>
                                </ZoruAlertDialogContent>
                              </ZoruAlertDialog>
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
      </EntityListShell>
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

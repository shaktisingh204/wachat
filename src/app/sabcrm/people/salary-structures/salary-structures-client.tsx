'use client';

/**
 * SabCRM People — Salary structures list client
 * (`/sabcrm/people/salary-structures`, WI-31 / rich shape per WI-8).
 *
 * Doc-surface adopter for the canonical structure catalog: list
 * (name / effective date / component splits / applicability summary /
 * active status, CSV export, bulk delete) plus a right-side drawer
 * carrying the FULL rich field set:
 *
 *   - components[] repeater — name★, CODE★ (uppercased), type
 *     (earning/deduction/reimbursement), calc kind (fixed /
 *     percent_basic / percent_ctc / formula) with the conditional
 *     amount | pct | expr input, taxable / statutory / prorate
 *     switches, frequency and min/max caps;
 *   - applicableTo[] repeater — employee/department via REAL
 *     EntityPickers (gated search actions, labels cached) or a
 *     free-text grade code;
 *   - a live example preview (client-side mirror of the engine's
 *     `resolve_amount`, incl. `min`/`max` — display only, the server
 *     stays source of truth).
 *
 * `?open=<id>` deep-links the edit drawer (rows navigate there).
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Plus, Trash2, X } from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  SelectField,
  Switch,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  DocListPage,
  EntityPicker,
  formatDocMoney,
  type DocListColumn,
  type DocListPageConfig,
} from '../../finance/_components/doc-surface';
import {
  APPLICABILITY_KINDS,
  CALC_KINDS,
  COMPONENT_FREQUENCIES,
  COMPONENT_TYPES,
  SALARY_STRUCTURES_PATH,
  SALARY_STRUCTURE_STATUSES,
  previewComponentAmount,
  structureOpenHref,
  toStructureFilters,
} from './salary-structures-config';

import {
  createSabcrmSalaryStructure,
  deleteSabcrmSalaryStructure,
  getSabcrmSalaryStructure,
  listSabcrmSalaryStructuresPage,
  exportSabcrmSalaryStructureRows,
  searchSabcrmStructureDepartments,
  searchSabcrmStructureEmployees,
  updateSabcrmSalaryStructure,
} from '@/app/actions/sabcrm-people-salary-structures.actions';
import type {
  SabcrmApplicability,
  SabcrmCalcKind,
  SabcrmComponentFrequency,
  SabcrmSalaryComponent,
  SabcrmSalaryComponentType,
  SabcrmSalaryStructureInput,
  SabcrmSalaryStructureListRow,
  SabcrmSalaryStructureView,
} from '@/app/actions/sabcrm-people-salary-structures.actions.types';

/* ─── Columns (rich list coverage per WI-31) ──────────────────── */

const COLUMNS: DocListColumn<SabcrmSalaryStructureListRow>[] = [
  { key: 'name', header: 'Structure', kind: 'text', value: (r) => r.name },
  {
    key: 'effectiveDate',
    header: 'Effective',
    kind: 'date',
    value: (r) => r.effectiveDate,
  },
  {
    key: 'components',
    header: 'Components',
    kind: 'text',
    value: (r) =>
      `${r.componentCount} ${r.componentCount === 1 ? 'component' : 'components'}`,
  },
  {
    key: 'split',
    header: 'Earnings / deductions',
    kind: 'text',
    value: (r) =>
      [
        `${r.earningCount} earning${r.earningCount === 1 ? '' : 's'}`,
        `${r.deductionCount} deduction${r.deductionCount === 1 ? '' : 's'}`,
        ...(r.reimbursementCount > 0
          ? [`${r.reimbursementCount} reimb.`]
          : []),
      ].join(' · '),
  },
  {
    key: 'applicability',
    header: 'Applies to',
    kind: 'text',
    value: (r) => r.applicabilitySummary || 'Everyone (unrestricted)',
  },
  { key: 'status', header: 'Status', kind: 'status', value: (r) => r.status },
];

/* ─── Drafts ──────────────────────────────────────────────────── */

let draftSeq = 0;
const nextRowId = (): string => `ss-row-${++draftSeq}`;

interface ComponentDraft {
  rowId: string;
  name: string;
  code: string;
  type: SabcrmSalaryComponentType;
  calcKind: SabcrmCalcKind['kind'];
  amount: string;
  pct: string;
  expr: string;
  taxable: boolean;
  statutory: boolean;
  prorate: boolean;
  frequency: SabcrmComponentFrequency;
  minCap: string;
  maxCap: string;
}

interface TargetDraft {
  rowId: string;
  kind: SabcrmApplicability['kind'];
  /** ObjectId hex for employee/department, free text for grade. */
  id: string;
  label: string | null;
}

function blankComponent(type: SabcrmSalaryComponentType = 'earning'): ComponentDraft {
  return {
    rowId: nextRowId(),
    name: '',
    code: '',
    type,
    calcKind: 'fixed',
    amount: '',
    pct: '',
    expr: '',
    taxable: type === 'earning',
    statutory: false,
    prorate: true,
    frequency: 'monthly',
    minCap: '',
    maxCap: '',
  };
}

function componentToDraft(c: SabcrmSalaryComponent): ComponentDraft {
  return {
    rowId: nextRowId(),
    name: c.name,
    code: c.code,
    type: c.type,
    calcKind: c.calc.kind,
    amount: c.calc.kind === 'fixed' ? String(c.calc.amount) : '',
    pct:
      c.calc.kind === 'percent_basic' || c.calc.kind === 'percent_ctc'
        ? String(c.calc.pct)
        : '',
    expr: c.calc.kind === 'formula' ? c.calc.expr : '',
    taxable: Boolean(c.taxable),
    statutory: Boolean(c.statutory),
    prorate: c.prorate !== false,
    frequency: c.frequency ?? 'monthly',
    minCap: c.minCap != null ? String(c.minCap) : '',
    maxCap: c.maxCap != null ? String(c.maxCap) : '',
  };
}

function draftToComponent(d: ComponentDraft): SabcrmSalaryComponent | string {
  if (!d.name.trim()) return 'Every component needs a name.';
  if (!d.code.trim()) return `Component “${d.name}” needs a code.`;
  let calc: SabcrmCalcKind;
  switch (d.calcKind) {
    case 'fixed': {
      const amount = Number(d.amount);
      if (!d.amount.trim() || !Number.isFinite(amount) || amount < 0) {
        return `Component “${d.name}” needs a fixed amount ≥ 0.`;
      }
      calc = { kind: 'fixed', amount };
      break;
    }
    case 'percent_basic':
    case 'percent_ctc': {
      const pct = Number(d.pct);
      if (!d.pct.trim() || !Number.isFinite(pct) || pct < 0) {
        return `Component “${d.name}” needs a percentage ≥ 0.`;
      }
      calc = { kind: d.calcKind, pct };
      break;
    }
    case 'formula': {
      if (!d.expr.trim()) {
        return `Component “${d.name}” needs a formula expression.`;
      }
      calc = { kind: 'formula', expr: d.expr.trim() };
      break;
    }
    default:
      return `Component “${d.name}” has an unknown calculation kind.`;
  }
  const minCap = d.minCap.trim() ? Number(d.minCap) : undefined;
  const maxCap = d.maxCap.trim() ? Number(d.maxCap) : undefined;
  if (minCap !== undefined && !Number.isFinite(minCap)) {
    return `Component “${d.name}” has an invalid minimum cap.`;
  }
  if (maxCap !== undefined && !Number.isFinite(maxCap)) {
    return `Component “${d.name}” has an invalid maximum cap.`;
  }
  return {
    name: d.name.trim(),
    code: d.code.trim().toUpperCase(),
    type: d.type,
    calc,
    taxable: d.taxable,
    statutory: d.statutory,
    prorate: d.prorate,
    frequency: d.frequency,
    minCap,
    maxCap,
  };
}

/* ─── Select vocabularies ─────────────────────────────────────── */

const TYPE_OPTIONS: SelectOption[] = COMPONENT_TYPES.map((t) => ({
  value: t.value,
  label: t.label,
}));
const CALC_OPTIONS: SelectOption[] = CALC_KINDS.map((c) => ({
  value: c.value,
  label: c.label,
}));
const FREQ_OPTIONS: SelectOption[] = COMPONENT_FREQUENCIES.map((f) => ({
  value: f.value,
  label: f.label,
}));
const TARGET_OPTIONS: SelectOption[] = APPLICABILITY_KINDS.map((k) => ({
  value: k.value,
  label: k.label,
}));

/* ─── Component editor row ────────────────────────────────────── */

interface ComponentRowProps {
  draft: ComponentDraft;
  busy: boolean;
  onPatch: (p: Partial<ComponentDraft>) => void;
  onRemove: () => void;
  preview: number | null;
}

function ComponentRow({
  draft,
  busy,
  onPatch,
  onRemove,
  preview,
}: ComponentRowProps): React.JSX.Element {
  return (
    <fieldset className="m-0 rounded-md border border-[var(--st-border)] p-3">
      <legend className="px-1 text-xs font-medium text-[var(--st-text-secondary)]">
        {draft.name.trim() || 'New component'}
        {preview != null ? ` — e.g. ${formatDocMoney(preview, 'INR')}` : ''}
      </legend>
      <div className="fdoc-form-grid">
        <Field label="Name" required>
          <Input
            value={draft.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="House Rent Allowance"
            disabled={busy}
          />
        </Field>
        <Field label="Code" required help="Used by formulas and payslip lines.">
          <Input
            value={draft.code}
            onChange={(e) => onPatch({ code: e.target.value.toUpperCase() })}
            placeholder="HRA"
            disabled={busy}
          />
        </Field>
        <Field label="Type">
          <SelectField
            value={draft.type}
            onChange={(v) =>
              onPatch({ type: (v || 'earning') as SabcrmSalaryComponentType })
            }
            options={TYPE_OPTIONS}
            disabled={busy}
            aria-label="Component type"
          />
        </Field>
        <Field label="Calculation">
          <SelectField
            value={draft.calcKind}
            onChange={(v) =>
              onPatch({ calcKind: (v || 'fixed') as SabcrmCalcKind['kind'] })
            }
            options={CALC_OPTIONS}
            disabled={busy}
            aria-label="Calculation kind"
          />
        </Field>
        {draft.calcKind === 'fixed' ? (
          <Field label="Amount" required>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={draft.amount}
              onChange={(e) => onPatch({ amount: e.target.value })}
              placeholder="200"
              disabled={busy}
            />
          </Field>
        ) : null}
        {draft.calcKind === 'percent_basic' || draft.calcKind === 'percent_ctc' ? (
          <Field
            label={draft.calcKind === 'percent_basic' ? '% of basic' : '% of CTC'}
            required
          >
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={draft.pct}
              onChange={(e) => onPatch({ pct: e.target.value })}
              placeholder="40"
              disabled={busy}
            />
          </Field>
        ) : null}
        {draft.calcKind === 'formula' ? (
          <div className="fdoc-form-grid__full">
            <Field
              label="Formula"
              required
              help="Identifiers: basic, ctc, monthlyCtc, annualCtc — plus min(a,b) / max(a,b)."
            >
              <Input
                value={draft.expr}
                onChange={(e) => onPatch({ expr: e.target.value })}
                placeholder="min(basic, 15000) * 0.12"
                disabled={busy}
                className="font-mono"
              />
            </Field>
          </div>
        ) : null}
        <Field label="Frequency">
          <SelectField
            value={draft.frequency}
            onChange={(v) =>
              onPatch({
                frequency: (v || 'monthly') as SabcrmComponentFrequency,
              })
            }
            options={FREQ_OPTIONS}
            disabled={busy}
            aria-label="Frequency"
          />
        </Field>
        <Field label="Flags">
          <div className="flex flex-col gap-2">
            <Switch
              label="Taxable"
              checked={draft.taxable}
              onCheckedChange={(v) => onPatch({ taxable: v })}
              disabled={busy}
            />
            <Switch
              label="Statutory"
              checked={draft.statutory}
              onCheckedChange={(v) => onPatch({ statutory: v })}
              disabled={busy}
            />
            <Switch
              label="Prorate by attendance"
              checked={draft.prorate}
              onCheckedChange={(v) => onPatch({ prorate: v })}
              disabled={busy}
            />
          </div>
        </Field>
        <Field label="Minimum cap">
          <Input
            type="number"
            inputMode="decimal"
            value={draft.minCap}
            onChange={(e) => onPatch({ minCap: e.target.value })}
            placeholder="No floor"
            disabled={busy}
          />
        </Field>
        <Field label="Maximum cap">
          <Input
            type="number"
            inputMode="decimal"
            value={draft.maxCap}
            onChange={(e) => onPatch({ maxCap: e.target.value })}
            placeholder="No ceiling"
            disabled={busy}
          />
        </Field>
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconLeft={Trash2}
          disabled={busy}
          onClick={onRemove}
        >
          Remove component
        </Button>
      </div>
    </fieldset>
  );
}

/* ─── Editor drawer ───────────────────────────────────────────── */

interface StructureEditorProps {
  open: boolean;
  /** Null = create mode. */
  view: SabcrmSalaryStructureView | null;
  onClose: () => void;
  onSaved: () => void;
}

function StructureEditorDrawer({
  open,
  view,
  onClose,
  onSaved,
}: StructureEditorProps): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [effectiveDate, setEffectiveDate] = React.useState('');
  const [active, setActive] = React.useState(true);
  const [components, setComponents] = React.useState<ComponentDraft[]>([]);
  const [targets, setTargets] = React.useState<TargetDraft[]>([]);
  const [exampleCtc, setExampleCtc] = React.useState('100000');
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [deleting, setDeleting] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const busy = pending || deleting;
  const mode = view ? 'edit' : 'create';

  React.useEffect(() => {
    if (!open) return;
    const doc = view?.doc;
    setName(doc?.name ?? '');
    setEffectiveDate((doc?.effectiveDate ?? '').slice(0, 10));
    setActive(doc ? doc.active !== false : true);
    setComponents(
      doc?.components?.length
        ? doc.components.map(componentToDraft)
        : [blankComponent('earning')],
    );
    setTargets(
      (doc?.applicableTo ?? []).map((t) => ({
        rowId: nextRowId(),
        kind: t.kind,
        id: t.id,
        label:
          t.kind === 'grade' ? t.id : (view?.targetLabels[t.id] ?? null),
      })),
    );
    setExampleCtc('100000');
    setFormError(null);
  }, [open, view]);

  const patchComponent = (rowId: string, p: Partial<ComponentDraft>): void =>
    setComponents((prev) =>
      prev.map((c) => (c.rowId === rowId ? { ...c, ...p } : c)),
    );

  const patchTarget = (rowId: string, p: Partial<TargetDraft>): void =>
    setTargets((prev) =>
      prev.map((t) => (t.rowId === rowId ? { ...t, ...p } : t)),
    );

  /* ---- live example preview (display only — server is truth) ---- */
  const monthlyCtc = Number(exampleCtc) || 0;
  const previewBasic = React.useMemo(() => {
    // The BASIC row (code BASIC or first percent_ctc earning) anchors
    // percent_basic components in the preview.
    for (const d of components) {
      const c = draftToComponent(d);
      if (typeof c === 'string') continue;
      if (c.code === 'BASIC') {
        return previewComponentAmount(c, 0, monthlyCtc) ?? 0;
      }
    }
    return monthlyCtc * 0.4; // sensible default anchor for the preview
  }, [components, monthlyCtc]);

  const previewFor = (d: ComponentDraft): number | null => {
    const c = draftToComponent(d);
    if (typeof c === 'string') return null;
    return previewComponentAmount(c, previewBasic, monthlyCtc);
  };

  const submit = (): void => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('A structure name is required.');
      return;
    }
    if (!effectiveDate) {
      setFormError('An effective date is required.');
      return;
    }
    const builtComponents: SabcrmSalaryComponent[] = [];
    for (const draft of components) {
      const built = draftToComponent(draft);
      if (typeof built === 'string') {
        setFormError(built);
        return;
      }
      builtComponents.push(built);
    }
    if (builtComponents.length === 0) {
      setFormError('Add at least one salary component.');
      return;
    }
    const applicableTo: SabcrmApplicability[] = [];
    for (const t of targets) {
      if (!t.id.trim()) {
        setFormError(
          t.kind === 'grade'
            ? 'Every grade rule needs a grade code.'
            : 'Pick a target for every applicability rule (or remove the empty row).',
        );
        return;
      }
      applicableTo.push({ kind: t.kind, id: t.id.trim() } as SabcrmApplicability);
    }

    const input: SabcrmSalaryStructureInput = {
      name: name.trim(),
      effectiveDate,
      components: builtComponents,
      applicableTo,
      active,
    };

    startTransition(async () => {
      const res = view
        ? await updateSabcrmSalaryStructure(view.doc._id, input)
        : await createSabcrmSalaryStructure(input);
      if (!res.ok) {
        setFormError(res.error);
        return;
      }
      toast.success(
        view ? `${res.data.name} updated.` : `${res.data.name} created.`,
      );
      onSaved();
    });
  };

  const remove = async (): Promise<void> => {
    if (!view) return;
    setDeleting(true);
    try {
      const res = await deleteSabcrmSalaryStructure(view.doc._id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${view.doc.name} deleted.`);
      setConfirmDelete(false);
      onSaved();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(next) => !next && !busy && onClose()} side="right">
      <DrawerContent
        aria-describedby="structure-form-desc"
        className="fdoc-form-drawer"
      >
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New salary structure' : `Edit ${view?.doc.name ?? 'structure'}`}
          </DrawerTitle>
          <DrawerDescription id="structure-form-desc">
            {mode === 'create'
              ? 'Define the component stack payroll compute resolves for each employee.'
              : 'Every stored field is editable — payroll compute uses the saved version.'}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="fdoc-form-grid">
              <Field label="Name" required>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Engineering 2026"
                  disabled={busy}
                />
              </Field>
              <Field label="Effective from" required>
                <Input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  disabled={busy}
                />
              </Field>
              <Field label="Lifecycle">
                <Switch
                  label="Active (usable by payroll compute)"
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={busy}
                />
              </Field>
              <Field
                label="Example monthly CTC"
                help="Drives the live preview amounts only — nothing is stored."
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={exampleCtc}
                  onChange={(e) => setExampleCtc(e.target.value)}
                  disabled={busy}
                />
              </Field>
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold">Components</h3>
            <div className="flex flex-col gap-3">
              {components.map((draft) => (
                <ComponentRow
                  key={draft.rowId}
                  draft={draft}
                  busy={busy}
                  preview={previewFor(draft)}
                  onPatch={(p) => patchComponent(draft.rowId, p)}
                  onRemove={() =>
                    setComponents((prev) =>
                      prev.filter((c) => c.rowId !== draft.rowId),
                    )
                  }
                />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconLeft={Plus}
                disabled={busy}
                onClick={() =>
                  setComponents((prev) => [...prev, blankComponent('earning')])
                }
              >
                Add earning
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconLeft={Plus}
                disabled={busy}
                onClick={() =>
                  setComponents((prev) => [...prev, blankComponent('deduction')])
                }
              >
                Add deduction
              </Button>
            </div>

            <h3 className="mb-2 mt-5 text-sm font-semibold">Applies to</h3>
            <p className="m-0 mb-2 text-xs text-[var(--st-text-secondary)]">
              Leave empty to make the structure available to everyone; add
              rules to restrict it to specific employees, departments or
              grades.
            </p>
            <div className="flex flex-col gap-2">
              {targets.map((t) => (
                <div
                  key={t.rowId}
                  className="grid grid-cols-[140px_1fr_auto] items-end gap-2"
                >
                  <Field label="Kind">
                    <SelectField
                      value={t.kind}
                      onChange={(v) =>
                        patchTarget(t.rowId, {
                          kind: (v || 'employee') as SabcrmApplicability['kind'],
                          id: '',
                          label: null,
                        })
                      }
                      options={TARGET_OPTIONS}
                      disabled={busy}
                      aria-label="Applicability kind"
                    />
                  </Field>
                  {t.kind === 'grade' ? (
                    <Field label="Grade code">
                      <Input
                        value={t.id}
                        onChange={(e) =>
                          patchTarget(t.rowId, {
                            id: e.target.value,
                            label: e.target.value,
                          })
                        }
                        placeholder="L4"
                        disabled={busy}
                      />
                    </Field>
                  ) : (
                    <Field label={t.kind === 'employee' ? 'Employee' : 'Department'}>
                      <EntityPicker
                        value={t.id || null}
                        valueLabel={t.label}
                        onChange={(opt) =>
                          patchTarget(t.rowId, {
                            id: opt?.id ?? '',
                            label: opt?.label ?? null,
                          })
                        }
                        search={async (q) => {
                          const res =
                            t.kind === 'employee'
                              ? await searchSabcrmStructureEmployees(q)
                              : await searchSabcrmStructureDepartments(q);
                          return res.ok ? res.data : [];
                        }}
                        placeholder={
                          t.kind === 'employee'
                            ? 'Search employees…'
                            : 'Search departments…'
                        }
                        disabled={busy}
                        aria-label={`Pick ${t.kind}`}
                      />
                    </Field>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    iconLeft={X}
                    disabled={busy}
                    aria-label="Remove rule"
                    onClick={() =>
                      setTargets((prev) =>
                        prev.filter((x) => x.rowId !== t.rowId),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                iconLeft={Plus}
                disabled={busy}
                onClick={() =>
                  setTargets((prev) => [
                    ...prev,
                    { rowId: nextRowId(), kind: 'employee', id: '', label: null },
                  ])
                }
              >
                Add rule
              </Button>
            </div>

            {formError ? (
              <div className="mt-3">
                <Alert tone="danger" role="alert">
                  {formError}
                </Alert>
              </div>
            ) : null}
          </div>

          <DrawerFooter>
            <Button type="button" variant="ghost" iconLeft={X} disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            {view ? (
              <Button
                type="button"
                variant="danger"
                iconLeft={Trash2}
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                Delete
              </Button>
            ) : null}
            <Button type="submit" variant="primary" loading={pending} disabled={deleting}>
              {mode === 'create' ? 'Create structure' : 'Save changes'}
            </Button>
          </DrawerFooter>
        </form>

        <AlertDialog
          open={confirmDelete}
          onOpenChange={(next) => !next && !deleting && setConfirmDelete(false)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this structure?</AlertDialogTitle>
              <AlertDialogDescription>
                {view?.doc.name} is removed permanently. Employees pointing at
                it will be skipped by payroll compute until they are re-mapped.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="secondary" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <Button variant="danger" loading={deleting} onClick={() => void remove()}>
                Delete structure
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DrawerContent>
    </Drawer>
  );
}

/* ─── List client ─────────────────────────────────────────────── */

export interface SalaryStructuresClientProps {
  initialRows: SabcrmSalaryStructureListRow[];
  initialHasMore: boolean;
  initialError: string | null;
  /** `?open=<id>` deep link — opens the edit drawer. */
  initialOpenId: string | null;
}

export function SalaryStructuresClient({
  initialRows,
  initialHasMore,
  initialError,
  initialOpenId,
}: SalaryStructuresClientProps): React.JSX.Element {
  const router = useRouter();
  const [refreshToken, setRefreshToken] = React.useState(0);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SabcrmSalaryStructureView | null>(
    null,
  );

  // Deep link / row navigation: `?open=<id>` → load + open the drawer.
  React.useEffect(() => {
    if (!initialOpenId) return;
    let stale = false;
    void (async () => {
      const res = await getSabcrmSalaryStructure(initialOpenId);
      if (stale) return;
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditing(res.data);
      setEditorOpen(true);
    })();
    return () => {
      stale = true;
    };
  }, [initialOpenId]);

  const closeEditor = React.useCallback(() => {
    setEditorOpen(false);
    setEditing(null);
    if (initialOpenId) router.replace(SALARY_STRUCTURES_PATH, { scroll: false });
  }, [initialOpenId, router]);

  const onSaved = React.useCallback(() => {
    setRefreshToken((t) => t + 1);
    closeEditor();
    router.refresh();
  }, [closeEditor, router]);

  const config = React.useMemo<
    DocListPageConfig<SabcrmSalaryStructureListRow>
  >(
    () => ({
      title: 'Salary structures',
      description:
        'The component stacks payroll compute resolves — earnings, deductions, formulas, caps and who they apply to.',
      icon: Layers,
      entity: { singular: 'salary structure', plural: 'salary structures' },
      columns: COLUMNS,
      statuses: SALARY_STRUCTURE_STATUSES,
      fetchPage: async (filters) => {
        const res = await listSabcrmSalaryStructuresPage(
          toStructureFilters(filters),
        );
        return res.ok
          ? { ok: true, data: { rows: res.data.rows, hasMore: res.data.hasMore } }
          : res;
      },
      fetchAllForCsv: (filters) =>
        exportSabcrmSalaryStructureRows(toStructureFilters(filters)),
      csvFileName: 'salary-structures.csv',
      rowHref: (row) => structureOpenHref(row.id),
      rowLabel: (row) => `salary structure ${row.name}`,
      bulkActions: [
        {
          key: 'delete',
          label: 'Delete',
          icon: Trash2,
          tone: 'danger',
          confirm: {
            title: 'Delete the selected structures?',
            description:
              'Employees pointing at a deleted structure are skipped by payroll compute until re-mapped. This action cannot be undone.',
            actionLabel: 'Delete structures',
          },
          run: async (rows) => {
            for (const row of rows) {
              const res = await deleteSabcrmSalaryStructure(row.id);
              if (!res.ok) return res;
            }
            return { ok: true, data: null };
          },
        },
      ],
    }),
    [],
  );

  return (
    <>
      <DocListPage
        config={config}
        primaryAction={
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            New structure
          </Button>
        }
        initialRows={initialRows}
        initialHasMore={initialHasMore}
        initialError={initialError}
        refreshToken={refreshToken}
      />
      <StructureEditorDrawer
        open={editorOpen}
        view={editing}
        onClose={closeEditor}
        onSaved={onSaved}
      />
    </>
  );
}

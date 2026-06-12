'use client';

/**
 * SabCRM Finance — budget form dialog (spec §3.16).
 *
 * Full-field create/edit dialog shared by the list client (New) and the
 * detail client (Edit): head, department, period, planned amount,
 * currency, notes — and in edit mode "record actuals"
 * (`actualAmount`). Budgets are born `draft` (the crate's create DTO
 * has no status); the approval audit trail renders read-only in the
 * footer when present (its fields are not writable on this mount —
 * Rust gap).
 */

import * as React from 'react';

import {
  Alert,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SelectField,
  Textarea,
  toast,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { safeNum } from '@/lib/sabcrm/finance-doc-math';

import { formatDocDate } from '../_components/doc-surface';
import {
  createSabcrmBudgetFull,
  updateSabcrmBudgetFull,
} from '@/app/actions/sabcrm-finance-budgets.actions';
import type { SabcrmBudgetDoc } from '@/lib/rust-client/sabcrm-finance';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

/** Suggested period keys: current FY + the last 3 months. */
function periodSuggestions(): SelectOption[] {
  const now = new Date();
  const y = now.getFullYear();
  const fyStart = now.getMonth() + 1 >= 4 ? y : y - 1;
  const out: SelectOption[] = [
    {
      value: `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`,
      label: `FY ${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`,
    },
  ];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date(y, now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ value: key, label: key });
  }
  return out;
}

/* ─── Component ───────────────────────────────────────────────── */

export interface BudgetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Edit mode — the budget being edited (extended-JSON deflated). */
  initial?: SabcrmBudgetDoc | null;
  /** Fired after a successful save (parent refetches). */
  onDone: () => void;
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onDone,
}: BudgetFormDialogProps): React.JSX.Element {
  const [head, setHead] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [period, setPeriod] = React.useState('');
  const [planned, setPlanned] = React.useState('');
  const [actual, setActual] = React.useState('');
  const [currency, setCurrency] = React.useState<string | null>('INR');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const suggestions = React.useMemo(periodSuggestions, []);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && initial) {
      setHead(initial.budgetHead ?? '');
      setDepartment(initial.department ?? '');
      setPeriod(initial.period ?? '');
      setPlanned(String(initial.plannedAmount ?? ''));
      setActual(
        initial.actualAmount !== undefined && initial.actualAmount !== null
          ? String(initial.actualAmount)
          : '',
      );
      setCurrency(initial.currency || 'INR');
      setNotes(initial.notes ?? '');
      return;
    }
    setHead('');
    setDepartment('');
    setPeriod(suggestions[0]?.value ?? '');
    setPlanned('');
    setActual('');
    setCurrency('INR');
    setNotes('');
  }, [open, mode, initial, suggestions]);

  const submit = (): void => {
    if (!head.trim()) {
      setError('A budget head is required.');
      return;
    }
    if (!period.trim()) {
      setError('A period is required (e.g. FY 2026-27 or 2026-06).');
      return;
    }
    const plannedAmount = safeNum(planned);
    if (planned.trim() === '' || plannedAmount < 0) {
      setError('Planned amount must be a non-negative number.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const base = {
        budgetHead: head,
        department: department || undefined,
        period,
        plannedAmount,
        currency: currency ?? 'INR',
        notes: notes || undefined,
      };
      const res =
        mode === 'create'
          ? await createSabcrmBudgetFull(base)
          : await updateSabcrmBudgetFull(initial?._id ?? '', {
              ...base,
              ...(actual.trim() !== ''
                ? { actualAmount: safeNum(actual) }
                : {}),
            });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        mode === 'create'
          ? `Budget "${res.data.budgetHead}" created as draft.`
          : `Budget "${res.data.budgetHead}" updated.`,
      );
      onOpenChange(false);
      onDone();
    });
  };

  const audit: { label: string; value: string }[] =
    mode === 'edit' && initial
      ? [
          ...(initial.approvedAt
            ? [
                {
                  label: 'Approved',
                  value: `${formatDocDate(initial.approvedAt)}${initial.approvedBy ? ' · on record' : ''}`,
                },
              ]
            : []),
          ...(initial.lockedAt
            ? [{ label: 'Locked', value: formatDocDate(initial.lockedAt) }]
            : []),
          ...(initial.rejectedAt
            ? [
                {
                  label: 'Rejected',
                  value: `${formatDocDate(initial.rejectedAt)}${initial.rejectReason ? ` — ${initial.rejectReason}` : ''}`,
                },
              ]
            : []),
        ]
      : [];

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="budget-form-desc">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New budget' : 'Edit budget'}
          </DialogTitle>
          <DialogDescription id="budget-form-desc">
            {mode === 'create'
              ? 'Plan spend for a head and period — budgets start as drafts and go through approval.'
              : 'Update the budget figures. Status changes go through the approval workflow actions.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pb-2 pt-1">
            <Field label="Budget head" required>
              <Input
                value={head}
                onChange={(e) => setHead(e.target.value)}
                placeholder="Marketing"
                disabled={pending}
                autoFocus={mode === 'create'}
              />
            </Field>

            <Field label="Department">
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Growth"
                disabled={pending}
              />
            </Field>

            <Field
              label="Period"
              required
              help="Financial year (FY 2026-27) or month (2026-06)."
            >
              <Input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder={suggestions[0]?.value ?? 'FY 2026-27'}
                list="budget-period-suggestions"
                disabled={pending}
              />
              <datalist id="budget-period-suggestions">
                {suggestions.map((s) => (
                  <option key={s.value} value={s.value} />
                ))}
              </datalist>
            </Field>

            <Field label="Planned amount" required>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={planned}
                onChange={(e) => setPlanned(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </Field>

            {mode === 'edit' ? (
              <Field
                label="Actual amount"
                help="Record actuals against the plan."
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={actual}
                  onChange={(e) => setActual(e.target.value)}
                  placeholder="0.00"
                  disabled={pending}
                />
              </Field>
            ) : null}

            <Field label="Currency">
              <SelectField
                value={currency}
                onChange={setCurrency}
                options={CURRENCY_OPTIONS}
                disabled={pending}
              />
            </Field>

            <Field label="Notes">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Includes the Q3 campaign."
                disabled={pending}
              />
            </Field>

            {audit.length > 0 ? (
              <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] px-3 py-2">
                {audit.map((a) => (
                  <p
                    key={a.label}
                    className="m-0 text-xs text-[var(--st-text-secondary)]"
                  >
                    <span className="font-medium">{a.label}:</span> {a.value}
                  </p>
                ))}
              </div>
            ) : null}

            {error ? (
              <Alert tone="danger" role="alert">
                {error}
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {mode === 'create' ? 'Create budget' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

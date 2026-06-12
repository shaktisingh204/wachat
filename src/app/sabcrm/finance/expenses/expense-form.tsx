'use client';

/**
 * SabCRM Finance — expense-claim form dialog (spec §3.12).
 *
 * Full-field create/edit dialog shared by the list client (New) and the
 * detail client (Edit):
 *
 *   - claim number (auto-suggested `EC-YYYYMM-NNNN`, overridable; left
 *     blank ⇒ the crate generates one);
 *   - employee: REAL records-engine person picker, with a free-text
 *     fallback for non-CRM employees (never a minted placeholder id);
 *   - free-text category (no expense-categories mount yet — Rust gap
 *     G5), amount, currency, expense date, description;
 *   - receipt via `<SabFileUrlInput>` (SabFiles library/upload only);
 *   - initial status (create mode only — afterwards the workflow
 *     transitions own status changes).
 */

import * as React from 'react';

import {
  Alert,
  Button,
  DatePicker,
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
import { SabFileUrlInput } from '@/components/sabfiles';
import { safeNum } from '@/lib/sabcrm/finance-doc-math';

import { EntityPicker } from '../_components/doc-surface';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  createSabcrmExpenseFull,
  getNextSabcrmExpenseClaimNumber,
  updateSabcrmExpenseFull,
} from '@/app/actions/sabcrm-finance-expenses.actions';
import type { SabcrmExpenseClaimDoc } from '@/lib/rust-client/sabcrm-finance';
import type { CrmExpenseClaimStatus } from '@/lib/rust-client/crm-expense-claims';

/* ─── Options ─────────────────────────────────────────────────── */

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

const CREATE_STATUS_OPTIONS: SelectOption[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted for approval' },
];

/** People-only party search (employees are person records). */
async function searchEmployees(q: string) {
  const res = await searchSabcrmFinanceParties(q);
  if (!res.ok) return [];
  return res.data
    .filter((p) => p.objectSlug === 'people')
    .map((p) => ({ id: p.id, label: p.label, meta: p.meta }));
}

const isRecordId = (s: string): boolean => /^[0-9a-fA-F]{24}$/.test(s);

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function keyToDate(key: string): Date | undefined {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToKey(d: Date | undefined): string {
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ─── Component ───────────────────────────────────────────────── */

export interface ExpenseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Edit mode — the claim being edited (extended-JSON deflated). */
  initial?: SabcrmExpenseClaimDoc | null;
  /** Fired after a successful save (parent refetches). */
  onDone: () => void;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onDone,
}: ExpenseFormDialogProps): React.JSX.Element {
  const [claimNumber, setClaimNumber] = React.useState('');
  const [employeeId, setEmployeeId] = React.useState<string | null>(null);
  const [employeeLabel, setEmployeeLabel] = React.useState<string | null>(null);
  const [employeeFreeText, setEmployeeFreeText] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [currency, setCurrency] = React.useState<string | null>('INR');
  const [date, setDate] = React.useState(todayKey());
  const [description, setDescription] = React.useState('');
  const [receiptUrl, setReceiptUrl] = React.useState('');
  const [receiptName, setReceiptName] = React.useState('');
  const [status, setStatus] = React.useState<string | null>('draft');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Reset + seed on open.
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && initial) {
      setClaimNumber(initial.claim_number ?? '');
      const picked = isRecordId(initial.employee_id);
      setEmployeeId(picked ? initial.employee_id : null);
      setEmployeeLabel(picked ? (initial.employee_name ?? null) : null);
      setEmployeeFreeText(
        picked ? '' : initial.employee_name || initial.employee_id || '',
      );
      setCategory(initial.category_name ?? '');
      setAmount(String(initial.amount ?? ''));
      setCurrency(initial.currency || 'INR');
      setDate((initial.expense_date ?? '').slice(0, 10) || todayKey());
      setDescription(initial.description ?? '');
      setReceiptUrl(initial.receipt_url ?? '');
      setReceiptName(initial.receipt_name ?? '');
      setStatus(initial.status ?? 'draft');
      return;
    }
    setClaimNumber('');
    setEmployeeId(null);
    setEmployeeLabel(null);
    setEmployeeFreeText('');
    setCategory('');
    setAmount('');
    setCurrency('INR');
    setDate(todayKey());
    setDescription('');
    setReceiptUrl('');
    setReceiptName('');
    setStatus('draft');
    // Suggest the next claim number (overridable; blank ⇒ server picks).
    let cancelled = false;
    void getNextSabcrmExpenseClaimNumber().then((res) => {
      if (cancelled || !res.ok) return;
      setClaimNumber((prev) => (prev.trim() ? prev : res.data));
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, initial]);

  const submit = (): void => {
    const parsedAmount = safeNum(amount);
    if (parsedAmount <= 0) {
      setError('Claim amount must be greater than zero.');
      return;
    }
    if (!employeeId && !employeeFreeText.trim()) {
      setError('Pick an employee, or type a name for a non-CRM employee.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
        claimNumber: claimNumber.trim() || undefined,
        employeeId: employeeId ?? employeeFreeText.trim(),
        employeeName: employeeId
          ? (employeeLabel ?? undefined)
          : employeeFreeText.trim(),
        categoryName: category || undefined,
        amount: parsedAmount,
        currency: currency ?? 'INR',
        expenseDate: date || undefined,
        description: description || undefined,
        receiptUrl: receiptUrl || undefined,
        receiptName: receiptName || undefined,
      };
      const res =
        mode === 'create'
          ? await createSabcrmExpenseFull({
              ...payload,
              status: (status ?? 'draft') as CrmExpenseClaimStatus,
            })
          : await updateSabcrmExpenseFull(initial?._id ?? '', payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        mode === 'create'
          ? `${res.data.claim_number} ${status === 'submitted' ? 'submitted' : 'saved as draft'}.`
          : `${res.data.claim_number} updated.`,
      );
      onOpenChange(false);
      onDone();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="expense-form-desc">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New expense claim' : 'Edit expense claim'}
          </DialogTitle>
          <DialogDescription id="expense-form-desc">
            {mode === 'create'
              ? 'Record an employee expense — attach the receipt from SabFiles and submit it for approval.'
              : 'Update the claim details. Status changes go through the approval workflow actions.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pb-2 pt-1">
            <Field
              label="Claim number"
              help="Leave blank to auto-number (EC-YYYYMM-NNNN)."
            >
              <Input
                value={claimNumber}
                onChange={(e) => setClaimNumber(e.target.value)}
                placeholder="EC-202606-0001"
                disabled={pending}
              />
            </Field>

            <Field label="Employee" required>
              <EntityPicker
                value={employeeId}
                valueLabel={employeeLabel}
                search={searchEmployees}
                placeholder="Search people…"
                disabled={pending}
                invalid={!!error && !employeeId && !employeeFreeText.trim()}
                onChange={(opt) => {
                  setEmployeeId(opt?.id ?? null);
                  setEmployeeLabel(opt?.label ?? null);
                  if (opt) setEmployeeFreeText('');
                }}
              />
            </Field>

            {!employeeId ? (
              <Field
                label="Or employee name"
                help="For employees without a CRM record."
              >
                <Input
                  value={employeeFreeText}
                  onChange={(e) => setEmployeeFreeText(e.target.value)}
                  placeholder="Asha Patel"
                  disabled={pending}
                />
              </Field>
            ) : null}

            <Field label="Category" help="Free text — e.g. Travel, Meals.">
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Travel"
                disabled={pending}
              />
            </Field>

            <Field label="Amount" required>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </Field>

            <Field label="Currency">
              <SelectField
                value={currency}
                onChange={setCurrency}
                options={CURRENCY_OPTIONS}
                disabled={pending}
              />
            </Field>

            <Field label="Expense date">
              <DatePicker
                value={keyToDate(date)}
                onChange={(d) => setDate(dateToKey(d))}
                placeholder="Pick a date"
                disabled={pending}
                aria-label="Expense date"
              />
            </Field>

            <Field label="Description">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Client visit — airport taxi both ways."
                disabled={pending}
              />
            </Field>

            <Field
              label="Receipt"
              help="Files live in SabFiles — pick from the library or upload."
            >
              <SabFileUrlInput
                value={receiptUrl}
                onChange={(value, pick) => {
                  setReceiptUrl(value);
                  setReceiptName(pick?.name ?? '');
                }}
                accept="all"
                pickerTitle="Pick a receipt"
                disabled={pending}
              />
            </Field>

            {mode === 'create' ? (
              <Field label="Initial status">
                <SelectField
                  value={status}
                  onChange={setStatus}
                  options={CREATE_STATUS_OPTIONS}
                  disabled={pending}
                />
              </Field>
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
              {mode === 'create' ? 'Save claim' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

'use client';

/**
 * SabCRM Finance — petty-cash float form dialog (spec §3.15).
 *
 * Full-field create/edit dialog shared by the list client (New) and the
 * detail client (Edit): branch, custodian (REAL person picker with a
 * free-text fallback — both `custodianId` + `custodianName` are written
 * on a pick), opening balance, currency and notes. `currentBalance` is
 * system-managed and rendered read-only in edit mode.
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

import { EntityPicker, formatDocMoney } from '../_components/doc-surface';
import { searchSabcrmFinanceParties } from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  createSabcrmPettyCashFull,
  updateSabcrmPettyCashFull,
} from '@/app/actions/sabcrm-finance-petty-cash.actions';
import type { SabcrmPettyCashFloatDoc } from '@/lib/rust-client/sabcrm-finance';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

/** People-only party search (custodians are person records). */
async function searchCustodians(q: string) {
  const res = await searchSabcrmFinanceParties(q);
  if (!res.ok) return [];
  return res.data
    .filter((p) => p.objectSlug === 'people')
    .map((p) => ({ id: p.id, label: p.label, meta: p.meta }));
}

const isRecordId = (s: string | undefined): boolean =>
  !!s && /^[0-9a-fA-F]{24}$/.test(s);

/* ─── Component ───────────────────────────────────────────────── */

export interface PettyCashFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Edit mode — the float being edited (extended-JSON deflated). */
  initial?: SabcrmPettyCashFloatDoc | null;
  /** Fired after a successful save (parent refetches). */
  onDone: () => void;
}

export function PettyCashFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  onDone,
}: PettyCashFormDialogProps): React.JSX.Element {
  const [branch, setBranch] = React.useState('');
  const [custodianId, setCustodianId] = React.useState<string | null>(null);
  const [custodianLabel, setCustodianLabel] = React.useState<string | null>(
    null,
  );
  const [custodianFreeText, setCustodianFreeText] = React.useState('');
  const [openingBalance, setOpeningBalance] = React.useState('');
  const [currency, setCurrency] = React.useState<string | null>('INR');
  const [notes, setNotes] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && initial) {
      setBranch(initial.branchName ?? '');
      const picked = isRecordId(initial.custodianId);
      setCustodianId(picked ? (initial.custodianId ?? null) : null);
      setCustodianLabel(picked ? (initial.custodianName ?? null) : null);
      setCustodianFreeText(picked ? '' : (initial.custodianName ?? ''));
      setOpeningBalance(String(initial.openingBalance ?? ''));
      setCurrency(initial.currency || 'INR');
      setNotes(initial.notes ?? '');
      return;
    }
    setBranch('');
    setCustodianId(null);
    setCustodianLabel(null);
    setCustodianFreeText('');
    setOpeningBalance('');
    setCurrency('INR');
    setNotes('');
  }, [open, mode, initial]);

  const submit = (): void => {
    const opening = safeNum(openingBalance);
    if (!Number.isFinite(opening) || opening < 0 || openingBalance.trim() === '') {
      setError('Opening balance must be a non-negative number.');
      return;
    }
    if (!branch.trim() && !custodianId && !custodianFreeText.trim()) {
      setError('Give the float a branch or a custodian so it stays identifiable.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const payload = {
        branchName: branch || undefined,
        custodianId: custodianId ?? undefined,
        custodianName: custodianId
          ? (custodianLabel ?? undefined)
          : custodianFreeText.trim() || undefined,
        openingBalance: opening,
        currency: currency ?? 'INR',
        notes: notes || undefined,
      };
      const res =
        mode === 'create'
          ? await createSabcrmPettyCashFull(payload)
          : await updateSabcrmPettyCashFull(initial?._id ?? '', payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      toast.success(
        mode === 'create' ? 'Petty cash float created.' : 'Float updated.',
      );
      onOpenChange(false);
      onDone();
    });
  };

  const currentBalance =
    mode === 'edit' && initial
      ? (initial.currentBalance ?? initial.openingBalance ?? 0)
      : null;

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent aria-describedby="petty-form-desc">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'New petty cash float' : 'Edit petty cash float'}
          </DialogTitle>
          <DialogDescription id="petty-form-desc">
            {mode === 'create'
              ? 'Set up a cash float for a branch with a custodian and an opening balance.'
              : 'Update the float details. The current balance is managed by petty-cash vouchers.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pb-2 pt-1">
            <Field label="Branch">
              <Input
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="Head office"
                disabled={pending}
              />
            </Field>

            <Field label="Custodian">
              <EntityPicker
                value={custodianId}
                valueLabel={custodianLabel}
                search={searchCustodians}
                placeholder="Search people…"
                disabled={pending}
                onChange={(opt) => {
                  setCustodianId(opt?.id ?? null);
                  setCustodianLabel(opt?.label ?? null);
                  if (opt) setCustodianFreeText('');
                }}
              />
            </Field>

            {!custodianId ? (
              <Field
                label="Or custodian name"
                help="For custodians without a CRM record."
              >
                <Input
                  value={custodianFreeText}
                  onChange={(e) => setCustodianFreeText(e.target.value)}
                  placeholder="Asha Patel"
                  disabled={pending}
                />
              </Field>
            ) : null}

            <Field label="Opening balance" required>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                disabled={pending}
              />
            </Field>

            {currentBalance !== null ? (
              <Field
                label="Current balance"
                help="System-managed — drained and topped up by petty-cash vouchers."
              >
                <Input
                  value={formatDocMoney(
                    currentBalance,
                    initial?.currency || 'INR',
                  )}
                  readOnly
                  disabled
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
                placeholder="Replenished monthly."
                disabled={pending}
              />
            </Field>

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
              {mode === 'create' ? 'Create float' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

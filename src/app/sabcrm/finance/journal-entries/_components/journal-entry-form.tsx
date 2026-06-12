'use client';

/**
 * SabCRM Finance — journal-entry form (page-local, spec §3.14).
 *
 * The FULL multi-leg create/edit form in a right-side 20ui Drawer
 * (same shell as the kit's DocForm, but voucher-shaped — there is no
 * party/line-items section here):
 *
 *   - voucher book Select (real books only; the default Journal book
 *     is seeded server-side when none exists);
 *   - voucher number (auto-suggested from the picked book's
 *     prefix/counter, always overridable);
 *   - entry date, reference, narration;
 *   - the kit's `JournalLinesEditor` (debit/credit leg tables over the
 *     chart of accounts, live balanced/unbalanced badge — the same
 *     ±0.01 rule the Rust handler enforces);
 *   - Save draft / Save & post (create), Save changes (draft edit).
 */

import * as React from 'react';
import { X } from 'lucide-react';

import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  SelectField,
  Textarea,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { round2, safeNum } from '@/lib/sabcrm/finance-doc-math';

import {
  JournalLinesEditor,
  blankJournalLeg,
  type JournalLeg,
} from '../../_components/doc-surface';
import type { DocEntityOption } from '../../_components/doc-surface/types';

/* ─── Values ──────────────────────────────────────────────────── */

export interface JournalEntryFormValues {
  voucherBookId: string | null;
  voucherNumber: string;
  /** `YYYY-MM-DD`. */
  date: string;
  reference: string;
  narration: string;
  debits: JournalLeg[];
  credits: JournalLeg[];
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function emptyJournalEntryValues(): JournalEntryFormValues {
  return {
    voucherBookId: null,
    voucherNumber: '',
    date: todayKey(),
    reference: '',
    narration: '',
    debits: [blankJournalLeg()],
    credits: [blankJournalLeg()],
  };
}

/** `YYYY-MM-DD` ⇄ local `Date` for the DatePicker. */
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

/** A leg counts when an account is picked or money was typed. */
function meaningfulLegs(legs: JournalLeg[]): JournalLeg[] {
  return legs.filter((l) => l.accountId || safeNum(l.amount) > 0);
}

function legsTotal(legs: JournalLeg[]): number {
  return round2(legs.reduce((sum, l) => sum + safeNum(l.amount), 0));
}

/* ─── Component ───────────────────────────────────────────────── */

export interface JournalEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Active voucher books (Select options; label = name, meta = type). */
  bookOptions: DocEntityOption[];
  /** Ledger-account search for the leg pickers (chart of accounts). */
  searchAccounts: (q: string) => Promise<DocEntityOption[]>;
  /** Book-aware number suggestion (create mode). */
  suggestNumber?: (voucherBookId: string | null) => Promise<string | null>;
  /** Seed values (edit mode, or a "book" deep-link prefill). */
  initialValues?: JournalEntryFormValues;
  /**
   * Persists the form. `post` is true for the "Save & post" button.
   * Resolve `{ ok: false, error }` to keep the drawer open.
   */
  onSubmit: (
    values: JournalEntryFormValues,
    opts: { post: boolean },
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function JournalEntryForm({
  open,
  onOpenChange,
  mode,
  bookOptions,
  searchAccounts,
  suggestNumber,
  initialValues,
  onSubmit,
}: JournalEntryFormProps): React.JSX.Element {
  const [values, setValues] = React.useState<JournalEntryFormValues>(
    () => initialValues ?? emptyJournalEntryValues(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<false | 'draft' | 'post'>(false);
  const numberTouched = React.useRef(false);

  const patch = (p: Partial<JournalEntryFormValues>): void =>
    setValues((v) => ({ ...v, ...p }));

  // Reset + (re)seed when the drawer opens.
  React.useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? emptyJournalEntryValues());
    setError(null);
    numberTouched.current = Boolean(initialValues?.voucherNumber?.trim());
  }, [open, initialValues]);

  // Default book: first journal book, else the first book.
  React.useEffect(() => {
    if (!open || mode !== 'create') return;
    setValues((v) => {
      if (v.voucherBookId) return v;
      const journal = bookOptions.find((b) => b.meta === 'journal');
      const fallback = journal ?? bookOptions[0];
      return fallback ? { ...v, voucherBookId: fallback.id } : v;
    });
  }, [open, mode, bookOptions]);

  // Auto-numbering: re-suggest whenever the book changes, unless the
  // user already typed a number.
  const bookId = values.voucherBookId;
  React.useEffect(() => {
    if (!open || mode !== 'create' || !suggestNumber) return;
    if (numberTouched.current) return;
    let cancelled = false;
    void suggestNumber(bookId).then((suggestion) => {
      if (cancelled || !suggestion) return;
      setValues((v) =>
        numberTouched.current ? v : { ...v, voucherNumber: suggestion },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, bookId, suggestNumber]);

  const validate = (): string | null => {
    if (!values.voucherBookId) return 'Pick a voucher book.';
    if (!values.voucherNumber.trim()) return 'A voucher number is required.';
    if (!values.date) return 'An entry date is required.';
    const debits = meaningfulLegs(values.debits);
    const credits = meaningfulLegs(values.credits);
    if (debits.length === 0) return 'Add at least one debit line.';
    if (credits.length === 0) return 'Add at least one credit line.';
    if (debits.some((l) => !l.accountId)) {
      return 'Pick a ledger account on every debit line.';
    }
    if (credits.some((l) => !l.accountId)) {
      return 'Pick a ledger account on every credit line.';
    }
    if (
      debits.some((l) => safeNum(l.amount) <= 0) ||
      credits.some((l) => safeNum(l.amount) <= 0)
    ) {
      return 'Every line needs an amount above zero.';
    }
    const dr = legsTotal(debits);
    const cr = legsTotal(credits);
    if (Math.abs(dr - cr) >= 0.01) {
      return `The entry doesn't balance — debits ${dr.toFixed(2)} vs credits ${cr.toFixed(2)}.`;
    }
    return null;
  };

  const submit = async (post: boolean): Promise<void> => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPending(post ? 'post' : 'draft');
    try {
      const res = await onSubmit(
        {
          ...values,
          debits: meaningfulLegs(values.debits),
          credits: meaningfulLegs(values.credits),
        },
        { post },
      );
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  const bookSelectOptions: SelectOption[] = bookOptions.map((b) => ({
    value: b.id,
    label: b.meta ? `${b.label} (${b.meta})` : b.label,
  }));

  const busy = pending !== false;

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !busy && onOpenChange(next)}
      side="right"
    >
      <DrawerContent
        aria-describedby="journal-entry-form-desc"
        className="fdoc-form-drawer"
      >
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create' ? 'New journal entry' : 'Edit journal entry'}
          </DrawerTitle>
          <DrawerDescription id="journal-entry-form-desc">
            {mode === 'create'
              ? 'Pick a voucher book, add balanced debit and credit legs, then save as a draft or post it right away.'
              : 'Update the draft entry. Posted entries are immutable.'}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="fdoc-form-grid">
              <Field label="Voucher book" required>
                <SelectField
                  value={values.voucherBookId}
                  onChange={(v) => patch({ voucherBookId: v })}
                  options={bookSelectOptions}
                  placeholder="Pick a book"
                  disabled={busy}
                />
              </Field>

              <Field label="Voucher number" required>
                <Input
                  value={values.voucherNumber}
                  onChange={(e) => {
                    numberTouched.current = true;
                    patch({ voucherNumber: e.target.value });
                  }}
                  placeholder="JV-0001"
                  disabled={busy}
                />
              </Field>

              <Field label="Entry date" required>
                <DatePicker
                  value={keyToDate(values.date)}
                  onChange={(d) => patch({ date: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label="Entry date"
                />
              </Field>

              <Field label="Reference" help="Cheque no, bill no, …">
                <Input
                  value={values.reference}
                  onChange={(e) => patch({ reference: e.target.value })}
                  placeholder="Optional reference"
                  disabled={busy}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field label="Debit / credit legs" required>
                  <JournalLinesEditor
                    debits={values.debits}
                    credits={values.credits}
                    onChange={({ debits, credits }) =>
                      patch({ debits, credits })
                    }
                    searchAccounts={searchAccounts}
                    currency="INR"
                    disabled={busy}
                  />
                </Field>
              </div>

              <div className="fdoc-form-grid__full">
                <Field label="Narration">
                  <Textarea
                    value={values.narration}
                    onChange={(e) => patch({ narration: e.target.value })}
                    rows={3}
                    placeholder="Being rent for June paid by cheque…"
                    disabled={busy}
                  />
                </Field>
              </div>
            </div>

            {error ? (
              <div className="mt-3">
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              </div>
            ) : null}
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="ghost"
              iconLeft={X}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={pending === 'draft'}
              disabled={pending === 'post'}
            >
              {mode === 'create' ? 'Save draft' : 'Save changes'}
            </Button>
            {mode === 'create' ? (
              <Button
                type="button"
                variant="primary"
                loading={pending === 'post'}
                disabled={pending === 'draft'}
                onClick={() => void submit(true)}
              >
                Save & post
              </Button>
            ) : null}
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}

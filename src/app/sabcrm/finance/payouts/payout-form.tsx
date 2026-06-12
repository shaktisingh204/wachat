'use client';

/**
 * SabCRM Finance — shared payout DocForm wiring (spec §3.8).
 *
 * The payout form is the receipt form's vendor-side mirror: no line
 * items, no due date, no payment terms — the money lives in
 * `extraFields` (amount, rail, bank account, rail-specific references,
 * TDS withheld, excess-as-advance) plus an AllocationsEditor over OPEN
 * bills. Used by both the list client (create) and the detail client
 * (edit), so the config/builders live here once.
 */

import * as React from 'react';

import {
  DatePicker,
  Field,
  Input,
  SelectField,
  Switch,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { safeNum } from '@/lib/sabcrm/finance-doc-math';

import {
  AllocationsEditor,
  blankAllocationRow,
  emptyDocFormValues,
  type AllocationRow,
  type DocFormConfig,
  type DocFormValues,
} from '../_components/doc-surface';
import {
  searchSabcrmFinanceBillRefs,
  searchSabcrmFinanceVendors,
} from '@/app/actions/sabcrm-finance-pickers.actions';
import { getNextSabcrmPayoutNumber } from '@/app/actions/sabcrm-finance-payouts.actions';
import {
  SABCRM_PAYOUT_MODES,
  SABCRM_PAYOUT_TXN_MODES,
  type SabcrmPayoutFullInput,
} from '@/app/actions/sabcrm-finance-payouts.actions.types';
import type {
  CrmPayoutDoc,
  CrmPayoutMode,
} from '@/lib/rust-client/crm-payouts';
import type { SabcrmPaymentAccountOption } from '@/app/actions/sabcrm-finance-invoices.actions.types';

/* ─── Extras bag (round-trips through DocFormValues.extras) ────── */

export interface PayoutExtras extends Record<string, unknown> {
  mode: CrmPayoutMode;
  bankAccountId: string | null;
  /** Text-input backed amount (parsed on submit). */
  amount: string;
  chequeNo: string;
  /** `YYYY-MM-DD`. */
  chequeDate: string;
  txnId: string;
  reference: string;
  /** Text-input backed TDS withheld (parsed on submit). */
  tdsDeducted: string;
  excessAsAdvance: boolean;
  allocations: AllocationRow[];
}

const DEFAULT_EXTRAS: PayoutExtras = {
  mode: 'neft',
  bankAccountId: null,
  amount: '',
  chequeNo: '',
  chequeDate: '',
  txnId: '',
  reference: '',
  tdsDeducted: '',
  excessAsAdvance: false,
  allocations: [],
};

/** Typed read of the form's extras bag (kit stores it untyped). */
export function readPayoutExtras(values: DocFormValues): PayoutExtras {
  return { ...DEFAULT_EXTRAS, ...(values.extras as Partial<PayoutExtras>) };
}

/* ─── `YYYY-MM-DD` ⇄ local Date (for the cheque DatePicker) ────── */

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

/* ─── Seeds ───────────────────────────────────────────────────── */

/** Fresh create-mode values (one blank allocation row). */
export function emptyPayoutFormValues(): DocFormValues {
  return {
    ...emptyDocFormValues(),
    extras: { ...DEFAULT_EXTRAS, allocations: [blankAllocationRow()] },
  };
}

/**
 * Doc → DocForm seed for edit mode. Allocation rows carry the RESOLVED
 * bill labels (from the detail context) so re-opened forms never show
 * an ObjectId.
 */
export function payoutDocToFormValues(
  doc: CrmPayoutDoc,
  vendorLabel: string | null,
  billLabels: Map<string, string | null>,
): DocFormValues {
  const allocations: AllocationRow[] = (doc.applyTo ?? []).map((row, i) => ({
    rowId: `seed-${i}`,
    docId: row.billId,
    docLabel: billLabels.get(row.billId) ?? null,
    amount: row.amount,
  }));
  const extras: PayoutExtras = {
    mode: doc.mode,
    bankAccountId: doc.bankAccountId || null,
    amount: String(doc.amount ?? ''),
    chequeNo: doc.chequeNo ?? '',
    chequeDate: (doc.chequeDate ?? '').slice(0, 10),
    txnId: doc.txnId ?? '',
    reference: doc.reference ?? '',
    tdsDeducted:
      doc.tdsDeducted !== undefined && doc.tdsDeducted !== null
        ? String(doc.tdsDeducted)
        : '',
    excessAsAdvance: !!doc.excessAsAdvance,
    allocations:
      allocations.length > 0 ? allocations : [blankAllocationRow()],
  };
  return {
    ...emptyDocFormValues(),
    number: doc.paymentNo,
    partyId: doc.vendorId || null,
    partyLabel: vendorLabel,
    currency: doc.currency || 'INR',
    date: (doc.date ?? '').slice(0, 10),
    customerNotes: doc.notes ?? '',
    extras,
  };
}

/* ─── Submit mapping ──────────────────────────────────────────── */

/**
 * DocFormValues → full action input. Returns an error string for the
 * extras-level rules the kit can't validate (amount / mode / account).
 */
export function payoutFormToInput(
  values: DocFormValues,
):
  | { ok: true; input: SabcrmPayoutFullInput }
  | { ok: false; error: string } {
  const extras = readPayoutExtras(values);
  const amount = safeNum(extras.amount);
  if (amount <= 0) {
    return { ok: false, error: 'Payout amount must be greater than zero.' };
  }
  if (!extras.bankAccountId) {
    return {
      ok: false,
      error: 'Pick the account this payout was paid from.',
    };
  }
  const tds = extras.tdsDeducted.trim()
    ? safeNum(extras.tdsDeducted)
    : undefined;
  return {
    ok: true,
    input: {
      paymentNo: values.number,
      date: values.date,
      vendorId: values.partyId ?? '',
      mode: extras.mode,
      bankAccountId: extras.bankAccountId,
      amount,
      currency: values.currency,
      chequeNo: extras.chequeNo || undefined,
      chequeDate: extras.chequeDate || undefined,
      txnId: extras.txnId || undefined,
      reference: extras.reference || undefined,
      applyTo: extras.allocations
        .filter((row) => row.docId)
        .map((row) => ({ billId: row.docId as string, amount: row.amount })),
      excessAsAdvance: extras.excessAsAdvance,
      tdsDeducted: tds,
      notes: values.customerNotes || undefined,
    },
  };
}

/* ─── DocForm config ──────────────────────────────────────────── */

const MODE_OPTIONS: SelectOption[] = SABCRM_PAYOUT_MODES.map((m) => ({
  value: m.value,
  label: m.label,
}));

async function searchOpenBills(q: string) {
  const res = await searchSabcrmFinanceBillRefs(q, { openOnly: true });
  return res.ok ? res.data : [];
}

/**
 * Builds the payout DocForm config: vendor party picker, no due date /
 * lines / payment terms, and the full extras grid (amount, rail,
 * account, rail-specific refs, TDS, excess switch, bill allocations).
 */
export function buildPayoutFormConfig(
  accounts: SabcrmPaymentAccountOption[],
  mode: 'create' | 'edit',
): DocFormConfig {
  const accountOptions: SelectOption[] = accounts.map((a) => ({
    value: a.id,
    label: a.label,
  }));

  return {
    entitySingular: 'Payout',
    numberLabel: 'Payout number',
    partyLabel: 'Vendor',
    partyPlaceholder: 'Search vendors…',
    dateLabel: 'Payout date',
    dueDateLabel: 'Due date',
    hideDueDate: true,
    hideLines: true,
    hidePaymentTerms: true,
    notesLabel: 'Notes',
    searchParties: async (q) => {
      const res = await searchSabcrmFinanceVendors(q);
      return res.ok ? res.data : [];
    },
    suggestNumber:
      mode === 'create'
        ? async () => {
            const res = await getNextSabcrmPayoutNumber();
            return res.ok ? res.data : null;
          }
        : undefined,
    extraFields: ({ values, patch, busy }) => {
      const extras = readPayoutExtras(values);
      const patchExtras = (p: Partial<PayoutExtras>): void =>
        patch({ extras: { ...extras, ...p } });
      const showTxn = SABCRM_PAYOUT_TXN_MODES.has(extras.mode);

      return (
        <>
          <Field label="Amount paid" required>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={extras.amount}
              onChange={(e) => patchExtras({ amount: e.target.value })}
              placeholder="0.00"
              disabled={busy}
            />
          </Field>

          <Field label="Payment mode" required>
            <SelectField
              value={extras.mode}
              onChange={(v) =>
                patchExtras({ mode: (v ?? 'neft') as CrmPayoutMode })
              }
              options={MODE_OPTIONS}
              disabled={busy}
            />
          </Field>

          <Field
            label="Paid from"
            required
            help="The payment account the money left."
          >
            <SelectField
              value={extras.bankAccountId}
              onChange={(v) => patchExtras({ bankAccountId: v })}
              options={accountOptions}
              placeholder={
                accounts.length === 0
                  ? 'No payment accounts yet'
                  : 'Pick an account'
              }
              disabled={busy || accounts.length === 0}
            />
          </Field>

          <Field label="TDS withheld" help="Deducted at source, if any.">
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={extras.tdsDeducted}
              onChange={(e) => patchExtras({ tdsDeducted: e.target.value })}
              placeholder="0.00"
              disabled={busy}
            />
          </Field>

          {extras.mode === 'cheque' ? (
            <>
              <Field label="Cheque number">
                <Input
                  value={extras.chequeNo}
                  onChange={(e) => patchExtras({ chequeNo: e.target.value })}
                  placeholder="000123"
                  disabled={busy}
                />
              </Field>
              <Field label="Cheque date">
                <DatePicker
                  value={keyToDate(extras.chequeDate)}
                  onChange={(d) => patchExtras({ chequeDate: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label="Cheque date"
                />
              </Field>
            </>
          ) : null}

          {showTxn ? (
            <Field label="Transaction id" help="UTR / UPI / card reference.">
              <Input
                value={extras.txnId}
                onChange={(e) => patchExtras({ txnId: e.target.value })}
                placeholder="UTR-…"
                disabled={busy}
              />
            </Field>
          ) : null}

          <Field label="Reference" help="Internal memo (optional).">
            <Input
              value={extras.reference}
              onChange={(e) => patchExtras({ reference: e.target.value })}
              placeholder="Q3 retainer"
              disabled={busy}
            />
          </Field>

          <div className="fdoc-form-grid__full">
            <Field
              label="Apply to bills"
              help="Allocate this payout against open vendor bills."
            >
              <AllocationsEditor
                rows={extras.allocations}
                onChange={(allocations) => patchExtras({ allocations })}
                currency={values.currency}
                searchDocs={searchOpenBills}
                docLabel="Bill"
                totalAmount={safeNum(extras.amount)}
                disabled={busy}
              />
            </Field>
          </div>

          <div className="fdoc-form-grid__full">
            <Switch
              checked={extras.excessAsAdvance}
              onCheckedChange={(checked) =>
                patchExtras({ excessAsAdvance: checked })
              }
              label="Park the unallocated remainder as a vendor advance"
              disabled={busy}
            />
          </div>
        </>
      );
    },
  };
}

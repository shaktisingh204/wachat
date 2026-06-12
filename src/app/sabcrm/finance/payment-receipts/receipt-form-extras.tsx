'use client';

/**
 * SabCRM Finance — receipt form extras (shared by create + edit).
 *
 * The payment-receipt entity's `DocFormConfig.extraFields` renderer:
 * mode / deposit-account / amount / FX / mode-specific identifiers /
 * TDS + bank-charge adjustments / excess-as-advance switch and the
 * invoice AllocationsEditor. State lives in the kit's `values.extras`
 * bag (typed via `receipt-config.ts`).
 *
 * In edit mode the G4-locked fields (mode, amount, allocations, excess
 * flag) render disabled with help copy — the Rust reconciliation on
 * mutating them is a follow-up (finance-rollout spec §3.7).
 */

import * as React from 'react';
import { Field, Input, SelectField, Switch } from '@/components/sabcrm/20ui';
import { safeNum } from '@/lib/sabcrm/finance-doc-math';
import { searchSabcrmFinanceInvoiceRefs } from '@/app/actions/sabcrm-finance-pickers.actions';
import {
  AllocationsEditor,
  blankAllocationRow,
  type DocEntityOption,
  type DocFormExtraFieldsApi,
} from '../_components/doc-surface';
import {
  RECEIPT_MODES,
  TXN_ID_MODES,
  readReceiptExtras,
  type ReceiptFormExtras,
} from './receipt-config';

export interface ReceiptExtraFieldsOptions {
  /** Payment-account Select options (REAL ids, resolved server-side). */
  accounts: { id: string; label: string }[];
  /** Edit mode — locks the G4 financial-identity fields. */
  locked: boolean;
}

const LOCKED_HELP = 'Locked after creation — void and recreate to change.';

/**
 * Builds the `extraFields` renderer for the receipt DocForm. Returned
 * as a factory so both the list (create) and detail (edit) clients
 * share one implementation with their own lock state.
 */
export function buildReceiptExtraFields({
  accounts,
  locked,
}: ReceiptExtraFieldsOptions): (
  api: DocFormExtraFieldsApi,
) => React.ReactNode {
  const accountOptions = accounts.map((a) => ({
    value: a.id,
    label: a.label,
  }));

  const searchOpenInvoices = async (q: string): Promise<DocEntityOption[]> => {
    const res = await searchSabcrmFinanceInvoiceRefs(q, { openOnly: true });
    return res.ok ? res.data : [];
  };

  return function ReceiptExtraFields({ values, patch, busy }) {
    const extras = readReceiptExtras(values.extras);
    const set = (p: Partial<ReceiptFormExtras>): void =>
      patch({ extras: { ...extras, ...p } });

    const amount = safeNum(extras.amount);
    const showCheque = extras.mode === 'cheque';
    const showTxn = extras.mode ? TXN_ID_MODES.has(extras.mode) : false;

    return (
      <>
        <Field
          label="Payment mode"
          required
          help={locked ? LOCKED_HELP : undefined}
        >
          <SelectField
            value={extras.mode}
            onChange={(v) => set({ mode: v })}
            options={RECEIPT_MODES.map((m) => ({
              value: m.value,
              label: m.label,
            }))}
            disabled={busy || locked}
            aria-label="Payment mode"
          />
        </Field>

        <Field label="Deposit to" required>
          <SelectField
            value={extras.bankAccountId}
            onChange={(v) => set({ bankAccountId: v })}
            options={accountOptions}
            placeholder={
              accountOptions.length === 0
                ? 'No payment accounts yet'
                : 'Pick an account'
            }
            disabled={busy || accountOptions.length === 0}
            aria-label="Deposit account"
          />
        </Field>

        <Field
          label="Amount received"
          required
          help={locked ? LOCKED_HELP : undefined}
        >
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={extras.amount}
            onChange={(e) => set({ amount: e.target.value })}
            placeholder="0.00"
            disabled={busy || locked}
          />
        </Field>

        <Field label="Exchange rate" help="Only for non-base currencies.">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.0001"
            value={extras.exchangeRate}
            onChange={(e) => set({ exchangeRate: e.target.value })}
            placeholder="1.0"
            disabled={busy}
          />
        </Field>

        {showCheque ? (
          <>
            <Field label="Cheque number">
              <Input
                value={extras.chequeNo}
                onChange={(e) => set({ chequeNo: e.target.value })}
                placeholder="000123"
                disabled={busy}
              />
            </Field>
            <Field label="Cheque date">
              <Input
                type="date"
                value={extras.chequeDate}
                onChange={(e) => set({ chequeDate: e.target.value })}
                disabled={busy}
                aria-label="Cheque date"
              />
            </Field>
          </>
        ) : null}

        {showTxn ? (
          <Field label="Transaction id" help="UTR / RRN from the bank.">
            <Input
              value={extras.txnId}
              onChange={(e) => set({ txnId: e.target.value })}
              placeholder="UTR123456789"
              disabled={busy}
            />
          </Field>
        ) : null}

        <Field label="Reference">
          <Input
            value={extras.reference}
            onChange={(e) => set({ reference: e.target.value })}
            placeholder="Internal reference"
            disabled={busy}
          />
        </Field>

        <Field label="TDS deducted" help="Withheld by the customer.">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={extras.tdsDeducted}
            onChange={(e) => set({ tdsDeducted: e.target.value })}
            placeholder="0.00"
            disabled={busy}
          />
        </Field>

        <Field label="Bank charges" help="Fees deducted by the bank.">
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={extras.bankCharges}
            onChange={(e) => set({ bankCharges: e.target.value })}
            placeholder="0.00"
            disabled={busy}
          />
        </Field>

        <div className="fdoc-form-grid__full">
          <Field
            label="Apply to invoices"
            help={
              locked
                ? LOCKED_HELP
                : 'Allocate this money across the customer’s open invoices.'
            }
          >
            <AllocationsEditor
              rows={
                extras.allocations.length > 0
                  ? extras.allocations
                  : [blankAllocationRow()]
              }
              onChange={(rows) => set({ allocations: rows })}
              currency={values.currency}
              searchDocs={searchOpenInvoices}
              docLabel="Invoice"
              totalAmount={amount}
              disabled={busy || locked}
            />
          </Field>
        </div>

        <div className="fdoc-form-grid__full">
          <Switch
            checked={extras.excessAsAdvance}
            onCheckedChange={(checked) => set({ excessAsAdvance: checked })}
            disabled={busy || locked}
            label="Park any unallocated excess as a customer advance"
          />
        </div>
      </>
    );
  };
}

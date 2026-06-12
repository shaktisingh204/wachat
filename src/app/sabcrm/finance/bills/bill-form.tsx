'use client';

/**
 * SabCRM Finance — shared bill DocForm wiring.
 *
 * Bills are the kit's most demanding adopter (finance-rollout spec
 * §3.6): they carry BOTH inventory item lines and direct-to-ledger
 * expense lines, an optional due date, FX, TDS and reverse-charge
 * headers. The kit's built-in due-date / line-items slots are hidden
 * (`hideDueDate` / `hideLines`) and re-rendered inside `extraFields` so
 * the "at least one item OR expense line" rule and the optional due
 * date can be validated entity-side.
 *
 * This module hosts everything the list client (create) and the detail
 * client (edit) share: the extras bag + typed reader, the expense-lines
 * editor, the `extraFields` renderer and the base `DocFormConfig`.
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import {
  Button,
  DatePicker,
  Field,
  IconButton,
  Input,
  Switch,
} from '@/components/sabcrm/20ui';
import {
  searchSabcrmFinanceItems,
} from '@/app/actions/sabcrm-finance-invoices.actions';
import {
  searchSabcrmFinanceLedgerAccounts,
  searchSabcrmFinanceVendors,
} from '@/app/actions/sabcrm-finance-pickers.actions';
import type { SabcrmBillExpenseLineInput } from '@/app/actions/sabcrm-finance-bills.actions.types';
import { isBlankDocLine, safeNum } from '@/lib/sabcrm/finance-doc-math';

import {
  EntityPicker,
  LineItemsEditor,
  formatDocMoney,
  type DocFormConfig,
  type DocFormExtraFieldsApi,
  type DocFormValues,
  type DocItemOption,
} from '../_components/doc-surface';

/* ─── Date helpers (`YYYY-MM-DD` ⇄ local Date) ────────────────── */

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

/* ─── Extras bag (typed accessors) ────────────────────────────── */

/** One editable expense-line row (numbers stay strings while typing). */
export interface BillExpenseLineDraft {
  rowId: string;
  accountId: string | null;
  accountLabel: string | null;
  description: string;
  amount: string;
  taxRatePct: string;
}

let expenseRowSeq = 0;

export function blankBillExpenseLine(): BillExpenseLineDraft {
  expenseRowSeq += 1;
  return {
    rowId: `exp-${Date.now()}-${expenseRowSeq}`,
    accountId: null,
    accountLabel: null,
    description: '',
    amount: '',
    taxRatePct: '',
  };
}

/** What the bill form stows in the kit's `values.extras`. */
export interface BillExtras {
  vendorInvoiceNo: string;
  exchangeRate: string;
  tdsSection: string;
  tdsAmount: string;
  reverseCharge: boolean;
  expenseLines: BillExpenseLineDraft[];
}

/** Reads the extras bag with safe defaults (kit seeds `{}`). */
export function readBillExtras(
  extras: Record<string, unknown> | undefined,
): BillExtras {
  const e = extras ?? {};
  return {
    vendorInvoiceNo:
      typeof e.vendorInvoiceNo === 'string' ? e.vendorInvoiceNo : '',
    exchangeRate: typeof e.exchangeRate === 'string' ? e.exchangeRate : '',
    tdsSection: typeof e.tdsSection === 'string' ? e.tdsSection : '',
    tdsAmount: typeof e.tdsAmount === 'string' ? e.tdsAmount : '',
    reverseCharge: e.reverseCharge === true,
    expenseLines: Array.isArray(e.expenseLines)
      ? (e.expenseLines as BillExpenseLineDraft[])
      : [],
  };
}

/** True when an expense row carries no information at all. */
function isBlankExpenseLine(line: BillExpenseLineDraft): boolean {
  return (
    !line.accountId && !line.description.trim() && safeNum(line.amount) === 0
  );
}

/** Drafts → the action's typed expense-line inputs (blank rows dropped). */
export function toExpenseLineInputs(
  drafts: BillExpenseLineDraft[],
): SabcrmBillExpenseLineInput[] {
  return drafts
    .filter((l) => !isBlankExpenseLine(l))
    .map((l) => ({
      accountId: l.accountId ?? undefined,
      description: l.description.trim() || undefined,
      amount: safeNum(l.amount),
      taxRatePct: l.taxRatePct === '' ? undefined : safeNum(l.taxRatePct),
    }));
}

/* ─── Expense-lines editor ────────────────────────────────────── */

interface BillExpenseLinesEditorProps {
  lines: BillExpenseLineDraft[];
  onChange: (lines: BillExpenseLineDraft[]) => void;
  currency: string;
  disabled?: boolean;
}

function BillExpenseLinesEditor({
  lines,
  onChange,
  currency,
  disabled,
}: BillExpenseLinesEditorProps): React.JSX.Element {
  const patchRow = (
    rowId: string,
    p: Partial<BillExpenseLineDraft>,
  ): void => {
    onChange(lines.map((l) => (l.rowId === rowId ? { ...l, ...p } : l)));
  };

  const total = lines.reduce((s, l) => {
    const amount = safeNum(l.amount);
    const tax = l.taxRatePct === '' ? 0 : (amount * safeNum(l.taxRatePct)) / 100;
    return s + amount + tax;
  }, 0);

  return (
    <div className="flex flex-col gap-2">
      {lines.map((line) => (
        <div
          key={line.rowId}
          className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_110px_80px_auto] items-center gap-2"
        >
          <EntityPicker
            value={line.accountId}
            valueLabel={line.accountLabel}
            search={async (q) => {
              const res = await searchSabcrmFinanceLedgerAccounts(q);
              return res.ok ? res.data : [];
            }}
            placeholder="Ledger account…"
            aria-label="Expense ledger account"
            disabled={disabled}
            onChange={(opt) =>
              patchRow(line.rowId, {
                accountId: opt?.id ?? null,
                accountLabel: opt?.label ?? null,
              })
            }
          />
          <Input
            value={line.description}
            onChange={(e) =>
              patchRow(line.rowId, { description: e.target.value })
            }
            placeholder="Description"
            aria-label="Expense description"
            disabled={disabled}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={line.amount}
            onChange={(e) => patchRow(line.rowId, { amount: e.target.value })}
            placeholder="Amount"
            aria-label="Expense amount"
            disabled={disabled}
          />
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={line.taxRatePct}
            onChange={(e) =>
              patchRow(line.rowId, { taxRatePct: e.target.value })
            }
            placeholder="Tax %"
            aria-label="Expense tax percent"
            disabled={disabled}
          />
          <IconButton
            label="Remove expense line"
            icon={Trash2}
            size="sm"
            disabled={disabled}
            onClick={() =>
              onChange(lines.filter((l) => l.rowId !== line.rowId))
            }
          />
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          iconLeft={Plus}
          disabled={disabled}
          onClick={() => onChange([...lines, blankBillExpenseLine()])}
        >
          Add expense line
        </Button>
        <span className="fdoc-cell-sub">
          Expense total {formatDocMoney(total, currency)}
        </span>
      </div>
    </div>
  );
}

/* ─── Extra fields renderer ───────────────────────────────────── */

/** Item-picker fetcher shared by the embedded LineItemsEditor. */
async function searchBillItems(q: string): Promise<DocItemOption[]> {
  const res = await searchSabcrmFinanceItems(q);
  if (!res.ok) return [];
  return res.data.map((item) => ({
    id: item.id,
    label: item.name,
    meta: item.sku
      ? `${item.sku} · ${formatDocMoney(item.sellingPrice, item.currency ?? 'INR')}`
      : formatDocMoney(item.sellingPrice, item.currency ?? 'INR'),
    rate: item.sellingPrice,
    taxRatePct: item.taxRate,
    hsnSac: item.hsnSac,
    description: item.description ?? item.name,
  }));
}

interface BillExtraFieldsProps {
  api: DocFormExtraFieldsApi;
  /** Edit mode locks the (immutable) bill number via help copy. */
  mode: 'create' | 'edit';
}

function BillExtraFields({ api }: BillExtraFieldsProps): React.JSX.Element {
  const { values, patch, busy } = api;
  const extras = readBillExtras(values.extras);

  const patchExtras = (p: Partial<BillExtras>): void =>
    patch({ extras: { ...values.extras, ...p } });

  return (
    <>
      <Field
        label="Vendor invoice no."
        help="The number printed on the vendor's own document."
      >
        <Input
          value={extras.vendorInvoiceNo}
          onChange={(e) => patchExtras({ vendorInvoiceNo: e.target.value })}
          placeholder="INV-9876"
          disabled={busy}
        />
      </Field>

      <Field label="Due date" help="Optional — drives AP aging.">
        <DatePicker
          value={keyToDate(values.dueDate)}
          onChange={(d) => patch({ dueDate: dateToKey(d) })}
          placeholder="No due date"
          disabled={busy}
          aria-label="Due date"
        />
      </Field>

      <Field
        label="Exchange rate"
        help="FX rate to the base currency (optional)."
      >
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.0001"
          value={extras.exchangeRate}
          onChange={(e) => patchExtras({ exchangeRate: e.target.value })}
          placeholder="1.0"
          disabled={busy}
        />
      </Field>

      <Field label="TDS section" help='E.g. "194C", "194J".'>
        <Input
          value={extras.tdsSection}
          onChange={(e) => patchExtras({ tdsSection: e.target.value })}
          placeholder="194C"
          disabled={busy}
        />
      </Field>

      <Field label="TDS amount" help="Withheld from the vendor payout.">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={extras.tdsAmount}
          onChange={(e) => patchExtras({ tdsAmount: e.target.value })}
          placeholder="0"
          disabled={busy}
        />
      </Field>

      <Field label="Reverse charge">
        <div className="pt-1">
          <Switch
            checked={extras.reverseCharge}
            onCheckedChange={(next) => patchExtras({ reverseCharge: next })}
            disabled={busy}
            label="GST reverse charge applies"
          />
        </div>
      </Field>

      <div className="fdoc-form-grid__full">
        <Field
          label="Items"
          help="Inventory lines for goods bills — leave empty for pure expense bills."
        >
          <LineItemsEditor
            lines={values.lines}
            onChange={(lines) => patch({ lines })}
            currency={values.currency}
            searchItems={searchBillItems}
            disabled={busy}
            lineExtras
            modifiers={values.modifiers ?? {}}
            onModifiersChange={(modifiers) => patch({ modifiers })}
          />
        </Field>
      </div>

      <div className="fdoc-form-grid__full">
        <Field
          label="Expense lines"
          help="Direct-to-ledger lines for service / utility / rent bills."
        >
          <BillExpenseLinesEditor
            lines={extras.expenseLines}
            onChange={(expenseLines) => patchExtras({ expenseLines })}
            currency={values.currency}
            disabled={busy}
          />
        </Field>
      </div>
    </>
  );
}

/* ─── Shared DocForm config ───────────────────────────────────── */

/**
 * The bill DocForm config both drawers share. Create mode layers
 * `issueLabel` + `suggestNumber` on top. The kit's due-date and
 * line-items slots are hidden and re-rendered in `extraFields` (the
 * due date is optional and bills allow expense-only money).
 */
export function baseBillFormConfig(mode: 'create' | 'edit'): DocFormConfig {
  return {
    entitySingular: 'Bill',
    numberLabel: 'Bill number',
    partyLabel: 'Vendor',
    partyPlaceholder: 'Search vendors…',
    dateLabel: 'Bill date',
    dueDateLabel: 'Due date',
    hideDueDate: true,
    hideLines: true,
    hidePaymentTerms: true,
    notesLabel: 'Notes',
    taxFields: { placeOfSupply: true },
    searchParties: async (q) => {
      const res = await searchSabcrmFinanceVendors(q);
      return res.ok ? res.data : [];
    },
    extraFields: (api) => <BillExtraFields api={api} mode={mode} />,
  };
}

/**
 * Bill-specific validation the kit can't do: at least one item OR
 * expense line, positive expense amounts, numeric FX / TDS.
 */
export function validateBillValues(values: DocFormValues): string | null {
  const extras = readBillExtras(values.extras);
  const hasItems = values.lines.some((l) => !isBlankDocLine(l));
  const expenseInputs = toExpenseLineInputs(extras.expenseLines);
  if (!hasItems && expenseInputs.length === 0) {
    return 'Add at least one item line or expense line.';
  }
  for (const line of expenseInputs) {
    if (!(line.amount > 0)) {
      return 'Every expense line needs an amount above zero.';
    }
  }
  if (extras.exchangeRate !== '' && !(safeNum(extras.exchangeRate) > 0)) {
    return 'The exchange rate must be a positive number.';
  }
  if (extras.tdsAmount !== '' && safeNum(extras.tdsAmount, -1) < 0) {
    return 'The TDS amount must be zero or more.';
  }
  return null;
}

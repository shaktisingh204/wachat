'use client';

/**
 * SabCRM Finance — shared ledger-list client, 20ui.
 *
 * One generic client for the tranche-2 banking/ledger entities whose
 * columns don't fit the document mould of {@link FinanceDocClient}
 * (bank transactions, recurring invoices, voucher books, petty cash,
 * budgets, reconciliation runs). Mirrors the same structure — list
 * table, "New <thing>" dialog, per-row archive behind an AlertDialog —
 * but parameterised by typed column descriptors (text / date / amount /
 * debit-credit flow / status badge) and a declarative form-field list,
 * so the six pages stay thin and can't drift from each other.
 *
 * Per-entity extras:
 * - recurring invoices get a Pause/Resume row action (status toggle via
 *   `updateSabcrmRecurringInvoice`);
 * - reconciliation is read-heavy — list + "start run"; statement-line
 *   matching flows are a follow-up.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); every
 * action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  BookOpen,
  CalendarClock,
  Coins,
  Landmark,
  Percent,
  PiggyBank,
  Plus,
  Scale,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
  type SelectOption,
} from '@/components/sabcrm/20ui';

import {
  createSabcrmBankTransaction,
  deleteSabcrmBankTransaction,
  createSabcrmRecurringInvoice,
  updateSabcrmRecurringInvoice,
  deleteSabcrmRecurringInvoice,
  createSabcrmVoucherBook,
  deleteSabcrmVoucherBook,
  createSabcrmPettyCashFloat,
  deleteSabcrmPettyCashFloat,
  createSabcrmBudget,
  deleteSabcrmBudget,
  createSabcrmReconciliation,
  deleteSabcrmReconciliation,
  createSabcrmChartOfAccount,
  deleteSabcrmChartOfAccount,
  createSabcrmTdsRecord,
  deleteSabcrmTdsRecord,
} from '@/app/actions/sabcrm-finance.actions';
import type { ActionResult } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Row + configuration types
// ---------------------------------------------------------------------------

/**
 * Flat row every server page narrows its documents into. `cells` is
 * keyed by column key; `currency` feeds amount formatting; `label` is
 * the human handle used in the archive-confirm copy.
 */
export interface LedgerRow {
  id: string;
  label: string;
  status: string;
  currency: string;
  cells: Record<string, string | number | null | undefined>;
}

export type FinanceLedgerKind =
  | 'bank-transactions'
  | 'recurring-invoices'
  | 'vouchers'
  | 'petty-cash'
  | 'budgets'
  | 'reconciliation'
  | 'accounts'
  | 'tds';

/**
 * Column rendering modes:
 * - `text` — raw string;
 * - `date` — ISO instant → `12 Jun 2026`;
 * - `amount` — currency-formatted number, right-aligned;
 * - `flow` — currency amount tinted by the row's `cells.type`
 *   (`credit` → green `+`, `debit` → red `−`);
 * - `badge` — status badge using the entity's tone/label maps.
 */
interface ColumnDef {
  key: string;
  label: string;
  kind: 'text' | 'date' | 'amount' | 'flow' | 'badge';
}

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  /** Initial value (select default / today's date / …). */
  initial?: string;
}

type LedgerResult = ActionResult<unknown>;

interface RowAction {
  /** Visible label for the given row (e.g. "Pause" / "Resume"). */
  label: (row: LedgerRow) => string;
  run: (row: LedgerRow) => Promise<LedgerResult>;
}

interface LedgerConfig {
  title: string;
  description: string;
  /** Lowercase singular for dialog/confirm copy. */
  singular: string;
  emptyIcon: LucideIcon;
  columns: ColumnDef[];
  statusTone: Record<string, BadgeTone>;
  statusLabel: Record<string, string>;
  fields: FieldDef[];
  create: (values: Record<string, string>) => Promise<LedgerResult>;
  remove: (id: string) => Promise<LedgerResult>;
  rowAction?: RowAction;
}

// ---------------------------------------------------------------------------
// Display helpers (same conventions as finance-doc-client)
// ---------------------------------------------------------------------------

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

/** `2026-06-12T00:00:00Z` → `12 Jun 2026` (deterministic, no TZ drift). */
function formatDate(iso: string): string {
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split('-');
  if (!y || !m || !d) return day || '—';
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Today as `YYYY-MM-DD` for date-input defaults. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Per-entity configuration
// ---------------------------------------------------------------------------

const LEDGER_CONFIGS: Record<FinanceLedgerKind, LedgerConfig> = {
  'bank-transactions': {
    title: 'Bank transactions',
    description:
      'Per-account debit/credit movements for this workspace — part of the SabCRM Finance suite.',
    singular: 'transaction',
    emptyIcon: ArrowLeftRight,
    columns: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'account', label: 'Account', kind: 'text' },
      { key: 'description', label: 'Description', kind: 'text' },
      { key: 'reference', label: 'Reference', kind: 'text' },
      { key: 'amount', label: 'Amount', kind: 'flow' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      pending: 'warning',
      cleared: 'success',
      reconciled: 'info',
      archived: 'neutral',
    },
    statusLabel: {
      pending: 'Pending',
      cleared: 'Cleared',
      reconciled: 'Reconciled',
      archived: 'Archived',
    },
    fields: [
      { key: 'date', label: 'Date', type: 'date', required: true, initial: today() },
      { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        initial: 'debit',
        options: [
          { value: 'debit', label: 'Debit (money out)' },
          { value: 'credit', label: 'Credit (money in)' },
        ],
      },
      { key: 'description', label: 'Description', type: 'text', placeholder: 'Office rent — June' },
      { key: 'referenceNumber', label: 'Reference number', type: 'text', placeholder: 'UTR / cheque no.' },
    ],
    create: (v) =>
      createSabcrmBankTransaction({
        date: v.date ?? '',
        amount: Number(v.amount),
        type: v.type ?? 'debit',
        description: v.description || undefined,
        referenceNumber: v.referenceNumber || undefined,
      }),
    remove: deleteSabcrmBankTransaction,
  },
  'recurring-invoices': {
    title: 'Recurring invoices',
    description:
      'Invoice schedules for this workspace — frequency, next run, and status — part of the SabCRM Finance suite.',
    singular: 'schedule',
    emptyIcon: CalendarClock,
    columns: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'frequency', label: 'Frequency', kind: 'text' },
      { key: 'startDate', label: 'Starts', kind: 'date' },
      { key: 'nextRunAt', label: 'Next run', kind: 'date' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      active: 'success',
      paused: 'warning',
      stopped: 'neutral',
      completed: 'info',
      archived: 'neutral',
    },
    statusLabel: {
      active: 'Active',
      paused: 'Paused',
      stopped: 'Stopped',
      completed: 'Completed',
      archived: 'Archived',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', placeholder: 'Monthly retainer — Acme' },
      {
        key: 'frequency',
        label: 'Frequency',
        type: 'select',
        required: true,
        initial: 'monthly',
        options: [
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'quarterly', label: 'Quarterly' },
          { value: 'yearly', label: 'Yearly' },
        ],
      },
      { key: 'startDate', label: 'Start date', type: 'date', required: true, initial: today() },
    ],
    create: (v) =>
      createSabcrmRecurringInvoice({
        title: v.title || undefined,
        frequency: v.frequency || undefined,
        startDate: v.startDate ?? '',
      }),
    remove: deleteSabcrmRecurringInvoice,
    rowAction: {
      label: (row) => (row.status === 'active' ? 'Pause' : 'Resume'),
      run: (row) =>
        updateSabcrmRecurringInvoice(row.id, {
          status: row.status === 'active' ? 'paused' : 'active',
        }),
    },
  },
  vouchers: {
    title: 'Voucher books',
    description:
      'Voucher numbering series (journal, payment, receipt…) for this workspace — part of the SabCRM Finance suite.',
    singular: 'voucher book',
    emptyIcon: BookOpen,
    columns: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'type', label: 'Type', kind: 'text' },
      { key: 'prefix', label: 'Prefix', kind: 'text' },
      { key: 'startingNumber', label: 'Starts at', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      active: 'success',
      archived: 'neutral',
    },
    statusLabel: {
      active: 'Active',
      archived: 'Archived',
    },
    fields: [
      { key: 'name', label: 'Book name', type: 'text', required: true, placeholder: 'Journal 2026' },
      {
        key: 'type',
        label: 'Voucher type',
        type: 'select',
        required: true,
        initial: 'journal',
        options: [
          { value: 'journal', label: 'Journal' },
          { value: 'payment', label: 'Payment' },
          { value: 'receipt', label: 'Receipt' },
          { value: 'contra', label: 'Contra' },
          { value: 'purchase', label: 'Purchase' },
          { value: 'sales', label: 'Sales' },
        ],
      },
      { key: 'prefix', label: 'Prefix', type: 'text', placeholder: 'JV-' },
      { key: 'startingNumber', label: 'Starting number', type: 'number', placeholder: '1' },
    ],
    create: (v) =>
      createSabcrmVoucherBook({
        name: v.name ?? '',
        type: v.type ?? 'journal',
        prefix: v.prefix || undefined,
        startingNumber: v.startingNumber ? Number(v.startingNumber) : undefined,
      }),
    remove: deleteSabcrmVoucherBook,
  },
  'petty-cash': {
    title: 'Petty cash',
    description:
      'Petty cash floats — custodian, branch, and balances — part of the SabCRM Finance suite.',
    singular: 'float',
    emptyIcon: Coins,
    columns: [
      { key: 'branch', label: 'Branch', kind: 'text' },
      { key: 'custodian', label: 'Custodian', kind: 'text' },
      { key: 'openingBalance', label: 'Opening balance', kind: 'amount' },
      { key: 'currentBalance', label: 'Current balance', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      active: 'success',
      closed: 'neutral',
      archived: 'neutral',
    },
    statusLabel: {
      active: 'Active',
      closed: 'Closed',
      archived: 'Archived',
    },
    fields: [
      { key: 'branchName', label: 'Branch', type: 'text', placeholder: 'Head office' },
      { key: 'custodianName', label: 'Custodian', type: 'text', placeholder: 'Asha Verma' },
      { key: 'openingBalance', label: 'Opening balance', type: 'number', required: true, placeholder: '0.00' },
      { key: 'currency', label: 'Currency', type: 'select', initial: 'INR', options: CURRENCY_OPTIONS },
    ],
    create: (v) =>
      createSabcrmPettyCashFloat({
        branchName: v.branchName || undefined,
        custodianName: v.custodianName || undefined,
        openingBalance: Number(v.openingBalance),
        currency: v.currency || undefined,
      }),
    remove: deleteSabcrmPettyCashFloat,
  },
  budgets: {
    title: 'Budgets',
    description:
      'Planned vs actual spend by head and period — part of the SabCRM Finance suite.',
    singular: 'budget',
    emptyIcon: PiggyBank,
    columns: [
      { key: 'budgetHead', label: 'Budget head', kind: 'text' },
      { key: 'department', label: 'Department', kind: 'text' },
      { key: 'period', label: 'Period', kind: 'text' },
      { key: 'plannedAmount', label: 'Planned', kind: 'amount' },
      { key: 'actualAmount', label: 'Actual', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      draft: 'neutral',
      approved: 'success',
      rejected: 'danger',
      locked: 'info',
      archived: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      approved: 'Approved',
      rejected: 'Rejected',
      locked: 'Locked',
      archived: 'Archived',
    },
    fields: [
      { key: 'budgetHead', label: 'Budget head', type: 'text', required: true, placeholder: 'Marketing' },
      { key: 'period', label: 'Period', type: 'text', required: true, placeholder: 'FY 2026-27' },
      { key: 'department', label: 'Department', type: 'text', placeholder: 'Growth' },
      { key: 'plannedAmount', label: 'Planned amount', type: 'number', required: true, placeholder: '0.00' },
      { key: 'currency', label: 'Currency', type: 'select', initial: 'INR', options: CURRENCY_OPTIONS },
    ],
    create: (v) =>
      createSabcrmBudget({
        budgetHead: v.budgetHead ?? '',
        period: v.period ?? '',
        department: v.department || undefined,
        plannedAmount: Number(v.plannedAmount),
        currency: v.currency || undefined,
      }),
    remove: deleteSabcrmBudget,
  },
  reconciliation: {
    title: 'Reconciliation',
    description:
      'Bank reconciliation runs — period windows, balances, and match counts. Statement-line matching is coming next.',
    singular: 'reconciliation run',
    emptyIcon: Scale,
    columns: [
      { key: 'account', label: 'Account', kind: 'text' },
      { key: 'periodStart', label: 'From', kind: 'date' },
      { key: 'periodEnd', label: 'To', kind: 'date' },
      { key: 'openingBalance', label: 'Opening', kind: 'amount' },
      { key: 'closingBalance', label: 'Closing', kind: 'amount' },
      { key: 'matched', label: 'Matched', kind: 'text' },
      { key: 'unmatched', label: 'Unmatched', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      in_progress: 'warning',
      completed: 'success',
      archived: 'neutral',
    },
    statusLabel: {
      in_progress: 'In progress',
      completed: 'Completed',
      archived: 'Archived',
    },
    fields: [
      { key: 'periodStart', label: 'Period start', type: 'date', required: true, initial: today() },
      { key: 'periodEnd', label: 'Period end', type: 'date', required: true, initial: today() },
      { key: 'openingBalance', label: 'Opening balance', type: 'number', placeholder: '0.00' },
      { key: 'closingBalance', label: 'Closing balance', type: 'number', placeholder: '0.00' },
    ],
    create: (v) =>
      createSabcrmReconciliation({
        periodStart: v.periodStart ?? '',
        periodEnd: v.periodEnd ?? '',
        openingBalance: v.openingBalance ? Number(v.openingBalance) : undefined,
        closingBalance: v.closingBalance ? Number(v.closingBalance) : undefined,
      }),
    remove: deleteSabcrmReconciliation,
  },
  accounts: {
    title: 'Chart of accounts',
    description:
      'Ledger heads grouped by type — the backbone of journal entries and statements — part of the SabCRM Finance suite.',
    singular: 'account',
    emptyIcon: Landmark,
    columns: [
      { key: 'name', label: 'Account', kind: 'text' },
      { key: 'code', label: 'Code', kind: 'text' },
      { key: 'type', label: 'Type', kind: 'text' },
      { key: 'openingBalance', label: 'Opening balance', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      active: 'success',
      archived: 'neutral',
    },
    statusLabel: {
      active: 'Active',
      archived: 'Archived',
    },
    fields: [
      { key: 'name', label: 'Account name', type: 'text', required: true, placeholder: 'Cash in Hand' },
      {
        key: 'accountType',
        label: 'Account type',
        type: 'select',
        required: true,
        initial: 'asset',
        options: [
          { value: 'asset', label: 'Asset' },
          { value: 'liability', label: 'Liability' },
          { value: 'income', label: 'Income' },
          { value: 'expense', label: 'Expense' },
          { value: 'equity', label: 'Equity' },
        ],
      },
      { key: 'code', label: 'Ledger code', type: 'text', placeholder: '1000' },
      { key: 'openingBalance', label: 'Opening balance', type: 'number', placeholder: '0.00' },
      { key: 'currency', label: 'Currency', type: 'select', initial: 'INR', options: CURRENCY_OPTIONS },
    ],
    create: (v) =>
      createSabcrmChartOfAccount({
        name: v.name ?? '',
        accountType: v.accountType ?? 'asset',
        code: v.code || undefined,
        openingBalance: v.openingBalance ? Number(v.openingBalance) : undefined,
        currency: v.currency || undefined,
      }),
    remove: deleteSabcrmChartOfAccount,
  },
  tds: {
    title: 'TDS records',
    description:
      'Quarterly TDS deductions — gross vs deducted, challans, and deposit status — part of the SabCRM Finance suite.',
    singular: 'TDS record',
    emptyIcon: Percent,
    columns: [
      { key: 'employeeName', label: 'Deductee', kind: 'text' },
      { key: 'financialYear', label: 'FY', kind: 'text' },
      { key: 'quarter', label: 'Quarter', kind: 'text' },
      { key: 'grossAmount', label: 'Gross', kind: 'amount' },
      { key: 'tdsAmount', label: 'TDS', kind: 'amount' },
      { key: 'challan', label: 'Challan', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      pending: 'warning',
      deposited: 'info',
      filed: 'success',
      archived: 'neutral',
    },
    statusLabel: {
      pending: 'Pending',
      deposited: 'Deposited',
      filed: 'Filed',
      archived: 'Archived',
    },
    fields: [
      { key: 'employeeName', label: 'Deductee name', type: 'text', required: true, placeholder: 'Asha Verma' },
      { key: 'financialYear', label: 'Financial year', type: 'text', required: true, placeholder: '2026-27' },
      {
        key: 'quarter',
        label: 'Quarter',
        type: 'select',
        required: true,
        initial: 'Q1',
        options: [
          { value: 'Q1', label: 'Q1 (Apr–Jun)' },
          { value: 'Q2', label: 'Q2 (Jul–Sep)' },
          { value: 'Q3', label: 'Q3 (Oct–Dec)' },
          { value: 'Q4', label: 'Q4 (Jan–Mar)' },
        ],
      },
      { key: 'grossAmount', label: 'Gross amount', type: 'number', placeholder: '0.00' },
      { key: 'tdsAmount', label: 'TDS amount', type: 'number', required: true, placeholder: '0.00' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        initial: 'pending',
        options: [
          { value: 'pending', label: 'Pending' },
          { value: 'deposited', label: 'Deposited' },
          { value: 'filed', label: 'Filed' },
        ],
      },
    ],
    create: (v) =>
      createSabcrmTdsRecord({
        employeeName: v.employeeName ?? '',
        financialYear: v.financialYear ?? '',
        quarter: v.quarter ?? 'Q1',
        grossAmount: v.grossAmount ? Number(v.grossAmount) : undefined,
        tdsAmount: Number(v.tdsAmount),
        status: v.status || undefined,
      }),
    remove: deleteSabcrmTdsRecord,
  },
};

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function renderCell(
  col: ColumnDef,
  row: LedgerRow,
  config: LedgerConfig,
): React.ReactNode {
  const raw = row.cells[col.key];
  switch (col.kind) {
    case 'date':
      return typeof raw === 'string' && raw ? formatDate(raw) : '—';
    case 'amount':
      return typeof raw === 'number'
        ? formatAmount(raw, row.currency)
        : '—';
    case 'flow': {
      if (typeof raw !== 'number') return '—';
      const isCredit = row.cells.type === 'credit';
      return (
        <span
          className={
            isCredit
              ? 'font-medium text-[var(--ui20-color-success-600,#16a34a)]'
              : 'font-medium text-[var(--ui20-color-danger-600,#dc2626)]'
          }
        >
          {isCredit ? '+' : '−'}
          {formatAmount(Math.abs(raw), row.currency)}
        </span>
      );
    }
    case 'badge':
      return (
        <Badge tone={config.statusTone[row.status] ?? 'neutral'} dot>
          {config.statusLabel[row.status] ?? row.status}
        </Badge>
      );
    default:
      return raw === null || raw === undefined || raw === ''
        ? '—'
        : String(raw);
  }
}

// ---------------------------------------------------------------------------
// New-record dialog
// ---------------------------------------------------------------------------

interface NewRecordDialogProps {
  config: LedgerConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewRecordDialog({
  config,
  open,
  onOpenChange,
  onCreated,
}: NewRecordDialogProps): React.JSX.Element {
  const initialValues = React.useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of config.fields) v[f.key] = f.initial ?? '';
    return v;
  }, [config.fields]);

  const [values, setValues] = React.useState<Record<string, string>>(
    initialValues,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const reset = React.useCallback(() => {
    setValues(initialValues);
    setError(null);
  }, [initialValues]);

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const setValue = (key: string, value: string): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (): void => {
    for (const f of config.fields) {
      const v = values[f.key]?.trim() ?? '';
      if (f.required && !v) {
        setError(`${f.label} is required.`);
        return;
      }
      if (f.type === 'number' && v && !Number.isFinite(Number(v))) {
        setError(`${f.label} must be a number.`);
        return;
      }
    }
    setError(null);

    startTransition(async () => {
      const res = await config.create(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      reset();
      onOpenChange(false);
      onCreated();
    });
  };

  const descId = `new-${config.singular.replace(/\s+/g, '-')}-desc`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={descId}>
        <DialogHeader>
          <DialogTitle>New {config.singular}</DialogTitle>
          <DialogDescription id={descId}>
            Create a {config.singular} in this workspace. You can refine
            the details after it&apos;s created.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            {config.fields.map((f, idx) => (
              <Field key={f.key} label={f.label} required={f.required}>
                {f.type === 'select' ? (
                  <SelectField
                    value={values[f.key] || null}
                    onChange={(next) => setValue(f.key, next ?? '')}
                    options={f.options ?? []}
                    disabled={pending}
                  />
                ) : (
                  <Input
                    type={f.type}
                    inputMode={f.type === 'number' ? 'decimal' : undefined}
                    step={f.type === 'number' ? '0.01' : undefined}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    autoFocus={idx === 0}
                    disabled={pending}
                  />
                )}
              </Field>
            ))}

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
              Create {config.singular}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Page client
// ---------------------------------------------------------------------------

export interface FinanceLedgerClientProps {
  kind: FinanceLedgerKind;
  initialRows: LedgerRow[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
}

export function FinanceLedgerClient({
  kind,
  initialRows,
  initialError,
}: FinanceLedgerClientProps): React.JSX.Element {
  const config = LEDGER_CONFIGS[kind];
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<LedgerRow | null>(
    null,
  );
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [toggling, startToggle] = React.useTransition();

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target) return;
    setRowError(null);
    startDelete(async () => {
      const res = await config.remove(target.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  const handleRowAction = (row: LedgerRow): void => {
    const action = config.rowAction;
    if (!action) return;
    setRowError(null);
    startToggle(async () => {
      const res = await action.run(row);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      refresh();
    });
  };

  const amountAligned = (kindOf: ColumnDef['kind']): boolean =>
    kindOf === 'amount' || kindOf === 'flow';

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{config.title}</PageTitle>
          <PageDescription>{config.description}</PageDescription>
        </PageHeaderHeading>
        <PageActions>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => setDialogOpen(true)}
          >
            New {config.singular}
          </Button>
        </PageActions>
      </PageHeader>

      {initialError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            Couldn&apos;t load {config.title.toLowerCase()}: {initialError}
          </Alert>
        </div>
      ) : null}

      {rowError ? (
        <div className="my-4">
          <Alert tone="danger" role="alert">
            {rowError}
          </Alert>
        </div>
      ) : null}

      {!initialError && initialRows.length === 0 ? (
        <div className="mt-12">
          <EmptyState
            icon={config.emptyIcon}
            title={`No ${config.title.toLowerCase()} yet`}
            description={`Create your first ${config.singular} to start tracking it in this workspace.`}
            action={
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={() => setDialogOpen(true)}
              >
                New {config.singular}
              </Button>
            }
          />
        </div>
      ) : null}

      {initialRows.length > 0 ? (
        <div className="mt-4">
          <Table hover>
            <THead>
              <Tr>
                {config.columns.map((col) => (
                  <Th
                    key={col.key}
                    align={amountAligned(col.kind) ? 'right' : undefined}
                  >
                    {col.label}
                  </Th>
                ))}
                <Th align="right" width={config.rowAction ? 140 : 64}>
                  <span className="sr-only">Actions</span>
                </Th>
              </Tr>
            </THead>
            <TBody>
              {initialRows.map((row) => (
                <Tr key={row.id}>
                  {config.columns.map((col) => (
                    <Td
                      key={col.key}
                      align={amountAligned(col.kind) ? 'right' : undefined}
                    >
                      {renderCell(col, row, config)}
                    </Td>
                  ))}
                  <Td align="right">
                    {config.rowAction && row.status !== 'archived' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={toggling}
                        aria-label={`${config.rowAction.label(row)} ${row.label}`}
                        onClick={() => handleRowAction(row)}
                      >
                        {config.rowAction.label(row)}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconLeft={Trash2}
                      aria-label={`Archive ${config.singular} ${row.label}`}
                      onClick={() => {
                        setRowError(null);
                        setConfirmDelete(row);
                      }}
                    >
                      Archive
                    </Button>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <NewRecordDialog
        config={config}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refresh}
      />

      <AlertDialog
        open={confirmDelete !== null}
        onOpenChange={(next) => {
          if (!next && !deleting) {
            setConfirmDelete(null);
            setRowError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive {confirmDelete?.label ?? `this ${config.singular}`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The {config.singular} is hidden from lists. Its history is
              preserved and an admin can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {rowError ? (
            <Alert tone="danger" role="alert">
              {rowError}
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </AlertDialogCancel>
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              Archive {config.singular}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

/**
 * SabCRM Commerce — shared list client, 20ui.
 *
 * One generic client for the Commerce suite entities (POS sessions /
 * transactions / holds / refunds, storefronts, orders, coupons, gift
 * cards, shipping zones). Modeled on the Supply suite's
 * `supply-client.tsx` — list table, optional "New <thing>" dialog,
 * per-row lifecycle actions, delete/archive behind an AlertDialog —
 * parameterised by typed column descriptors and a declarative
 * form-field list so the nine pages stay thin and can't drift.
 *
 * Three generalisations over the supply original (the POS/store crates
 * are lifecycle-heavy, not create-heavy):
 * - `create` is OPTIONAL — read-heavy surfaces (transactions, holds,
 *   refunds, orders) have no "New" dialog; rows are produced by the
 *   register / checkout flows;
 * - `rowActions` is an ARRAY, and an action may declare a single
 *   `field` it needs (e.g. "Close session" collects the counted
 *   closing cash in a one-input dialog before running);
 * - `rowHref` links a row to a detail page (orders → detail-lite).
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); every
 * action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgePercent,
  Gift,
  Monitor,
  PauseCircle,
  Plus,
  Receipt,
  ShoppingCart,
  Store,
  Trash2,
  Truck,
  Undo2,
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
  openSabcrmPosSession,
  closeSabcrmPosSession,
  reconcileSabcrmPosSession,
  archiveSabcrmPosSession,
  voidSabcrmPosTransaction,
  voidSabcrmPosHold,
  archiveSabcrmPosRefund,
  createSabcrmStorefront,
  publishSabcrmStorefront,
  archiveSabcrmStorefront,
  markSabcrmStoreOrderPaid,
  markSabcrmStoreOrderFulfilled,
  cancelSabcrmStoreOrder,
  createSabcrmCoupon,
  activateSabcrmCoupon,
  archiveSabcrmCoupon,
  createSabcrmGiftCard,
  archiveSabcrmGiftCard,
  createSabcrmShippingZone,
  archiveSabcrmShippingZone,
} from '@/app/actions/sabcrm-commerce.actions';
import type { ActionResult } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Row + configuration types
// ---------------------------------------------------------------------------

/**
 * Flat row every server page narrows its documents into. `cells` is
 * keyed by column key; `currency` feeds amount formatting; `label` is
 * the human handle used in the confirm copy.
 */
export interface CommerceRow {
  id: string;
  label: string;
  status: string;
  currency: string;
  cells: Record<string, string | number | null | undefined>;
}

export type CommerceKind =
  | 'pos-sessions'
  | 'pos-transactions'
  | 'pos-holds'
  | 'pos-refunds'
  | 'storefronts'
  | 'orders'
  | 'coupons'
  | 'gift-cards'
  | 'shipping';

interface ColumnDef {
  key: string;
  label: string;
  kind: 'text' | 'date' | 'amount' | 'number' | 'badge';
}

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: SelectOption[];
  /** Dynamic options injected by the server page (e.g. storefronts). */
  optionsKey?: string;
  initial?: string;
}

type CommerceResult = ActionResult<unknown>;

interface RowAction {
  /** Visible label (e.g. "Close", "Mark paid"). */
  label: string;
  /** Whether the action applies to this row. */
  applies: (row: CommerceRow) => boolean;
  /**
   * Single input collected in a small dialog BEFORE running (e.g. the
   * counted closing cash). When absent the action runs immediately.
   */
  field?: { label: string; type: 'text' | 'number'; placeholder?: string };
  run: (row: CommerceRow, value?: string) => Promise<CommerceResult>;
}

interface CommerceConfig {
  title: string;
  description: string;
  /** Lowercase singular for dialog/confirm copy. */
  singular: string;
  emptyIcon: LucideIcon;
  /** Empty-state copy for read-heavy surfaces with no create dialog. */
  emptyHint?: string;
  columns: ColumnDef[];
  statusTone: Record<string, BadgeTone>;
  statusLabel: Record<string, string>;
  /** Optional "New <thing>" dialog. Absent on read-heavy surfaces. */
  create?: {
    fields: FieldDef[];
    run: (values: Record<string, string>) => Promise<CommerceResult>;
  };
  rowActions?: RowAction[];
  /** Optional per-row detail link (orders). */
  rowHref?: (row: CommerceRow) => string;
  /** Optional delete/archive. Verb shows in the button + confirm copy. */
  remove?: {
    verb: 'Archive' | 'Delete' | 'Void' | 'Cancel';
    run: (id: string) => Promise<CommerceResult>;
    /** True when the row survives (soft delete) — tunes confirm copy. */
    soft: boolean;
  };
}

// ---------------------------------------------------------------------------
// Display helpers (same conventions as the supply client)
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

// ---------------------------------------------------------------------------
// Per-entity configuration
// ---------------------------------------------------------------------------

const COMMERCE_CONFIGS: Record<CommerceKind, CommerceConfig> = {
  'pos-sessions': {
    title: 'POS sessions',
    description:
      'Cash-register sessions — opening float through close and reconciliation. Part of the SabCRM Commerce suite.',
    singular: 'session',
    emptyIcon: Monitor,
    columns: [
      { key: 'terminalId', label: 'Terminal', kind: 'text' },
      { key: 'openedAt', label: 'Opened', kind: 'date' },
      { key: 'openingCash', label: 'Opening cash', kind: 'amount' },
      { key: 'closingCash', label: 'Closing cash', kind: 'amount' },
      { key: 'discrepancy', label: 'Discrepancy', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      open: 'success',
      closed: 'warning',
      reconciled: 'info',
      archived: 'neutral',
    },
    statusLabel: {
      open: 'Open',
      closed: 'Closed',
      reconciled: 'Reconciled',
      archived: 'Archived',
    },
    create: {
      fields: [
        { key: 'terminalId', label: 'Terminal id', type: 'text', required: true, placeholder: 'till-1' },
        { key: 'openingCash', label: 'Opening cash', type: 'number', placeholder: '0.00' },
        { key: 'notes', label: 'Notes', type: 'text' },
      ],
      run: (v) =>
        openSabcrmPosSession({
          terminalId: v.terminalId ?? '',
          openingCash: v.openingCash || 0,
          notes: v.notes || undefined,
        }),
    },
    rowActions: [
      {
        label: 'Close',
        applies: (row) => row.status === 'open',
        field: { label: 'Counted closing cash', type: 'number', placeholder: '0.00' },
        run: (row, value) => closeSabcrmPosSession(row.id, Number(value ?? 0)),
      },
      {
        label: 'Reconcile',
        applies: (row) => row.status === 'closed',
        run: (row) => reconcileSabcrmPosSession(row.id),
      },
    ],
    remove: { verb: 'Archive', run: archiveSabcrmPosSession, soft: true },
  },
  'pos-transactions': {
    title: 'POS transactions',
    description:
      'Sales rung up at the register — line items, payment method, and totals. Part of the SabCRM Commerce suite.',
    singular: 'transaction',
    emptyIcon: Receipt,
    emptyHint:
      'Transactions are created at the POS register when a sale completes.',
    columns: [
      { key: 'transactionNumber', label: 'Number', kind: 'text' },
      { key: 'createdAt', label: 'Date', kind: 'date' },
      { key: 'lines', label: 'Lines', kind: 'number' },
      { key: 'paymentMethod', label: 'Payment', kind: 'text' },
      { key: 'total', label: 'Total', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      completed: 'success',
      voided: 'danger',
      refunded: 'warning',
    },
    statusLabel: {
      completed: 'Completed',
      voided: 'Voided',
      refunded: 'Refunded',
    },
    rowActions: [
      {
        label: 'Void',
        applies: (row) => row.status === 'completed',
        run: (row) => voidSabcrmPosTransaction(row.id),
      },
    ],
  },
  'pos-holds': {
    title: 'POS holds',
    description:
      'Parked register tickets waiting to be recalled at the counter. Part of the SabCRM Commerce suite.',
    singular: 'hold',
    emptyIcon: PauseCircle,
    emptyHint:
      'Holds are parked from the POS register and recalled when the customer returns.',
    columns: [
      { key: 'heldAt', label: 'Held', kind: 'date' },
      { key: 'holdReason', label: 'Reason', kind: 'text' },
      { key: 'lines', label: 'Lines', kind: 'number' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      held: 'warning',
      recalled: 'success',
      voided: 'danger',
      archived: 'neutral',
    },
    statusLabel: {
      held: 'Held',
      recalled: 'Recalled',
      voided: 'Voided',
      archived: 'Archived',
    },
    remove: { verb: 'Void', run: voidSabcrmPosHold, soft: true },
  },
  'pos-refunds': {
    title: 'POS refunds',
    description:
      'Refunds issued against register transactions. Part of the SabCRM Commerce suite.',
    singular: 'refund',
    emptyIcon: Undo2,
    emptyHint:
      'Refunds are issued from a completed POS transaction; the record lands here.',
    columns: [
      { key: 'processedAt', label: 'Processed', kind: 'date' },
      { key: 'reason', label: 'Reason', kind: 'text' },
      { key: 'refundMethod', label: 'Method', kind: 'text' },
      { key: 'refundTotal', label: 'Refunded', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      pending: 'warning',
      completed: 'success',
      voided: 'danger',
      archived: 'neutral',
    },
    statusLabel: {
      pending: 'Pending',
      completed: 'Completed',
      voided: 'Voided',
      archived: 'Archived',
    },
    remove: { verb: 'Archive', run: archiveSabcrmPosRefund, soft: true },
  },
  storefronts: {
    title: 'Storefronts',
    description:
      'Online stores this workspace runs — slug, domain, currency, and publish state. Part of the SabCRM Commerce suite.',
    singular: 'storefront',
    emptyIcon: Store,
    columns: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'slug', label: 'Slug', kind: 'text' },
      { key: 'domain', label: 'Domain', kind: 'text' },
      { key: 'currency', label: 'Currency', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      draft: 'neutral',
      published: 'success',
      archived: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      published: 'Published',
      archived: 'Archived',
    },
    create: {
      fields: [
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Acme Store' },
        { key: 'slug', label: 'Slug', type: 'text', required: true, placeholder: 'acme-store' },
        { key: 'currency', label: 'Currency', type: 'select', initial: 'INR', options: CURRENCY_OPTIONS },
        { key: 'domain', label: 'Custom domain', type: 'text', placeholder: 'shop.acme.example' },
      ],
      run: (v) =>
        createSabcrmStorefront({
          name: v.name ?? '',
          slug: v.slug ?? '',
          currency: v.currency || undefined,
          domain: v.domain || undefined,
        }),
    },
    rowActions: [
      {
        label: 'Publish',
        applies: (row) => row.status === 'draft',
        run: (row) => publishSabcrmStorefront(row.id),
      },
    ],
    remove: { verb: 'Archive', run: archiveSabcrmStorefront, soft: true },
  },
  orders: {
    title: 'Orders',
    description:
      'Customer orders placed against this workspace’s storefronts — payment and fulfilment at a glance. Part of the SabCRM Commerce suite.',
    singular: 'order',
    emptyIcon: ShoppingCart,
    emptyHint:
      'Orders arrive from storefront checkouts; payment and fulfilment are managed here.',
    columns: [
      { key: 'orderNumber', label: 'Order #', kind: 'text' },
      { key: 'placedAt', label: 'Placed', kind: 'date' },
      { key: 'customerName', label: 'Customer', kind: 'text' },
      { key: 'total', label: 'Total', kind: 'amount' },
      { key: 'status', label: 'Payment', kind: 'badge' },
      { key: 'fulfillment', label: 'Fulfilment', kind: 'text' },
    ],
    statusTone: {
      pending: 'warning',
      paid: 'success',
      failed: 'danger',
      refunded: 'neutral',
    },
    statusLabel: {
      pending: 'Pending',
      paid: 'Paid',
      failed: 'Failed',
      refunded: 'Refunded',
    },
    rowHref: (row) => `/sabcrm/commerce/orders/${row.id}`,
    rowActions: [
      {
        label: 'Mark paid',
        applies: (row) => row.status === 'pending' || row.status === 'failed',
        run: (row) => markSabcrmStoreOrderPaid(row.id),
      },
      {
        label: 'Mark fulfilled',
        applies: (row) => {
          const f = String(row.cells.fulfillment ?? '');
          return f === 'Unfulfilled' || f === 'Partial';
        },
        run: (row) => markSabcrmStoreOrderFulfilled(row.id),
      },
    ],
    remove: { verb: 'Cancel', run: cancelSabcrmStoreOrder, soft: true },
  },
  coupons: {
    title: 'Coupons',
    description:
      'Promotional discount codes — usage limits, validity windows, status. Part of the SabCRM Commerce suite.',
    singular: 'coupon',
    emptyIcon: BadgePercent,
    columns: [
      { key: 'code', label: 'Code', kind: 'text' },
      { key: 'type', label: 'Type', kind: 'text' },
      { key: 'value', label: 'Value', kind: 'number' },
      { key: 'usedCount', label: 'Used', kind: 'number' },
      { key: 'validTo', label: 'Valid until', kind: 'date' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      draft: 'neutral',
      active: 'success',
      expired: 'warning',
      archived: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      active: 'Active',
      expired: 'Expired',
      archived: 'Archived',
    },
    create: {
      fields: [
        { key: 'code', label: 'Code', type: 'text', required: true, placeholder: 'SUMMER50' },
        {
          key: 'type',
          label: 'Type',
          type: 'select',
          initial: 'percent',
          options: [
            { value: 'percent', label: 'Percent off' },
            { value: 'fixed', label: 'Fixed amount off' },
          ],
        },
        { key: 'value', label: 'Value', type: 'number', required: true, placeholder: '10' },
        { key: 'minCart', label: 'Minimum cart', type: 'number', placeholder: '0.00' },
        { key: 'validTo', label: 'Valid until', type: 'date' },
      ],
      run: (v) =>
        createSabcrmCoupon({
          code: v.code ?? '',
          type: v.type || undefined,
          value: v.value || 0,
          minCart: v.minCart || undefined,
          validTo: v.validTo || undefined,
        }),
    },
    rowActions: [
      {
        label: 'Activate',
        applies: (row) => row.status === 'draft',
        run: (row) => activateSabcrmCoupon(row.id),
      },
    ],
    remove: { verb: 'Archive', run: archiveSabcrmCoupon, soft: true },
  },
  'gift-cards': {
    title: 'Gift cards',
    description:
      'Prepaid balances issued to customers — value, remaining balance, expiry. Part of the SabCRM Commerce suite.',
    singular: 'gift card',
    emptyIcon: Gift,
    columns: [
      { key: 'code', label: 'Code', kind: 'text' },
      { key: 'value', label: 'Value', kind: 'amount' },
      { key: 'balance', label: 'Balance', kind: 'amount' },
      { key: 'issuedTo', label: 'Issued to', kind: 'text' },
      { key: 'expiryDate', label: 'Expires', kind: 'date' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      active: 'success',
      redeemed: 'info',
      expired: 'warning',
      archived: 'neutral',
    },
    statusLabel: {
      active: 'Active',
      redeemed: 'Redeemed',
      expired: 'Expired',
      archived: 'Archived',
    },
    create: {
      fields: [
        { key: 'value', label: 'Value', type: 'number', required: true, placeholder: '100.00' },
        { key: 'code', label: 'Code (auto if blank)', type: 'text', placeholder: 'GC-WELCOME' },
        { key: 'issuedTo', label: 'Issued to', type: 'text', placeholder: 'Asha Rao' },
        { key: 'issuedToEmail', label: 'Recipient email', type: 'text', placeholder: 'asha@example.com' },
        { key: 'expiryDate', label: 'Expiry', type: 'date' },
      ],
      run: (v) =>
        createSabcrmGiftCard({
          value: v.value || 0,
          code: v.code || undefined,
          issuedTo: v.issuedTo || undefined,
          issuedToEmail: v.issuedToEmail || undefined,
          expiryDate: v.expiryDate || undefined,
        }),
    },
    remove: { verb: 'Archive', run: archiveSabcrmGiftCard, soft: true },
  },
  shipping: {
    title: 'Shipping zones',
    description:
      'Geographic delivery zones and their rate methods per storefront. Part of the SabCRM Commerce suite.',
    singular: 'shipping zone',
    emptyIcon: Truck,
    columns: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'countries', label: 'Countries', kind: 'text' },
      { key: 'methods', label: 'Methods', kind: 'number' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      active: 'success',
      paused: 'warning',
      archived: 'neutral',
    },
    statusLabel: {
      active: 'Active',
      paused: 'Paused',
      archived: 'Archived',
    },
    create: {
      fields: [
        { key: 'storefrontId', label: 'Storefront', type: 'select', required: true, optionsKey: 'storefronts' },
        { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Domestic' },
        { key: 'countries', label: 'Countries (ISO-2, comma-separated)', type: 'text', placeholder: 'IN, AE' },
        {
          key: 'methodKind',
          label: 'Starter method',
          type: 'select',
          initial: 'flat',
          options: [
            { value: 'flat', label: 'Flat rate' },
            { value: 'weight_based', label: 'Weight based (per kg)' },
            { value: 'free_above', label: 'Free above subtotal' },
          ],
        },
        { key: 'methodRate', label: 'Rate / threshold', type: 'number', placeholder: '50.00' },
      ],
      run: (v) =>
        createSabcrmShippingZone({
          storefrontId: v.storefrontId ?? '',
          name: v.name ?? '',
          countries: v.countries || undefined,
          methodKind: v.methodKind || undefined,
          methodRate: v.methodRate || undefined,
        }),
    },
    remove: { verb: 'Archive', run: archiveSabcrmShippingZone, soft: true },
  },
};

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function renderCell(
  col: ColumnDef,
  row: CommerceRow,
  config: CommerceConfig,
): React.ReactNode {
  const raw = row.cells[col.key];
  switch (col.kind) {
    case 'date':
      return typeof raw === 'string' && raw ? formatDate(raw) : '—';
    case 'amount':
      return typeof raw === 'number' ? formatAmount(raw, row.currency) : '—';
    case 'number':
      return typeof raw === 'number' ? String(raw) : '—';
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
  config: CommerceConfig;
  selectOptions: Record<string, SelectOption[]>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function NewRecordDialog({
  config,
  selectOptions,
  open,
  onOpenChange,
  onCreated,
}: NewRecordDialogProps): React.JSX.Element | null {
  const create = config.create;

  const resolveOptions = React.useCallback(
    (f: FieldDef): SelectOption[] =>
      f.optionsKey ? (selectOptions[f.optionsKey] ?? []) : (f.options ?? []),
    [selectOptions],
  );

  const initialValues = React.useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of create?.fields ?? []) {
      if (f.initial !== undefined) {
        v[f.key] = f.initial;
        continue;
      }
      const opts = f.optionsKey ? (selectOptions[f.optionsKey] ?? []) : [];
      v[f.key] = opts.length === 1 ? opts[0].value : '';
    }
    return v;
  }, [create, selectOptions]);

  const [values, setValues] = React.useState<Record<string, string>>(
    initialValues,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const reset = React.useCallback(() => {
    setValues(initialValues);
    setError(null);
  }, [initialValues]);

  if (!create) return null;

  const handleOpenChange = (next: boolean): void => {
    if (!next) reset();
    onOpenChange(next);
  };

  const setValue = (key: string, value: string): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (): void => {
    for (const f of create.fields) {
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
      const res = await create.run(values);
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
            {create.fields.map((f, idx) => {
              if (f.type === 'select') {
                const opts = resolveOptions(f);
                const emptyDynamic = Boolean(f.optionsKey) && opts.length === 0;
                return (
                  <Field
                    key={f.key}
                    label={f.label}
                    required={f.required}
                    help={
                      emptyDynamic
                        ? `No ${f.label.toLowerCase()} options yet — create one first.`
                        : undefined
                    }
                  >
                    <SelectField
                      value={values[f.key] || null}
                      onChange={(next) => setValue(f.key, next ?? '')}
                      options={opts}
                      disabled={pending || emptyDynamic}
                      placeholder={emptyDynamic ? 'Nothing to pick yet' : undefined}
                    />
                  </Field>
                );
              }
              return (
                <Field key={f.key} label={f.label} required={f.required}>
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
                </Field>
              );
            })}

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
// Row-action input dialog (single field, e.g. "counted closing cash")
// ---------------------------------------------------------------------------

interface RowActionDialogProps {
  action: RowAction | null;
  row: CommerceRow | null;
  onClose: () => void;
  onDone: () => void;
}

function RowActionDialog({
  action,
  row,
  onClose,
  onDone,
}: RowActionDialogProps): React.JSX.Element | null {
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    setValue('');
    setError(null);
  }, [action, row]);

  if (!action || !row || !action.field) return null;
  const field = action.field;

  const handleSubmit = (): void => {
    if (field.type === 'number' && !Number.isFinite(Number(value))) {
      setError(`${field.label} must be a number.`);
      return;
    }
    startTransition(async () => {
      const res = await action.run(row, value);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      onDone();
    });
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !pending) onClose(); }}>
      <DialogContent aria-describedby="row-action-desc">
        <DialogHeader>
          <DialogTitle>
            {action.label} {row.label}
          </DialogTitle>
          <DialogDescription id="row-action-desc">
            {field.label} is required to {action.label.toLowerCase()} this
            record.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-3 pb-2 pt-1">
            <Field label={field.label} required>
              <Input
                type={field.type}
                inputMode={field.type === 'number' ? 'decimal' : undefined}
                step={field.type === 'number' ? '0.01' : undefined}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={field.placeholder}
                autoFocus
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
              {action.label}
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

export interface CommerceClientProps {
  kind: CommerceKind;
  initialRows: CommerceRow[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
  /**
   * Dynamic select options keyed by `FieldDef.optionsKey` (e.g.
   * `{ storefronts: [...] }`) — fetched by the server page from the
   * sibling commerce lists.
   */
  selectOptions?: Record<string, SelectOption[]>;
}

export function CommerceClient({
  kind,
  initialRows,
  initialError,
  selectOptions = {},
}: CommerceClientProps): React.JSX.Element {
  const config = COMMERCE_CONFIGS[kind];
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<CommerceRow | null>(
    null,
  );
  const [fieldAction, setFieldAction] = React.useState<{
    action: RowAction;
    row: CommerceRow;
  } | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [acting, startAction] = React.useTransition();

  const refresh = React.useCallback(() => {
    router.refresh();
  }, [router]);

  const remove = config.remove;

  const handleDelete = (): void => {
    const target = confirmDelete;
    if (!target || !remove) return;
    setRowError(null);
    startDelete(async () => {
      const res = await remove.run(target.id);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      setConfirmDelete(null);
      refresh();
    });
  };

  const handleRowAction = (action: RowAction, row: CommerceRow): void => {
    setRowError(null);
    if (action.field) {
      setFieldAction({ action, row });
      return;
    }
    startAction(async () => {
      const res = await action.run(row);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      refresh();
    });
  };

  const amountAligned = (kindOf: ColumnDef['kind']): boolean =>
    kindOf === 'amount' || kindOf === 'number';

  const actionsWidth =
    96 + (config.rowActions?.length ?? 0) * 88 + (config.rowHref ? 64 : 0);

  return (
    <div className="mx-auto w-full max-w-[1120px] px-6 pb-12 pt-6">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>{config.title}</PageTitle>
          <PageDescription>{config.description}</PageDescription>
        </PageHeaderHeading>
        {config.create ? (
          <PageActions>
            <Button
              variant="primary"
              iconLeft={Plus}
              onClick={() => setDialogOpen(true)}
            >
              New {config.singular}
            </Button>
          </PageActions>
        ) : null}
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
            description={
              config.emptyHint ??
              `Create your first ${config.singular} to start tracking it in this workspace.`
            }
            action={
              config.create ? (
                <Button
                  variant="primary"
                  iconLeft={Plus}
                  onClick={() => setDialogOpen(true)}
                >
                  New {config.singular}
                </Button>
              ) : undefined
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
                <Th align="right" width={actionsWidth}>
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
                    {config.rowHref ? (
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={config.rowHref(row)}
                          aria-label={`View ${config.singular} ${row.label}`}
                        >
                          View
                        </Link>
                      </Button>
                    ) : null}
                    {(config.rowActions ?? [])
                      .filter((a) => a.applies(row))
                      .map((a) => (
                        <Button
                          key={a.label}
                          variant="ghost"
                          size="sm"
                          disabled={acting}
                          aria-label={`${a.label} ${row.label}`}
                          onClick={() => handleRowAction(a, row)}
                        >
                          {a.label}
                        </Button>
                      ))}
                    {remove ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        aria-label={`${remove.verb} ${config.singular} ${row.label}`}
                        onClick={() => {
                          setRowError(null);
                          setConfirmDelete(row);
                        }}
                      >
                        {remove.verb}
                      </Button>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </div>
      ) : null}

      <NewRecordDialog
        config={config}
        selectOptions={selectOptions}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refresh}
      />

      <RowActionDialog
        action={fieldAction?.action ?? null}
        row={fieldAction?.row ?? null}
        onClose={() => setFieldAction(null)}
        onDone={refresh}
      />

      {remove ? (
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
                {remove.verb}{' '}
                {confirmDelete?.label ?? `this ${config.singular}`}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {remove.soft
                  ? `The ${config.singular} is hidden from active lists. Its history is preserved and an admin can restore it later.`
                  : `The ${config.singular} is permanently removed. The audit log keeps a record of the deletion.`}
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
              <Button
                variant="danger"
                loading={deleting}
                onClick={handleDelete}
              >
                {remove.verb} {config.singular}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}

    </div>
  );
}

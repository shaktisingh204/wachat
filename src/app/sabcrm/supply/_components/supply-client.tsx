'use client';

/**
 * SabCRM Supply — shared list client, 20ui.
 *
 * One generic client for the Supply suite entities (items, warehouses,
 * stock adjustments, purchase orders, GRNs, vendors, RFQs, vendor bids,
 * BOMs, production orders). Modeled on the Finance suite's
 * `finance-ledger-client.tsx` — list table, "New <thing>" dialog,
 * per-row delete/archive behind an AlertDialog — parameterised by typed
 * column descriptors and a declarative form-field list so the ten pages
 * stay thin and can't drift from each other.
 *
 * Two generalisations over the finance original:
 * - `selectOptions` prop — server pages inject DYNAMIC select options
 *   (e.g. the project's vendors for the PO dialog) by field key, since
 *   supply dialogs reference sibling entities;
 * - per-entity `deleteVerb` — crates differ: crm-common-style crates
 *   archive (soft delete), Identity-style crates hard-delete.
 *
 * ONLY `@/components/sabcrm/20ui` barrel imports (repo rule); every
 * action re-runs the full session → project → RBAC → plan gate.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Boxes,
  ClipboardCheck,
  ClipboardList,
  Factory,
  Gavel,
  Layers,
  Package,
  Plus,
  Scale,
  Store,
  Trash2,
  Warehouse,
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
  createSabcrmSupplyItem,
  deleteSabcrmSupplyItem,
  createSabcrmSupplyWarehouse,
  deleteSabcrmSupplyWarehouse,
  createSabcrmSupplyStockAdjustment,
  deleteSabcrmSupplyStockAdjustment,
  createSabcrmSupplyPurchaseOrder,
  deleteSabcrmSupplyPurchaseOrder,
  createSabcrmSupplyGrn,
  deleteSabcrmSupplyGrn,
  createSabcrmSupplyVendor,
  deleteSabcrmSupplyVendor,
  createSabcrmSupplyRfq,
  deleteSabcrmSupplyRfq,
  createSabcrmSupplyVendorBid,
  updateSabcrmSupplyVendorBidStatus,
  deleteSabcrmSupplyVendorBid,
  createSabcrmSupplyBom,
  deleteSabcrmSupplyBom,
  createSabcrmSupplyProductionOrder,
  deleteSabcrmSupplyProductionOrder,
} from '@/app/actions/sabcrm-supply.actions';
import type { ActionResult } from '@/lib/sabcrm/types';

import '@/components/sabcrm/20ui/surface-crm-base.css';

// ---------------------------------------------------------------------------
// Row + configuration types
// ---------------------------------------------------------------------------

/**
 * Flat row every server page narrows its documents into. `cells` is
 * keyed by column key; `currency` feeds amount formatting; `label` is
 * the human handle used in the delete-confirm copy.
 */
export interface SupplyRow {
  id: string;
  label: string;
  status: string;
  currency: string;
  cells: Record<string, string | number | null | undefined>;
}

export type SupplyKind =
  | 'items'
  | 'warehouses'
  | 'stock-adjustments'
  | 'purchase-orders'
  | 'grn'
  | 'vendors'
  | 'rfqs'
  | 'vendor-bids'
  | 'bom'
  | 'production-orders';

/**
 * Column rendering modes:
 * - `text` — raw string;
 * - `date` — ISO instant → `12 Jun 2026`;
 * - `amount` — currency-formatted number, right-aligned;
 * - `number` — plain number, right-aligned;
 * - `badge` — status badge using the entity's tone/label maps.
 */
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
  /** Static options (currency etc.). */
  options?: SelectOption[];
  /**
   * Dynamic options injected by the server page via the
   * `selectOptions` prop (e.g. the project's vendors). When set and
   * the injected list is empty, the field renders a disabled select
   * with a "create one first" hint.
   */
  optionsKey?: string;
  /** Initial value (select default / today's date / …). */
  initial?: string;
}

type SupplyResult = ActionResult<unknown>;

interface RowAction {
  /** Visible label for the given row (e.g. "Award"). */
  label: (row: SupplyRow) => string;
  /** Whether the action applies to this row. */
  applies: (row: SupplyRow) => boolean;
  run: (row: SupplyRow) => Promise<SupplyResult>;
}

interface SupplyConfig {
  title: string;
  description: string;
  /** Lowercase singular for dialog/confirm copy. */
  singular: string;
  emptyIcon: LucideIcon;
  columns: ColumnDef[];
  statusTone: Record<string, BadgeTone>;
  statusLabel: Record<string, string>;
  fields: FieldDef[];
  /** "Archive" (soft delete) vs "Delete" (hard delete) per the crate. */
  deleteVerb: 'Archive' | 'Delete';
  create: (values: Record<string, string>) => Promise<SupplyResult>;
  remove: (id: string) => Promise<SupplyResult>;
  rowAction?: RowAction;
}

// ---------------------------------------------------------------------------
// Display helpers (same conventions as the finance client)
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

const SUPPLY_CONFIGS: Record<SupplyKind, SupplyConfig> = {
  items: {
    title: 'Items',
    description:
      'Products and services this workspace stocks, sells, and purchases — part of the SabCRM Supply suite.',
    singular: 'item',
    emptyIcon: Package,
    columns: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'sku', label: 'SKU', kind: 'text' },
      { key: 'itemType', label: 'Type', kind: 'text' },
      { key: 'costPrice', label: 'Cost', kind: 'amount' },
      { key: 'sellingPrice', label: 'Price', kind: 'amount' },
      { key: 'totalStock', label: 'Stock', kind: 'number' },
    ],
    statusTone: { active: 'success' },
    statusLabel: { active: 'Active' },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Steel widget' },
      { key: 'sku', label: 'SKU', type: 'text', required: true, placeholder: 'WID-001' },
      { key: 'sellingPrice', label: 'Selling price', type: 'number', placeholder: '0.00' },
      { key: 'costPrice', label: 'Cost price', type: 'number', placeholder: '0.00' },
      {
        key: 'itemType',
        label: 'Type',
        type: 'select',
        initial: 'goods',
        options: [
          { value: 'goods', label: 'Goods' },
          { value: 'service', label: 'Service' },
        ],
      },
      { key: 'currency', label: 'Currency', type: 'select', initial: 'INR', options: CURRENCY_OPTIONS },
    ],
    deleteVerb: 'Delete',
    create: (v) =>
      createSabcrmSupplyItem({
        name: v.name ?? '',
        sku: v.sku ?? '',
        sellingPrice: v.sellingPrice ? Number(v.sellingPrice) : undefined,
        costPrice: v.costPrice ? Number(v.costPrice) : undefined,
        itemType: v.itemType || undefined,
        currency: v.currency || undefined,
      }),
    remove: deleteSabcrmSupplyItem,
  },
  warehouses: {
    title: 'Warehouses',
    description:
      'Stocking locations — main, branch, franchise, 3PL, and virtual tiers — part of the SabCRM Supply suite.',
    singular: 'warehouse',
    emptyIcon: Warehouse,
    columns: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'code', label: 'Code', kind: 'text' },
      { key: 'type', label: 'Type', kind: 'text' },
      { key: 'city', label: 'City', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      active: 'success',
      inactive: 'warning',
      archived: 'neutral',
    },
    statusLabel: {
      active: 'Active',
      inactive: 'Inactive',
      archived: 'Archived',
    },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Main warehouse' },
      { key: 'code', label: 'Code', type: 'text', placeholder: 'WH-01' },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        initial: 'main',
        options: [
          { value: 'main', label: 'Main' },
          { value: 'branch', label: 'Branch' },
          { value: 'franchise', label: 'Franchise' },
          { value: '3pl', label: '3PL' },
          { value: 'virtual', label: 'Virtual' },
        ],
      },
      { key: 'city', label: 'City', type: 'text', placeholder: 'Bengaluru' },
    ],
    deleteVerb: 'Archive',
    create: (v) =>
      createSabcrmSupplyWarehouse({
        name: v.name ?? '',
        code: v.code || undefined,
        type: v.type || undefined,
        city: v.city || undefined,
      }),
    remove: deleteSabcrmSupplyWarehouse,
  },
  'stock-adjustments': {
    title: 'Stock adjustments',
    description:
      'Manual stock corrections — damage, counts, transfers in/out — with an approval trail. Part of the SabCRM Supply suite.',
    singular: 'adjustment',
    emptyIcon: Scale,
    columns: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'adjustmentNumber', label: 'Number', kind: 'text' },
      { key: 'reason', label: 'Reason', kind: 'text' },
      { key: 'quantity', label: 'Quantity', kind: 'number' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      pending: 'warning',
      approved: 'success',
      rejected: 'danger',
    },
    statusLabel: {
      pending: 'Pending',
      approved: 'Approved',
      rejected: 'Rejected',
    },
    fields: [
      { key: 'reason', label: 'Reason', type: 'text', required: true, placeholder: 'Damage / Inventory count' },
      { key: 'quantity', label: 'Quantity (±)', type: 'number', required: true, placeholder: '-3' },
      { key: 'warehouseId', label: 'Warehouse', type: 'select', required: true, optionsKey: 'warehouses' },
      { key: 'productId', label: 'Item', type: 'select', required: true, optionsKey: 'items' },
      { key: 'date', label: 'Date', type: 'date', initial: today() },
    ],
    deleteVerb: 'Delete',
    create: (v) =>
      createSabcrmSupplyStockAdjustment({
        reason: v.reason ?? '',
        quantity: Number(v.quantity),
        warehouseId: v.warehouseId ?? '',
        productId: v.productId ?? '',
        date: v.date || undefined,
      }),
    remove: deleteSabcrmSupplyStockAdjustment,
  },
  'purchase-orders': {
    title: 'Purchase orders',
    description:
      'Orders placed with vendors — draft through receipt — part of the SabCRM Supply suite.',
    singular: 'purchase order',
    emptyIcon: ClipboardList,
    columns: [
      { key: 'poNo', label: 'PO #', kind: 'text' },
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'vendor', label: 'Vendor', kind: 'text' },
      { key: 'total', label: 'Total', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      draft: 'neutral',
      awaiting_approval: 'warning',
      approved: 'success',
      sent: 'info',
      partial: 'warning',
      received: 'success',
      closed: 'neutral',
      cancelled: 'danger',
    },
    statusLabel: {
      draft: 'Draft',
      awaiting_approval: 'Awaiting approval',
      approved: 'Approved',
      sent: 'Sent',
      partial: 'Partially received',
      received: 'Received',
      closed: 'Closed',
      cancelled: 'Cancelled',
    },
    fields: [
      { key: 'poNo', label: 'PO number', type: 'text', required: true, placeholder: 'PO-2026-0001' },
      { key: 'date', label: 'Date', type: 'date', required: true, initial: today() },
      { key: 'vendorId', label: 'Vendor', type: 'select', required: true, optionsKey: 'vendors' },
      { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
      { key: 'currency', label: 'Currency', type: 'select', initial: 'INR', options: CURRENCY_OPTIONS },
    ],
    deleteVerb: 'Delete',
    create: (v) =>
      createSabcrmSupplyPurchaseOrder({
        poNo: v.poNo ?? '',
        date: v.date ?? '',
        vendorId: v.vendorId ?? '',
        amount: Number(v.amount),
        currency: v.currency || undefined,
      }),
    remove: deleteSabcrmSupplyPurchaseOrder,
  },
  grn: {
    title: 'Goods receipts',
    description:
      'Goods-receipt notes recording stock arriving from vendors into warehouses — part of the SabCRM Supply suite.',
    singular: 'GRN',
    emptyIcon: ClipboardCheck,
    columns: [
      { key: 'grnNo', label: 'GRN #', kind: 'text' },
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'vendor', label: 'Vendor', kind: 'text' },
      { key: 'warehouse', label: 'Warehouse', kind: 'text' },
      { key: 'lines', label: 'Lines', kind: 'number' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      draft: 'neutral',
      inspected: 'info',
      posted: 'success',
      rejected: 'danger',
    },
    statusLabel: {
      draft: 'Draft',
      inspected: 'Inspected',
      posted: 'Posted',
      rejected: 'Rejected',
    },
    fields: [
      { key: 'grnNo', label: 'GRN number', type: 'text', required: true, placeholder: 'GRN-2026-0001' },
      { key: 'date', label: 'Date', type: 'date', required: true, initial: today() },
      { key: 'vendorId', label: 'Vendor', type: 'select', required: true, optionsKey: 'vendors' },
      { key: 'warehouseId', label: 'Warehouse', type: 'select', required: true, optionsKey: 'warehouses' },
      { key: 'itemId', label: 'Item received', type: 'select', required: true, optionsKey: 'items' },
      { key: 'qty', label: 'Quantity', type: 'number', required: true, placeholder: '1' },
    ],
    deleteVerb: 'Delete',
    create: (v) =>
      createSabcrmSupplyGrn({
        grnNo: v.grnNo ?? '',
        date: v.date ?? '',
        vendorId: v.vendorId ?? '',
        warehouseId: v.warehouseId ?? '',
        itemId: v.itemId ?? '',
        qty: Number(v.qty),
      }),
    remove: deleteSabcrmSupplyGrn,
  },
  vendors: {
    title: 'Vendors',
    description:
      'Suppliers this workspace buys from — contact, tax, and banking details — part of the SabCRM Supply suite.',
    singular: 'vendor',
    emptyIcon: Store,
    columns: [
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'email', label: 'Email', kind: 'text' },
      { key: 'phone', label: 'Phone', kind: 'text' },
      { key: 'gstin', label: 'GSTIN', kind: 'text' },
      { key: 'vendorType', label: 'Type', kind: 'text' },
    ],
    statusTone: { active: 'success' },
    statusLabel: { active: 'Active' },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Acme Supplies Pvt Ltd' },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'ops@acme.example' },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: '+91 98765 43210' },
      { key: 'gstin', label: 'GSTIN', type: 'text', placeholder: '29ABCDE1234F1Z5' },
      {
        key: 'vendorType',
        label: 'Vendor type',
        type: 'select',
        initial: 'Goods Supplier',
        options: [
          { value: 'Goods Supplier', label: 'Goods supplier' },
          { value: 'Service Provider', label: 'Service provider' },
          { value: 'Contractor', label: 'Contractor' },
        ],
      },
    ],
    deleteVerb: 'Delete',
    create: (v) =>
      createSabcrmSupplyVendor({
        name: v.name ?? '',
        email: v.email || undefined,
        phone: v.phone || undefined,
        gstin: v.gstin || undefined,
        vendorType: v.vendorType || undefined,
      }),
    remove: deleteSabcrmSupplyVendor,
  },
  rfqs: {
    title: 'RFQs',
    description:
      'Requests for quotation broadcast to vendors — vendor bids attach to these. Part of the SabCRM Supply suite.',
    singular: 'RFQ',
    emptyIcon: Boxes,
    columns: [
      { key: 'title', label: 'Title', kind: 'text' },
      { key: 'lines', label: 'Lines', kind: 'number' },
      { key: 'requiredBy', label: 'Required by', kind: 'date' },
      { key: 'deadline', label: 'Bid deadline', kind: 'date' },
      { key: 'bids', label: 'Bids', kind: 'number' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      draft: 'neutral',
      open: 'info',
      closed: 'neutral',
      awarded: 'success',
      cancelled: 'danger',
    },
    statusLabel: {
      draft: 'Draft',
      open: 'Open',
      closed: 'Closed',
      awarded: 'Awarded',
      cancelled: 'Cancelled',
    },
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, placeholder: 'Q3 raw-material restock' },
      { key: 'itemId', label: 'Item', type: 'select', required: true, optionsKey: 'items' },
      { key: 'qty', label: 'Quantity', type: 'number', required: true, placeholder: '100' },
      { key: 'requiredBy', label: 'Required by', type: 'date' },
      { key: 'deadline', label: 'Bid deadline', type: 'date' },
    ],
    deleteVerb: 'Delete',
    create: (v) =>
      createSabcrmSupplyRfq({
        title: v.title ?? '',
        itemId: v.itemId ?? '',
        qty: Number(v.qty),
        requiredBy: v.requiredBy || undefined,
        deadline: v.deadline || undefined,
      }),
    remove: deleteSabcrmSupplyRfq,
  },
  'vendor-bids': {
    title: 'Vendor bids',
    description:
      'Quotes vendors submitted against this workspace’s RFQs — shortlist and award from here. Part of the SabCRM Supply suite.',
    singular: 'bid',
    emptyIcon: Gavel,
    columns: [
      { key: 'vendor', label: 'Vendor', kind: 'text' },
      { key: 'rfq', label: 'RFQ', kind: 'text' },
      { key: 'submittedAt', label: 'Submitted', kind: 'date' },
      { key: 'total', label: 'Quoted total', kind: 'amount' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      submitted: 'info',
      shortlisted: 'warning',
      awarded: 'success',
      rejected: 'danger',
      withdrawn: 'neutral',
    },
    statusLabel: {
      submitted: 'Submitted',
      shortlisted: 'Shortlisted',
      awarded: 'Awarded',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn',
    },
    fields: [
      { key: 'rfqId', label: 'RFQ', type: 'select', required: true, optionsKey: 'rfqs' },
      { key: 'vendorId', label: 'Vendor', type: 'select', required: true, optionsKey: 'vendors' },
      { key: 'amount', label: 'Quoted total', type: 'number', required: true, placeholder: '0.00' },
      { key: 'currency', label: 'Currency', type: 'select', initial: 'INR', options: CURRENCY_OPTIONS },
    ],
    deleteVerb: 'Delete',
    create: (v) =>
      createSabcrmSupplyVendorBid({
        rfqId: v.rfqId ?? '',
        vendorId: v.vendorId ?? '',
        amount: Number(v.amount),
        currency: v.currency || undefined,
      }),
    remove: deleteSabcrmSupplyVendorBid,
    rowAction: {
      label: () => 'Award',
      applies: (row) =>
        row.status === 'submitted' || row.status === 'shortlisted',
      run: (row) => updateSabcrmSupplyVendorBidStatus(row.id, 'awarded'),
    },
  },
  bom: {
    title: 'Bills of material',
    description:
      'Recipes that turn components into finished goods — versions, output, and costs. Part of the SabCRM Supply suite.',
    singular: 'BOM',
    emptyIcon: Layers,
    columns: [
      { key: 'bomNo', label: 'BOM #', kind: 'text' },
      { key: 'finishedGoodName', label: 'Finished good', kind: 'text' },
      { key: 'outputQty', label: 'Output', kind: 'number' },
      { key: 'unit', label: 'Unit', kind: 'text' },
      { key: 'version', label: 'Version', kind: 'text' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      draft: 'neutral',
      active: 'success',
      obsolete: 'warning',
      archived: 'neutral',
    },
    statusLabel: {
      draft: 'Draft',
      active: 'Active',
      obsolete: 'Obsolete',
      archived: 'Archived',
    },
    fields: [
      { key: 'bomNo', label: 'BOM number', type: 'text', required: true, placeholder: 'BOM-001' },
      { key: 'finishedGoodName', label: 'Finished good', type: 'text', required: true, placeholder: 'Steel widget' },
      { key: 'outputQty', label: 'Output quantity', type: 'number', required: true, placeholder: '10' },
      { key: 'unit', label: 'Unit', type: 'text', required: true, placeholder: 'pcs' },
    ],
    deleteVerb: 'Archive',
    create: (v) =>
      createSabcrmSupplyBom({
        bomNo: v.bomNo ?? '',
        finishedGoodName: v.finishedGoodName ?? '',
        outputQty: Number(v.outputQty),
        unit: v.unit ?? '',
      }),
    remove: deleteSabcrmSupplyBom,
  },
  'production-orders': {
    title: 'Production orders',
    description:
      'Planned manufacturing runs — planned vs actual yield, scrap, and costs. Part of the SabCRM Supply suite.',
    singular: 'production order',
    emptyIcon: Factory,
    columns: [
      { key: 'orderNo', label: 'Order #', kind: 'text' },
      { key: 'finishedGoodName', label: 'Finished good', kind: 'text' },
      { key: 'plannedQty', label: 'Planned', kind: 'number' },
      { key: 'actualYield', label: 'Yield', kind: 'number' },
      { key: 'plannedStart', label: 'Starts', kind: 'date' },
      { key: 'status', label: 'Status', kind: 'badge' },
    ],
    statusTone: {
      planned: 'info',
      in_progress: 'warning',
      complete: 'success',
      cancelled: 'danger',
      archived: 'neutral',
    },
    statusLabel: {
      planned: 'Planned',
      in_progress: 'In progress',
      complete: 'Complete',
      cancelled: 'Cancelled',
      archived: 'Archived',
    },
    fields: [
      { key: 'finishedGoodName', label: 'Finished good', type: 'text', required: true, placeholder: 'Steel widget' },
      { key: 'plannedQty', label: 'Planned quantity', type: 'number', required: true, placeholder: '100' },
      { key: 'unit', label: 'Unit', type: 'text', required: true, placeholder: 'pcs' },
      { key: 'plannedStart', label: 'Planned start', type: 'date', initial: today() },
    ],
    deleteVerb: 'Archive',
    create: (v) =>
      createSabcrmSupplyProductionOrder({
        finishedGoodName: v.finishedGoodName ?? '',
        plannedQty: Number(v.plannedQty),
        unit: v.unit ?? '',
        plannedStart: v.plannedStart || undefined,
      }),
    remove: deleteSabcrmSupplyProductionOrder,
  },
};

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function renderCell(
  col: ColumnDef,
  row: SupplyRow,
  config: SupplyConfig,
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
  config: SupplyConfig;
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
}: NewRecordDialogProps): React.JSX.Element {
  const resolveOptions = React.useCallback(
    (f: FieldDef): SelectOption[] =>
      f.optionsKey ? (selectOptions[f.optionsKey] ?? []) : (f.options ?? []),
    [selectOptions],
  );

  const initialValues = React.useMemo(() => {
    const v: Record<string, string> = {};
    for (const f of config.fields) {
      if (f.initial !== undefined) {
        v[f.key] = f.initial;
        continue;
      }
      // Dynamic single-choice convenience: preselect when exactly one.
      const opts = f.optionsKey ? (selectOptions[f.optionsKey] ?? []) : [];
      v[f.key] = opts.length === 1 ? opts[0].value : '';
    }
    return v;
  }, [config.fields, selectOptions]);

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
            {config.fields.map((f, idx) => {
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
// Page client
// ---------------------------------------------------------------------------

export interface SupplyClientProps {
  kind: SupplyKind;
  initialRows: SupplyRow[];
  /** Non-null when the list fetch failed (e.g. the Rust engine is down). */
  initialError: string | null;
  /**
   * Dynamic select options keyed by `FieldDef.optionsKey` (e.g.
   * `{ vendors: [...], warehouses: [...] }`) — fetched by the server
   * page from the sibling supply lists.
   */
  selectOptions?: Record<string, SelectOption[]>;
}

export function SupplyClient({
  kind,
  initialRows,
  initialError,
  selectOptions = {},
}: SupplyClientProps): React.JSX.Element {
  const config = SUPPLY_CONFIGS[kind];
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState<SupplyRow | null>(
    null,
  );
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [deleting, startDelete] = React.useTransition();
  const [acting, startAction] = React.useTransition();

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

  const handleRowAction = (row: SupplyRow): void => {
    const action = config.rowAction;
    if (!action) return;
    setRowError(null);
    startAction(async () => {
      const res = await action.run(row);
      if (!res.ok) {
        setRowError(res.error);
        return;
      }
      refresh();
    });
  };

  const isArchive = config.deleteVerb === 'Archive';
  const amountAligned = (kindOf: ColumnDef['kind']): boolean =>
    kindOf === 'amount' || kindOf === 'number';

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
                <Th align="right" width={config.rowAction ? 160 : 96}>
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
                    {config.rowAction && config.rowAction.applies(row) ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={acting}
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
                      aria-label={`${config.deleteVerb} ${config.singular} ${row.label}`}
                      onClick={() => {
                        setRowError(null);
                        setConfirmDelete(row);
                      }}
                    >
                      {config.deleteVerb}
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
        selectOptions={selectOptions}
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
              {config.deleteVerb}{' '}
              {confirmDelete?.label ?? `this ${config.singular}`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isArchive
                ? `The ${config.singular} is hidden from lists. Its history is preserved and an admin can restore it later.`
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
            <Button variant="danger" loading={deleting} onClick={handleDelete}>
              {config.deleteVerb} {config.singular}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * SabCRM Finance — doc-surface kit types.
 *
 * The reusable contract every finance document entity (invoices,
 * quotations, bills, credit notes, …) passes into the kit components.
 * The flagship `/sabcrm/finance/invoices` surface is the reference
 * adopter; the other ~45 document surfaces configure these shapes
 * instead of re-building list/form/detail UIs.
 */

import type * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { BadgeTone } from '@/components/sabcrm/20ui';
import type {
  DocLineInput,
  DocTotalsModifiersInput,
} from '@/lib/sabcrm/finance-doc-math';
import type { SabcrmDocAttachmentInput } from '@/app/actions/sabcrm-finance-invoices.actions.types';

/* ─── Results ─────────────────────────────────────────────────── */

/** The `ActionResult` envelope every fetcher resolves to. */
export type DocResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/* ─── Status vocabulary ───────────────────────────────────────── */

/** One status in the entity's workflow vocabulary. */
export interface DocStatusDef {
  value: string;
  label: string;
  tone: BadgeTone;
}

/* ─── Pickers ─────────────────────────────────────────────────── */

/** One option in an entity picker (party / item / account / …). */
export interface DocEntityOption {
  id: string;
  /** Human label — NEVER a raw ObjectId. */
  label: string;
  /** Secondary line (email, SKU, …). */
  meta?: string;
}

/** Item-picker option enriched with line-item defaults. */
export interface DocItemOption extends DocEntityOption {
  rate?: number;
  taxRatePct?: number;
  hsnSac?: string;
  description?: string;
  unit?: string;
}

/* ─── List page ───────────────────────────────────────────────── */

export type DocColumnKind =
  | 'text'
  | 'party'
  | 'money'
  | 'date'
  | 'status'
  | 'badge'
  | 'aging';

/** A typed list column. `value` reads the raw cell value off a row. */
export interface DocListColumn<R> {
  key: string;
  header: string;
  kind: DocColumnKind;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  /**
   * Raw value accessor:
   *  - text/badge ⇒ string
   *  - party ⇒ string | null (resolved label; null renders "Unknown")
   *  - money ⇒ number
   *  - date  ⇒ ISO string
   *  - status ⇒ status value (looked up in `statuses`)
   *  - aging ⇒ number | null (days past due; ≤ 0 renders "—")
   */
  value: (row: R) => unknown;
  /** money columns — ISO-4217 accessor (defaults to "INR"). */
  currency?: (row: R) => string;
  /** badge columns — tone accessor. */
  tone?: (row: R) => BadgeTone;
  /** Optional CSV override (defaults to the formatted cell text). */
  csv?: (row: R) => string;
}

/** Filters the list page maintains and hands to its fetchers. */
export interface DocListFilters {
  page: number;
  q: string;
  /** Status value or '' for all. */
  status: string;
  /** Party record id or '' for all. */
  partyId: string;
  /** Inclusive `YYYY-MM-DD` bounds. */
  from?: string;
  to?: string;
}

/** One bulk action shown when rows are selected. */
export interface DocBulkAction<R> {
  key: string;
  label: string;
  icon?: LucideIcon;
  tone?: 'default' | 'danger';
  /** Runs over the selected rows; the list refetches afterwards. */
  run: (rows: R[]) => Promise<DocResult<unknown>>;
  /** Optional confirm copy — renders an AlertDialog first. */
  confirm?: { title: string; description: string; actionLabel: string };
}

export interface DocListPageConfig<R extends { id: string }> {
  /** Page chrome. */
  title: string;
  description: string;
  icon: LucideIcon;
  entity: { singular: string; plural: string };

  columns: DocListColumn<R>[];
  statuses: DocStatusDef[];

  /** Server pagination fetcher. */
  fetchPage: (
    filters: DocListFilters,
  ) => Promise<DocResult<{ rows: R[]; hasMore: boolean }>>;
  /** Capped fetch-all for CSV export (falls back to the loaded page). */
  fetchAllForCsv?: (filters: DocListFilters) => Promise<DocResult<R[]>>;
  csvFileName?: string;

  /** Row navigation (detail page). Return null for non-navigable rows. */
  rowHref?: (row: R) => string | null;
  /** Accessible row label ("invoice INV-2026-0001"). */
  rowLabel: (row: R) => string;

  /** Party filter picker (toolbar). Omit to hide. */
  partyFilter?: {
    placeholder: string;
    search: (q: string) => Promise<DocEntityOption[]>;
  };

  bulkActions?: DocBulkAction<R>[];
  pageSize?: number;
}

/* ─── Form ────────────────────────────────────────────────────── */

/** A draft line — kit-internal row identity + picked-item label cache. */
export interface DocLineDraft extends DocLineInput {
  /** Stable client-side row key. */
  rowId: string;
  /** Display label of the picked catalog item (null = free-text row). */
  itemLabel?: string | null;
}

/** What the doc form edits and submits. */
export interface DocFormValues {
  number: string;
  partyId: string | null;
  /** Cached label so re-opened forms never show an id. */
  partyLabel: string | null;
  currency: string;
  /** `YYYY-MM-DD`. */
  date: string;
  /** `YYYY-MM-DD`. */
  dueDate: string;
  lines: DocLineDraft[];
  paymentTerms: string;
  customerNotes: string;
  termsAndConditions: string;
  attachments: SabcrmDocAttachmentInput[];
  /* ---- tax header (rendered when `config.taxFields` is set) ---- */
  /** Place of supply — free-text state name (legacy convention). */
  placeOfSupply?: string;
  /** GST treatment wire value (from `config.taxFields.gstTreatments`). */
  gstTreatment?: string | null;
  /** TCS %, 0–100. `undefined` = not applicable. */
  tcsPct?: number;
  /** TDS %, 0–100. `undefined` = not applicable. */
  tdsPct?: number;
  /* ---- header totals modifiers (`config.totalsModifiers`) ------ */
  modifiers?: DocTotalsModifiersInput;
}

export interface DocFormConfig {
  /** "Invoice" — drives headings + button copy. */
  entitySingular: string;
  numberLabel: string;
  partyLabel: string;
  partyPlaceholder: string;
  dateLabel: string;
  dueDateLabel: string;
  /** Allow the "save + issue" primary split. */
  issueLabel?: string;

  searchParties: (q: string) => Promise<DocEntityOption[]>;
  searchItems?: (q: string) => Promise<DocItemOption[]>;
  /** Auto-numbering suggestion (override always allowed). */
  suggestNumber?: () => Promise<string | null>;

  currencies?: { value: string; label: string }[];

  /**
   * Tax-header capability. Renders a place-of-supply input (free-text
   * state name per the legacy convention), a treatment Select fed by
   * the entity's wire vocabulary, and — when `withholding` — TCS/TDS %
   * inputs. Omit for entities without a tax header.
   */
  taxFields?: {
    placeOfSupply?: boolean;
    /** Treatment vocabulary (wire value + label). Omit to hide. */
    gstTreatments?: { value: string; label: string }[];
    /** TCS % + TDS % inputs. */
    withholding?: boolean;
  };

  /**
   * Header totals modifiers capability: overall discount, shipping,
   * adjustment and an auto round-off toggle, edited inline in the
   * line-items footer with a live grand-total preview (same math the
   * server persists — `computeDocGrandTotals`).
   */
  totalsModifiers?: boolean;

  /**
   * Free-text line extras capability: compact HSN/SAC + unit inputs on
   * rows without a picked catalog item (picked items keep sourcing both
   * from the catalog).
   */
  lineExtras?: boolean;
}

/* ─── Detail page ─────────────────────────────────────────────── */

/** A computed display line (already rolled up). */
export interface DocDetailLine {
  description: string;
  itemLabel?: string | null;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  discountPct?: number;
  taxRatePct?: number;
  total: number;
}

/** A related document in the lineage rail. */
export interface DocRelatedRef {
  kind: string;
  id: string;
  label: string;
  href: string | null;
  date?: string;
  amount?: number;
  currency?: string;
  status?: string;
  direction: 'parent' | 'child';
}

/** One row in the activity feed. */
export interface DocActivityEntry {
  id: string;
  icon?: LucideIcon;
  title: React.ReactNode;
  meta?: string;
  at?: string;
}

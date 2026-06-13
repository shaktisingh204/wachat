/**
 * SabCRM Projects — client-side view model + formatters.
 *
 * Maps the raw {@link SabcrmRustRecord} wire shape (a `data` bag keyed by field
 * keys) into a typed {@link ProjectVM} the List / Board / Timeline views render,
 * and hosts the small pure formatters they share. Kept free of React so every
 * view file can import it cheaply.
 */

import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';
import {
  PROJECT_FIELDS,
  DEFAULT_PROJECT_STATUS,
  DEFAULT_PROJECT_PRIORITY,
} from '@/lib/sabcrm/projects-object';

/** The three project surfaces the page switches between. */
export type ProjectView = 'list' | 'board' | 'timeline';

/** Type-guard for a `?view=` query value. */
export function asProjectView(v: string | null | undefined): ProjectView {
  return v === 'board' || v === 'timeline' ? v : 'list';
}

/** A flattened, render-ready project. */
export interface ProjectVM {
  id: string;
  name: string;
  status: string;
  priority: string;
  owner: string;
  /** Related record ids (RELATION fields) + enriched display labels. */
  accountId: string | null;
  accountLabel: string | null;
  contactId: string | null;
  contactLabel: string | null;
  dealId: string | null;
  dealLabel: string | null;
  /** ISO `yyyy-mm-dd` (or full ISO) start date, or null. */
  startDate: string | null;
  dueDate: string | null;
  /** 0–100, clamped; null when unset. */
  progress: number | null;
  /** Numeric budget, or null when unset. */
  budget: number | null;
  description: string;
  updatedAt: string;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function num(v: unknown): number | null {
  if (v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isoDate(v: unknown): string | null {
  const s = str(v).trim();
  return s ? s : null;
}

/** Build a {@link ProjectVM} from a raw engine record. */
export function toProjectVM(rec: SabcrmRustRecord): ProjectVM {
  const d = rec.data ?? {};
  const progress = num(d[PROJECT_FIELDS.progress]);
  // Relation labels come from the enriched `__relations` map (present when the
  // record was listed with enrich); fall back to null when unenriched.
  const rel = rec.__relations ?? {};
  const relId = (key: string): string | null => str(d[key]).trim() || null;
  const relLabel = (key: string): string | null => rel[key]?.label ?? null;
  return {
    id: rec.id,
    name: str(d[PROJECT_FIELDS.name]) || 'Untitled project',
    status: str(d[PROJECT_FIELDS.status]) || DEFAULT_PROJECT_STATUS,
    priority: str(d[PROJECT_FIELDS.priority]) || DEFAULT_PROJECT_PRIORITY,
    owner: str(d[PROJECT_FIELDS.owner]),
    accountId: relId(PROJECT_FIELDS.accountId),
    accountLabel: relLabel(PROJECT_FIELDS.accountId),
    contactId: relId(PROJECT_FIELDS.contactId),
    contactLabel: relLabel(PROJECT_FIELDS.contactId),
    dealId: relId(PROJECT_FIELDS.dealId),
    dealLabel: relLabel(PROJECT_FIELDS.dealId),
    startDate: isoDate(d[PROJECT_FIELDS.startDate]),
    dueDate: isoDate(d[PROJECT_FIELDS.dueDate]),
    progress: progress == null ? null : Math.max(0, Math.min(100, progress)),
    budget: num(d[PROJECT_FIELDS.budget]),
    description: str(d[PROJECT_FIELDS.description]),
    updatedAt: rec.updatedAt,
  };
}

/** Parse an ISO/`yyyy-mm-dd` string into a local Date, or null. */
export function parseDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Short human date, e.g. "Jun 5, 2026"; empty string when null. */
export function formatDate(iso: string | null): string {
  const d = parseDate(iso);
  return d
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(d)
    : '';
}

/** Compact currency, e.g. "$12,000"; empty string when null. */
export function formatBudget(value: number | null): string {
  if (value == null) return '';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

/** True when a due date is in the past and the project isn't finished. */
export function isOverdue(p: ProjectVM): boolean {
  if (p.status === 'COMPLETED' || p.status === 'CANCELLED') return false;
  const due = parseDate(p.dueDate);
  return due != null && due.getTime() < Date.now();
}

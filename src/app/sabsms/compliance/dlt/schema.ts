/**
 * SabSMS V2.8 — India DLT registry wire schemas.
 *
 * Pure module (no server-only) so tests can import it. These zod
 * schemas are the TS half of the Rust wire contract: the Mongo docs
 * they validate are read verbatim by the engine's registry loader
 * (`services/sabsms-engine/src/compliance/dlt_store.rs`), so every
 * field is camelCase and `category` is stored in the snake_case form
 * `DltCategory::parse` produces.
 */

import { z } from 'zod';

// ─── Category ─────────────────────────────────────────────────────────────

export const DLT_CATEGORIES = [
  'promotional',
  'service_explicit',
  'service_implicit',
  'transactional',
  'government',
] as const;

export type DltCategory = (typeof DLT_CATEGORIES)[number];

export const DLT_CATEGORY_LABELS: Record<DltCategory, string> = {
  promotional: 'Promotional',
  service_explicit: 'Service (explicit)',
  service_implicit: 'Service (implicit)',
  transactional: 'Transactional',
  government: 'Government',
};

/** Operator header suffix per category (TRAI, May 2025). */
export const DLT_CATEGORY_SUFFIX: Record<DltCategory, 'P' | 'S' | 'T' | 'G'> = {
  promotional: 'P',
  service_explicit: 'S',
  service_implicit: 'S',
  transactional: 'T',
  government: 'G',
};

/**
 * Normalize a portal/CSV category string to the stored snake_case form.
 * Mirrors `DltCategory::parse` in `compliance/dlt.rs` exactly —
 * tolerates hyphens, spaces, and the short forms operator CSVs use.
 * Returns `null` for unrecognized input.
 */
export function normalizeDltCategory(input: string): DltCategory | null {
  const norm = input.trim().toLowerCase().replace(/[-\s]+/g, '_');
  switch (norm) {
    case 'promotional':
    case 'promo':
    case 'p':
      return 'promotional';
    case 'service_explicit':
    case 'se':
      return 'service_explicit';
    case 'service_implicit':
    case 'service':
    case 'si':
      return 'service_implicit';
    case 'transactional':
    case 'txn':
    case 't':
      return 'transactional';
    case 'government':
    case 'govt':
    case 'g':
      return 'government';
    default:
      return null;
  }
}

const categorySchema = z
  .string()
  .transform((s, ctx) => {
    const cat = normalizeDltCategory(s);
    if (!cat) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown DLT category "${s}"`,
      });
      return z.NEVER;
    }
    return cat;
  });

const trimmed = (max: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(max));

export const dltStatusSchema = z.enum(['active', 'inactive']);
export type DltStatus = z.infer<typeof dltStatusSchema>;

// ─── Inputs (CRUD + CSV import) ───────────────────────────────────────────

/** Principal Entity (`sabsms_dlt_entities`). Registry bookkeeping —
 *  the engine reads peIds off templates/chains, not this collection. */
export const dltEntityInputSchema = z.object({
  /** Operator-issued PE_ID (19-digit on most portals; kept loose). */
  peId: trimmed(64),
  name: z.string().transform((s) => s.trim()).pipe(z.string().max(200)).default(''),
  status: dltStatusSchema.default('active'),
});
export type DltEntityInput = z.infer<typeof dltEntityInputSchema>;

/** Registered header / sender id (`sabsms_dlt_headers`). */
export const dltHeaderInputSchema = z.object({
  /** Operator-issued header id. */
  headerId: trimmed(64),
  /** The sender string itself (6-alpha or 6-numeric on most operators). */
  header: trimmed(15),
  category: categorySchema,
});
export type DltHeaderInput = z.infer<typeof dltHeaderInputSchema>;

/** Registered content template (`sabsms_dlt_templates`). */
export const dltTemplateInputSchema = z.object({
  /** Operator-issued content-template id (TE_ID). */
  templateId: trimmed(64),
  /** Registered body with `{#var#}` placeholders. */
  body: z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(4000)),
  category: categorySchema,
  /** Owning principal entity (PE_ID). */
  peId: z.string().transform((s) => s.trim()).pipe(z.string().max(64)).default(''),
  /** Header ids this template is bound to on the portal. */
  headerIds: z.array(z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(64))).default([]),
  status: dltStatusSchema.default('active'),
});
export type DltTemplateInput = z.infer<typeof dltTemplateInputSchema>;

/** PE → TM chain (`sabsms_dlt_chains`, one per workspace). */
export const dltChainInputSchema = z.object({
  peId: trimmed(64),
  /** Telemarketer ids, in delivery order. TRAI caps the chain at 2. */
  tmIds: z
    .array(z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(64)))
    .max(2, 'TRAI allows at most 2 telemarketers in a chain')
    .default([]),
});
export type DltChainInput = z.infer<typeof dltChainInputSchema>;

// ─── Rows (what the page renders) ─────────────────────────────────────────

export interface DltEntityRow extends DltEntityInput {
  id: string;
}
export interface DltHeaderRow extends DltHeaderInput {
  id: string;
}
export interface DltTemplateRow extends DltTemplateInput {
  id: string;
}
export interface DltChainRow extends DltChainInput {
  id: string;
}

export interface DltRegistryView {
  entities: DltEntityRow[];
  headers: DltHeaderRow[];
  templates: DltTemplateRow[];
  chain: DltChainRow | null;
}

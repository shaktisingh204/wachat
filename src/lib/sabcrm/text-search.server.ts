import 'server-only';

/**
 * SabCRM — indexed full-text search runtime (server-only).
 *
 * The current global search (`sabcrm-search.actions.globalSearchTw` over the
 * Rust `searchAll`) is a case-insensitive substring / cosine scan. This module
 * adds a TRUE indexed full-text path: a MongoDB `$text` query over
 * `sabcrm_records`, ranked by `{ $meta: 'textScore' }`.
 *
 * Two pieces:
 *
 *  - {@link ensureTextIndex} — best-effort, idempotent creation of the wildcard
 *    `$text` index. `src/lib/sabcrm/db.ts` already declares the SAME index in
 *    `ensureSabcrmIndexes`; we re-declare the identical spec here so the search
 *    path is self-sufficient (and so callers that never hit `ensureSabcrmIndexes`
 *    still get the index). Mongo allows only ONE `$text` index per collection,
 *    so the spec MUST match db.ts exactly — any mismatch would throw an
 *    `IndexOptionsConflict`, which we swallow.
 *
 *  - {@link searchRecordsText} — run the `$text` query, projectId-scoped (and
 *    owner-scoped by `userId` exactly like the native records runtime in
 *    `./records.server.ts`), excluding soft-deleted rows, optionally restricted
 *    to a set of object slugs. Hits are ranked by text score; labels + matched
 *    snippets are resolved from object metadata via the two-store-safe
 *    `./objects.server` (Rust-backed `getObject`/`listObjects`) path.
 *
 * No record `data.*` is written here — search is read-only, so the AI-fields
 * envelope rules do not apply.
 */

import type { Db, Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { listObjects, getObject } from './objects.server';
import type { FieldMetadata, ObjectMetadata } from './types';
import { buildTextQuery, bestSnippetField } from './text-search';

const RECORDS_COLL = 'sabcrm_records';

/** Default + maximum number of hits returned (mirrors the Rust search cap). */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/** Field types whose values are meaningful free text for snippets. */
const SNIPPET_FIELD_TYPES: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK']);

/**
 * One ranked full-text hit. Shape mirrors the Rust `SabcrmSearchHit`
 * (`{ object, id, label, snippet? }`) so the command-menu / global-search UI
 * can consume either source interchangeably, plus the numeric `score`.
 */
export interface TextSearchHit {
  /** Object slug the record belongs to. */
  object: string;
  /** Hex id of the matched record. */
  id: string;
  /** Human label derived from the object's label field. */
  label: string;
  /** Matched-text snippet (first searchable field containing the term). */
  snippet?: string;
  /** MongoDB `textScore` — higher is more relevant. */
  score: number;
}

/** Options for {@link searchRecordsText}. */
export interface SearchRecordsTextOptions {
  /** Restrict to these object slugs; omitted/empty → every object. */
  objects?: string[];
  /** Max hits to return (clamped to {@link MAX_LIMIT}). */
  limit?: number;
  /**
   * Owner scope. When provided, rows are additionally filtered by `userId`,
   * exactly like the native records runtime (`./records.server.ts`). The gated
   * action passes the session user id so search respects the same owner/ACL
   * boundary as record reads. Omitted → project-wide (the gate is the boundary).
   */
  userId?: string;
}

/* -------------------------------------------------------------------------- */
/* Index                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort, idempotent creation of the wildcard `$text` index over
 * `sabcrm_records`. The spec is byte-for-byte identical to the one declared in
 * `db.ts#ensureSabcrmIndexes` (only one `$text` index is allowed per
 * collection; a differing spec would throw). Any error — index already exists,
 * a conflicting prior spec, an offline Mongo — is swallowed: search degrades to
 * the regex path rather than failing the request.
 *
 * Safe to call on every search; `createIndexes` is a no-op when the index is
 * already present.
 */
export async function ensureTextIndex(db: Db): Promise<boolean> {
  try {
    await db.collection(RECORDS_COLL).createIndexes([
      {
        key: { '$**': 'text' } as Record<string, unknown>,
        weights: { 'data.$**': 2 } as Record<string, unknown>,
        default_language: 'none',
      },
    ] as Parameters<ReturnType<Db['collection']>['createIndexes']>[0]);
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Label + snippet resolution (two-store-safe metadata)                        */
/* -------------------------------------------------------------------------- */

/** Stringify any record value into a snippet-able string (composite-aware). */
function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const k of ['label', 'name', 'title', 'value', 'url', 'text']) {
      const candidate = obj[k];
      if (typeof candidate === 'string' && candidate) return candidate;
    }
    return '';
  }
  return '';
}

/**
 * Pick the field used as a record's title — the explicit `isLabel` field, then
 * the first required TEXT/EMAIL field, then the first TEXT/EMAIL field, then the
 * first field. Mirrors `records.server.ts#pickLabelField`.
 */
function pickLabelField(object: ObjectMetadata): FieldMetadata | undefined {
  const labelled = object.fields.find((f) => f.isLabel);
  if (labelled) return labelled;
  const textish = object.fields.filter(
    (f) => f.type === 'TEXT' || f.type === 'EMAIL',
  );
  const requiredText = textish.find((f) => f.required);
  if (requiredText) return requiredText;
  if (textish.length > 0) return textish[0];
  return object.fields[0];
}

function resolveLabel(
  data: Record<string, unknown>,
  id: string,
  object: ObjectMetadata,
): string {
  const field = pickLabelField(object);
  if (field) {
    const raw = stringifyValue(data[field.key]).trim();
    if (raw) return raw;
  }
  return `${object.labelSingular} ${id.slice(-6)}`;
}

/**
 * The searchable text values of a record, label field first then every other
 * TEXT/EMAIL/PHONE/LINK field, used to compute the matched snippet.
 */
function searchableValues(
  data: Record<string, unknown>,
  object: ObjectMetadata,
): string[] {
  const labelField = pickLabelField(object);
  const ordered: FieldMetadata[] = [];
  if (labelField) ordered.push(labelField);
  for (const f of object.fields) {
    if (f === labelField) continue;
    if (SNIPPET_FIELD_TYPES.has(f.type)) ordered.push(f);
  }
  return ordered.map((f) => stringifyValue(data[f.key])).filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Search                                                                       */
/* -------------------------------------------------------------------------- */

interface TextHitDoc {
  _id: unknown;
  object?: string;
  data?: Record<string, unknown>;
  __textScore?: number;
}

/**
 * Indexed full-text search over `sabcrm_records`.
 *
 * Scope: `projectId` (always) + `userId` (when supplied), soft-deleted rows
 * excluded, optionally restricted to `objects`. Matches via MongoDB `$text`
 * (parsed from `term` by {@link buildTextQuery}), ranked by `{ $meta:
 * 'textScore' }`. Labels + snippets are resolved from object metadata.
 *
 * Returns `[]` for an empty / unusable term and never throws — on any failure
 * (offline Mongo, no text index) it yields `[]` so the caller can fall back to
 * the regex/substring path.
 */
export async function searchRecordsText(
  projectId: string,
  term: string,
  options: SearchRecordsTextOptions = {},
): Promise<TextSearchHit[]> {
  try {
    if (!projectId) return [];
    const query = buildTextQuery(term);
    if (!query.hasTerms) return [];

    const limit = Math.min(
      Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT)),
      MAX_LIMIT,
    );

    const { db } = await connectToDatabase();
    // Idempotent + best-effort; ensures the index exists before we rely on it.
    await ensureTextIndex(db);

    const filter: Document = {
      projectId,
      $text: { $search: query.search },
      // Exclude soft-deleted rows (the Rust store's trash convention; native
      // rows simply lack the field, so `{ $in: [null] }` keeps them).
      deletedAt: { $in: [null] },
    };
    if (options.userId) filter.userId = options.userId;

    const objectSlugs = (options.objects ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (objectSlugs.length === 1) {
      filter.object = objectSlugs[0];
    } else if (objectSlugs.length > 1) {
      filter.object = { $in: objectSlugs };
    }

    const docs = (await db
      .collection(RECORDS_COLL)
      .find(filter, { projection: { __textScore: { $meta: 'textScore' } } })
      .sort({ __textScore: { $meta: 'textScore' } })
      .limit(limit)
      .toArray()) as unknown as TextHitDoc[];

    if (docs.length === 0) return [];

    // Resolve the object metadata each hit needs — once per distinct slug, via
    // the two-store-safe metadata path (`getObject` / `listObjects`).
    const wantedSlugs = new Set(
      docs.map((d) => String(d.object ?? '')).filter(Boolean),
    );
    const metaBySlug = new Map<string, ObjectMetadata>();
    if (objectSlugs.length === 0) {
      // Unrestricted search: one catalogue fetch covers every slug.
      for (const o of await listObjects(projectId)) {
        if (wantedSlugs.has(o.slug)) metaBySlug.set(o.slug, o);
      }
    }
    for (const slug of wantedSlugs) {
      if (metaBySlug.has(slug)) continue;
      const o = await getObject(projectId, slug);
      if (o) metaBySlug.set(slug, o);
    }

    const needles = [...query.phrases, ...query.terms];
    const hits: TextSearchHit[] = [];
    for (const doc of docs) {
      const slug = String(doc.object ?? '');
      const object = metaBySlug.get(slug);
      if (!object) continue;
      const data = doc.data ?? {};
      const id =
        typeof doc._id === 'string' ? doc._id : String(doc._id ?? '');
      if (!id) continue;
      hits.push({
        object: slug,
        id,
        label: resolveLabel(data, id, object),
        snippet: bestSnippetField(searchableValues(data, object), needles),
        score: typeof doc.__textScore === 'number' ? doc.__textScore : 0,
      });
    }
    return hits;
  } catch {
    return [];
  }
}

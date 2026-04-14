'use server';

import { ObjectId } from 'mongodb';
import { revalidatePath } from 'next/cache';

import { connectToDatabase } from '@/lib/mongodb';
import { requireSession, serialize } from '@/lib/hr-crud';
import type {
  WsUniversalSearchIndex,
  WsSearchableType,
  WsSearchFilters,
  WsSearchGroup,
} from '@/lib/worksuite/search-types';
import {
  WS_SEARCHABLE_TYPES,
  WS_TYPE_LABELS,
  defaultSearchUrl,
} from '@/lib/worksuite/search-types';

/**
 * Universal Search — ported from Worksuite PHP/Laravel's
 * `universal_searches` table + search controller. Provides a
 * denormalized, fast regex-scanned index across CRM entities.
 *
 * Collection: `crm_universal_search_index`.
 */

const COL_INDEX = 'crm_universal_search_index';

/** Escape a string so it can be safely used inside a Mongo regex. */
function escapeRegex(input: string): string {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/* ────────────────────────────────────────────────────────────────
 *  indexResource — upsert a searchable entry
 * ─────────────────────────────────────────────────────────────── */

export async function indexResource(
  type: WsSearchableType,
  id: string,
  title: string,
  description?: string,
  keywords?: string[],
  url?: string,
  icon?: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  if (!type || !id || !title) {
    return { ok: false, error: 'type, id and title are required' };
  }

  const { db } = await connectToDatabase();
  const now = new Date();
  const doc = {
    userId: new ObjectId(user._id),
    searchable_type: type,
    searchable_id: String(id),
    title,
    description: description || '',
    keywords: Array.isArray(keywords) ? keywords.filter(Boolean) : [],
    url: url || defaultSearchUrl(type, String(id)),
    icon: icon || '',
    indexed_at: now,
    updatedAt: now,
  };

  await db.collection(COL_INDEX).updateOne(
    {
      userId: new ObjectId(user._id),
      searchable_type: type,
      searchable_id: String(id),
    },
    { $set: doc, $setOnInsert: { createdAt: now } },
    { upsert: true },
  );

  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────
 *  removeFromIndex
 * ─────────────────────────────────────────────────────────────── */

export async function removeFromIndex(
  type: WsSearchableType,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireSession();
  if (!user) return { ok: false, error: 'Access denied' };
  const { db } = await connectToDatabase();
  await db.collection(COL_INDEX).deleteOne({
    userId: new ObjectId(user._id),
    searchable_type: type,
    searchable_id: String(id),
  });
  return { ok: true };
}

/* ────────────────────────────────────────────────────────────────
 *  searchEverything — grouped, case-insensitive regex search
 * ─────────────────────────────────────────────────────────────── */

export async function searchEverything(
  query: string,
  filters?: WsSearchFilters,
): Promise<{ query: string; groups: WsSearchGroup[] }> {
  const user = await requireSession();
  if (!user) return { query, groups: [] };

  const trimmed = (query || '').trim();
  if (!trimmed) return { query: trimmed, groups: [] };

  const { db } = await connectToDatabase();
  const regex = new RegExp(escapeRegex(trimmed), 'i');
  const types =
    filters?.types && filters.types.length > 0
      ? filters.types
      : WS_SEARCHABLE_TYPES;
  const perType = filters?.limitPerType ?? 10;

  const baseFilter = {
    userId: new ObjectId(user._id),
    $or: [
      { title: regex },
      { description: regex },
      { keywords: regex },
    ],
  };

  const groups: WsSearchGroup[] = [];
  for (const type of types) {
    const docs = await db
      .collection(COL_INDEX)
      .find({ ...baseFilter, searchable_type: type })
      .sort({ indexed_at: -1 })
      .limit(perType)
      .toArray();
    if (docs.length === 0) continue;
    groups.push({
      type,
      label: WS_TYPE_LABELS[type] ?? type,
      items: serialize(docs) as WsUniversalSearchIndex[],
    });
  }

  return { query: trimmed, groups };
}

/* ────────────────────────────────────────────────────────────────
 *  reindexAll — wipe + rebuild from core collections
 * ─────────────────────────────────────────────────────────────── */

interface SourceSpec {
  type: WsSearchableType;
  collection: string;
  titleFields: string[];
  descFields?: string[];
  keywordFields?: string[];
}

const REINDEX_SOURCES: SourceSpec[] = [
  {
    type: 'contact',
    collection: 'crm_contacts',
    titleFields: ['name'],
    descFields: ['email', 'company', 'jobTitle'],
    keywordFields: ['email', 'phone', 'tags'],
  },
  {
    type: 'account',
    collection: 'crm_accounts',
    titleFields: ['name'],
    descFields: ['industry', 'website'],
    keywordFields: ['website', 'phone', 'country'],
  },
  {
    type: 'deal',
    collection: 'crm_deals',
    titleFields: ['name'],
    descFields: ['description', 'stage'],
    keywordFields: ['leadSource', 'labels'],
  },
  {
    type: 'lead',
    collection: 'crm_leads',
    titleFields: ['title', 'contactName'],
    descFields: ['company', 'email'],
    keywordFields: ['email', 'phone', 'source'],
  },
  {
    type: 'task',
    collection: 'crm_tasks',
    titleFields: ['title'],
    descFields: ['description'],
    keywordFields: ['status', 'priority'],
  },
  {
    type: 'project',
    collection: 'crm_projects',
    titleFields: ['name', 'title'],
    descFields: ['description'],
  },
  {
    type: 'invoice',
    collection: 'crm_invoices',
    titleFields: ['invoiceNumber', 'title'],
    descFields: ['notes'],
  },
  {
    type: 'ticket',
    collection: 'crm_tickets',
    titleFields: ['subject'],
    descFields: ['description'],
    keywordFields: ['category', 'status', 'priority'],
  },
  {
    type: 'contract',
    collection: 'crm_contracts',
    titleFields: ['subject', 'title'],
    descFields: ['description'],
  },
  {
    type: 'proposal',
    collection: 'crm_proposals',
    titleFields: ['title', 'proposal_number'],
    descFields: ['note'],
  },
];

function firstNonEmpty(
  doc: Record<string, unknown>,
  fields: string[],
): string {
  for (const f of fields) {
    const v = doc[f];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

function collectKeywords(
  doc: Record<string, unknown>,
  fields: string[] = [],
): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const v = doc[f];
    if (!v) continue;
    if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === 'string') out.push(x);
      }
    } else if (typeof v === 'string') {
      out.push(v);
    } else if (typeof v === 'number') {
      out.push(String(v));
    }
  }
  return out;
}

export async function reindexAll(): Promise<{
  ok: boolean;
  indexed: number;
  error?: string;
}> {
  const user = await requireSession();
  if (!user) return { ok: false, indexed: 0, error: 'Access denied' };

  const { db } = await connectToDatabase();
  const userId = new ObjectId(user._id);

  // Wipe the tenant's existing index.
  await db.collection(COL_INDEX).deleteMany({ userId });

  const now = new Date();
  let totalIndexed = 0;

  for (const spec of REINDEX_SOURCES) {
    // Best-effort: skip collections that don't exist or are empty.
    let cursor;
    try {
      cursor = db.collection(spec.collection).find({ userId });
    } catch {
      continue;
    }
    const rows = await cursor.toArray();
    if (rows.length === 0) continue;

    const ops = rows.map((doc) => {
      const raw = doc as Record<string, unknown>;
      const title =
        firstNonEmpty(raw, spec.titleFields) || `[${spec.type} ${doc._id}]`;
      const description = firstNonEmpty(raw, spec.descFields || []);
      const keywords = collectKeywords(raw, spec.keywordFields || []);
      const id = String(doc._id);
      return {
        updateOne: {
          filter: {
            userId,
            searchable_type: spec.type,
            searchable_id: id,
          },
          update: {
            $set: {
              userId,
              searchable_type: spec.type,
              searchable_id: id,
              title,
              description,
              keywords,
              url: defaultSearchUrl(spec.type, id),
              icon: '',
              indexed_at: now,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          upsert: true,
        },
      } as const;
    });

    if (ops.length > 0) {
      await db.collection(COL_INDEX).bulkWrite(ops as any);
      totalIndexed += ops.length;
    }
  }

  revalidatePath('/dashboard/crm/search');
  return { ok: true, indexed: totalIndexed };
}

/* ────────────────────────────────────────────────────────────────
 *  Helper: list raw index rows (for admin views / debugging).
 * ─────────────────────────────────────────────────────────────── */

export async function listIndexEntries(
  type?: WsSearchableType,
  limit = 200,
): Promise<WsUniversalSearchIndex[]> {
  const user = await requireSession();
  if (!user) return [];
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = {
    userId: new ObjectId(user._id),
  };
  if (type) filter.searchable_type = type;
  const docs = await db
    .collection(COL_INDEX)
    .find(filter)
    .sort({ indexed_at: -1 })
    .limit(limit)
    .toArray();
  return serialize(docs) as WsUniversalSearchIndex[];
}

'use server';

import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';

/**
 * Universal cross-module search.
 *
 * Queries text indexes across CRM entities in parallel. All queries are
 * scoped by `userId` so each tenant only sees their own data.
 *
 * Text indexes are created by `scripts/create-indexes.ts` — if a
 * collection lacks one, the call falls back to a case-insensitive
 * regex on the most relevant string field.
 */

type UniversalSearchHit = {
  _id: string;
  title: string;
  subtitle?: string;
  href: string;
};

type UniversalSearchResult = {
  leads: UniversalSearchHit[];
  deals: UniversalSearchHit[];
  clients: UniversalSearchHit[];
  projects: UniversalSearchHit[];
  tasks: UniversalSearchHit[];
  invoices: UniversalSearchHit[];
  tickets: UniversalSearchHit[];
};

const EMPTY_RESULT: UniversalSearchResult = {
  leads: [],
  deals: [],
  clients: [],
  projects: [],
  tasks: [],
  invoices: [],
  tickets: [],
};

type Doc = Record<string, unknown>;

function s(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

async function searchCollection(
  collection: string,
  userId: ObjectId,
  query: string,
  limit: number,
  fields: { titleField: string; subtitleField?: string; fallbackRegexFields: string[] },
  hrefBuilder: (id: string) => string,
): Promise<UniversalSearchHit[]> {
  const { db } = await connectToDatabase();
  const tenantFilter: Doc = { userId };

  try {
    const projection: Doc = { _id: 1, [fields.titleField]: 1 };
    if (fields.subtitleField) projection[fields.subtitleField] = 1;

    const rows = await db
      .collection(collection)
      .find(
        { ...tenantFilter, $text: { $search: query } } as unknown as Doc,
        { projection: { ...projection, score: { $meta: 'textScore' } } } as unknown as Doc,
      )
      .sort({ score: { $meta: 'textScore' } } as unknown as Doc)
      .limit(limit)
      .toArray();
    return rows.map((r) => ({
      _id: String(r._id),
      title: s(r[fields.titleField]) || `(untitled ${collection})`,
      subtitle: fields.subtitleField ? s(r[fields.subtitleField]) || undefined : undefined,
      href: hrefBuilder(String(r._id)),
    }));
  } catch {
    // Fallback — no text index, use regex.
    const re = { $regex: query.slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const or = fields.fallbackRegexFields.map((f) => ({ [f]: re }));
    try {
      const rows = await db
        .collection(collection)
        .find({ ...tenantFilter, $or: or } as unknown as Doc)
        .limit(limit)
        .toArray();
      return rows.map((r) => ({
        _id: String(r._id),
        title: s(r[fields.titleField]) || `(untitled ${collection})`,
        subtitle: fields.subtitleField ? s(r[fields.subtitleField]) || undefined : undefined,
        href: hrefBuilder(String(r._id)),
      }));
    } catch {
      return [];
    }
  }
}

export async function searchAll(
  query: string,
  limit: number = 5,
): Promise<UniversalSearchResult> {
  const q = (query ?? '').trim();
  if (q.length < 2) return EMPTY_RESULT;

  const session = await getSession();
  if (!session?.user?._id) return EMPTY_RESULT;
  const userId = new ObjectId(String(session.user._id));

  const [leads, deals, clients, projects, tasks, invoices, tickets] = await Promise.all([
    searchCollection(
      'crm_leads',
      userId,
      q,
      limit,
      { titleField: 'name', subtitleField: 'email', fallbackRegexFields: ['name', 'email', 'company'] },
      (id) => `/dashboard/crm/sales-crm/all-leads/${id}`,
    ),
    searchCollection(
      'crm_deals',
      userId,
      q,
      limit,
      { titleField: 'name', subtitleField: 'stage', fallbackRegexFields: ['name', 'stage'] },
      (id) => `/dashboard/crm/deals/${id}`,
    ),
    searchCollection(
      'crm_clients',
      userId,
      q,
      limit,
      { titleField: 'companyName', subtitleField: 'email', fallbackRegexFields: ['companyName', 'name', 'email'] },
      (id) => `/dashboard/crm/clients/${id}`,
    ),
    searchCollection(
      'crm_projects',
      userId,
      q,
      limit,
      { titleField: 'name', subtitleField: 'status', fallbackRegexFields: ['name', 'description'] },
      (id) => `/dashboard/crm/projects/${id}`,
    ),
    searchCollection(
      'crm_tasks',
      userId,
      q,
      limit,
      { titleField: 'title', subtitleField: 'status', fallbackRegexFields: ['title', 'description'] },
      (id) => `/dashboard/crm/projects/tasks/${id}`,
    ),
    searchCollection(
      'crm_invoices',
      userId,
      q,
      limit,
      { titleField: 'invoiceNumber', subtitleField: 'status', fallbackRegexFields: ['invoiceNumber', 'notes'] },
      (id) => `/dashboard/crm/invoices/${id}`,
    ),
    searchCollection(
      'crm_tickets',
      userId,
      q,
      limit,
      { titleField: 'subject', subtitleField: 'status', fallbackRegexFields: ['subject', 'description'] },
      (id) => `/dashboard/sabdesk/${id}`,
    ),
  ]);

  return { leads, deals, clients, projects, tasks, invoices, tickets };
}

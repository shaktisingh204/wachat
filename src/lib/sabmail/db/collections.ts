import 'server-only';

import { type Collection, type Db, type IndexSpecification } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { SabmailAccount, SabmailSettings } from '../types';

/**
 * Typed accessors for the collections owned by SabMail.
 *
 * Every collection is scoped by `workspaceId` (the `kind:'mail'` project
 * `_id` string). The names cover the full SabMail roadmap so later phases
 * don't have to restructure; Phase 0 only reads/writes `accounts` +
 * `settings`. Strongly-typed accessors are exposed for those two; the rest
 * are reserved by name and typed on demand as their phases land.
 */

export const SABMAIL_COLLECTIONS = {
  accounts: 'sabmail_accounts',
  messages: 'sabmail_messages',
  threads: 'sabmail_threads',
  contacts: 'sabmail_contacts',
  labels: 'sabmail_labels',
  drafts: 'sabmail_drafts',
  campaigns: 'sabmail_campaigns',
  templates: 'sabmail_templates',
  journeys: 'sabmail_journeys',
  domains: 'sabmail_domains',
  suppressions: 'sabmail_suppressions',
  events: 'sabmail_events',
  webhooksOut: 'sabmail_webhooks_out',
  settings: 'sabmail_settings',
} as const;

export type SabmailCollectionName =
  (typeof SABMAIL_COLLECTIONS)[keyof typeof SABMAIL_COLLECTIONS];

export interface SabmailCollections {
  accounts: Collection<SabmailAccount>;
  settings: Collection<SabmailSettings>;
}

export async function getSabmailCollections(): Promise<{
  db: Db;
  cols: SabmailCollections;
}> {
  const { db } = await connectToDatabase();
  const cols: SabmailCollections = {
    accounts: db.collection<SabmailAccount>(SABMAIL_COLLECTIONS.accounts),
    settings: db.collection<SabmailSettings>(SABMAIL_COLLECTIONS.settings),
  };
  return { db, cols };
}

/** Index spec executed lazily on first access (idempotent). */
const INDEXES: Record<
  keyof SabmailCollections,
  Array<[IndexSpecification, Record<string, unknown>?]>
> = {
  accounts: [
    [{ workspaceId: 1, status: 1 }],
    [{ workspaceId: 1, email: 1 }, { unique: true }],
  ],
  settings: [[{ workspaceId: 1 }, { unique: true }]],
};

let indexesEnsured = false;

/** Idempotently create every SabMail index. Safe to call repeatedly. */
export async function ensureSabmailIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const { cols } = await getSabmailCollections();
  await Promise.all(
    (Object.entries(INDEXES) as Array<
      [keyof SabmailCollections, Array<[IndexSpecification, Record<string, unknown>?]>]
    >).map(async ([name, specs]) => {
      const collection = cols[name];
      for (const [spec, options] of specs) {
        await collection.createIndex(spec, options ?? {});
      }
    }),
  );
  indexesEnsured = true;
}

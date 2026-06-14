import 'server-only';

import { type Collection, type Db, type IndexSpecification } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import type {
  SabAdminSettings,
  SabAdminAccessPackage,
  SabAdminProvision,
  SabAdminAuditEntry,
} from '../types';

/**
 * Typed accessors for the collections owned by the SabNode Admin Center.
 *
 * Every doc is scoped by `ownerUserId` (the tenant owner's `users._id` string).
 * The login account (`users`), HR record (`crm_employees`) and mailbox
 * (`sabmail_accounts`) live in their existing home collections — these four are
 * the connective tissue + governance log.
 */
export const SABADMIN_COLLECTIONS = {
  settings: 'sabadmin_settings',
  packages: 'sabadmin_access_packages',
  provisions: 'sabadmin_provisions',
  audit: 'sabadmin_audit',
} as const;

export interface SabAdminCollections {
  settings: Collection<SabAdminSettings>;
  packages: Collection<SabAdminAccessPackage>;
  provisions: Collection<SabAdminProvision>;
  audit: Collection<SabAdminAuditEntry>;
}

export async function getSabAdminCollections(): Promise<{
  db: Db;
  cols: SabAdminCollections;
}> {
  const { db } = await connectToDatabase();
  const cols: SabAdminCollections = {
    settings: db.collection<SabAdminSettings>(SABADMIN_COLLECTIONS.settings),
    packages: db.collection<SabAdminAccessPackage>(SABADMIN_COLLECTIONS.packages),
    provisions: db.collection<SabAdminProvision>(SABADMIN_COLLECTIONS.provisions),
    audit: db.collection<SabAdminAuditEntry>(SABADMIN_COLLECTIONS.audit),
  };
  return { db, cols };
}

const INDEXES: Record<
  keyof SabAdminCollections,
  Array<[IndexSpecification, Record<string, unknown>?]>
> = {
  settings: [[{ ownerUserId: 1 }, { unique: true }]],
  packages: [[{ ownerUserId: 1, name: 1 }, { unique: true }]],
  provisions: [
    [{ ownerUserId: 1, status: 1 }],
    [{ ownerUserId: 1, upn: 1 }, { unique: true }],
    [{ userId: 1 }],
  ],
  audit: [[{ ownerUserId: 1, ts: -1 }]],
};

let indexesEnsured = false;

/** Idempotently create every SabAdmin index. Safe to call repeatedly. */
export async function ensureSabAdminIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const { cols } = await getSabAdminCollections();
  await Promise.all(
    (Object.entries(INDEXES) as Array<
      [keyof SabAdminCollections, Array<[IndexSpecification, Record<string, unknown>?]>]
    >).map(async ([name, specs]) => {
      const collection = cols[name];
      for (const [spec, options] of specs) {
        try {
          await collection.createIndex(spec, options ?? {});
        } catch {
          /* index may pre-exist with different options — non-fatal */
        }
      }
    }),
  );
  indexesEnsured = true;
}

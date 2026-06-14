import 'server-only';

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSabAdminCollections } from './db/collections';
import type { PersonRow } from './dto';

/** People in the org's directory (provisioned employees), newest first. */
export async function listSabAdminPeople(ownerUserId: string): Promise<PersonRow[]> {
  const { cols } = await getSabAdminCollections();
  const provisions = await cols.provisions
    .find({ ownerUserId })
    .sort({ createdAt: -1 })
    .limit(1000)
    .toArray();

  // Resolve mailbox status in one batched lookup.
  const mailboxIds = provisions
    .map((p) => p.mailboxAccountId)
    .filter((id): id is string => !!id && ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
  const mailboxStatus = new Map<string, string>();
  if (mailboxIds.length > 0) {
    const { db } = await connectToDatabase();
    const accounts = await db
      .collection('sabmail_accounts')
      .find({ _id: { $in: mailboxIds } }, { projection: { status: 1 } })
      .toArray();
    for (const a of accounts) mailboxStatus.set(String(a._id), String((a as { status?: unknown }).status ?? ''));
  }

  return provisions.map((p) => ({
    userId: p.userId,
    employeeId: p.employeeId ?? null,
    upn: p.upn,
    displayName: p.displayName,
    status: p.status,
    mailboxStatus: p.mailboxAccountId ? mailboxStatus.get(p.mailboxAccountId) ?? null : null,
    grantedApps: p.grantedApps ?? [],
    packageIds: p.packageIds ?? [],
    createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
  }));
}

export interface SabAdminOverviewCounts {
  people: number;
  active: number;
  suspended: number;
  offboarded: number;
  packages: number;
}

/** Headline counts for the Admin Center overview. */
export async function getSabAdminOverviewCounts(
  ownerUserId: string,
): Promise<SabAdminOverviewCounts> {
  const { cols } = await getSabAdminCollections();
  const [people, active, suspended, offboarded, packages] = await Promise.all([
    cols.provisions.countDocuments({ ownerUserId }),
    cols.provisions.countDocuments({ ownerUserId, status: 'active' }),
    cols.provisions.countDocuments({ ownerUserId, status: 'suspended' }),
    cols.provisions.countDocuments({ ownerUserId, status: 'offboarded' }),
    cols.packages.countDocuments({ ownerUserId }),
  ]);
  return { people, active, suspended, offboarded, packages };
}

/** A single person's full provision record (for the detail panel). */
export async function getSabAdminPerson(ownerUserId: string, userId: string) {
  const { cols } = await getSabAdminCollections();
  return cols.provisions.findOne({ ownerUserId, userId });
}

/**
 * Marketplace billing — usage metering and revenue split.
 *
 * `recordAppUsage` increments the install's `usageUnits` counter and writes a
 * usage event. `commissionForInstall` computes the developer/platform split
 * for a gross amount, defaulting to a 70/30 split in the developer's favour.
 *
 * Currency math is done in integer minor units (e.g. cents) to avoid float
 * drift; callers should normalise to that representation before invoking.
 */

import 'server-only';
import { ObjectId, type Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getInstallsCollection } from './install';

/** Default developer share (in basis points; 10000 = 100%). */
export const DEFAULT_DEVELOPER_BPS = 7000;

interface UsageDoc {
  _id: ObjectId;
  installId: ObjectId;
  appId: string;
  tenantId: string;
  units: number;
  meta?: Record<string, unknown>;
  recordedAt: Date;
}

async function getUsageCollection(): Promise<Collection<UsageDoc>> {
  const { db } = await connectToDatabase();
  const col = db.collection<UsageDoc>('marketplace_usage');
  try {
    await col.createIndex({ installId: 1, recordedAt: -1 });
    await col.createIndex({ appId: 1, tenantId: 1, recordedAt: -1 });
  } catch {
    /* indexes exist */
  }
  return col;
}

export interface UsageRecord {
  installId: string;
  appId: string;
  tenantId: string;
  totalUnits: number;
  recordedAt: Date;
}

/**
 * Record metered usage against an install. Atomically bumps the install's
 * `usageUnits` aggregate and inserts a usage event for ledger purposes.
 *
 * Throws when the install is missing or `units` is non-positive.
 */
export async function recordAppUsage(
  installId: string,
  units: number,
  meta?: Record<string, unknown>,
): Promise<UsageRecord> {
  if (!installId || !ObjectId.isValid(installId)) {
    throw new Error('Valid installId is required');
  }
  if (typeof units !== 'number' || !Number.isFinite(units) || units <= 0) {
    throw new Error('units must be a positive number');
  }

  const installs = await getInstallsCollection();
  const _id = new ObjectId(installId);

  const updated = await installs.findOneAndUpdate(
    { _id },
    { $inc: { usageUnits: units }, $set: { updatedAt: new Date() } },
    { returnDocument: 'after' },
  );
  // The mongodb driver returns either the document directly (v6+) or an
  // { value } envelope (v5 and earlier). Normalise both shapes safely.
  const raw = updated as unknown;
  const doc =
    raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)
      ? ((raw as { value: unknown }).value as
          | { _id: ObjectId; tenantId: string; appId: string; usageUnits: number }
          | null)
      : (raw as
          | { _id: ObjectId; tenantId: string; appId: string; usageUnits: number }
          | null);
  if (!doc) {
    throw new Error(`Install not found: ${installId}`);
  }

  const usage = await getUsageCollection();
  const now = new Date();
  await usage.insertOne({
    _id: new ObjectId(),
    installId: _id,
    appId: doc.appId,
    tenantId: doc.tenantId,
    units,
    meta,
    recordedAt: now,
  });

  return {
    installId,
    appId: doc.appId,
    tenantId: doc.tenantId,
    totalUnits: doc.usageUnits,
    recordedAt: now,
  };
}

export interface CommissionSplit {
  /** Amount accrued to the app developer, in the same units as `gross`. */
  developer: number;
  /** Amount retained by SabNode, in the same units as `gross`. */
  sabnode: number;
  /** Developer share as basis points. */
  developerBps: number;
}

/**
 * Computes the developer / SabNode split for a gross amount on a given
 * install. Currently a flat 70/30 default — when per-app overrides exist on
 * the App document we pick those up. `gross` is opaque; callers should pass
 * minor units (cents/paise) for cash safety.
 */
export async function commissionForInstall(
  installId: string,
  gross: number,
): Promise<CommissionSplit> {
  if (typeof gross !== 'number' || !Number.isFinite(gross) || gross < 0) {
    throw new Error('gross must be a non-negative number');
  }
  if (!installId || !ObjectId.isValid(installId)) {
    throw new Error('Valid installId is required');
  }

  const developerBps = await resolveDeveloperBps(installId);
  // Round half-to-even-style: floor for developer to avoid over-paying.
  const developer = Math.floor((gross * developerBps) / 10000);
  const sabnode = gross - developer;
  return { developer, sabnode, developerBps };
}

async function resolveDeveloperBps(installId: string): Promise<number> {
  try {
    const installs = await getInstallsCollection();
    const install = await installs.findOne({ _id: new ObjectId(installId) });
    if (!install) return DEFAULT_DEVELOPER_BPS;

    const { db } = await connectToDatabase();
    const app = await db.collection('marketplace_apps').findOne({ appId: install.appId });
    const override = app?.commissionDeveloperBps;
    if (typeof override === 'number' && override >= 0 && override <= 10000) {
      return override;
    }
  } catch (err) {
    console.error('[marketplace.commission] failed to resolve override', err);
  }
  return DEFAULT_DEVELOPER_BPS;
}

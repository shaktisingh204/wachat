import 'server-only';

import { randomUUID } from 'node:crypto';
import { ObjectId, type Collection, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';

/**
 * SabSMS credits ledger — the real balance source of truth.
 *
 * Balance lives on the `users` collection at `users.credits.sms`
 * (workspaceId in SabSMS == the user `_id` hex string; undefined is
 * treated as 0). Holds are taken ATOMICALLY with a conditional `$inc`
 * so concurrent sends can never overdraw.
 *
 * Two collections:
 *   - `sabsms_credit_reservations` — mutable hold state machine
 *     (held → finalised | released), expiring +15 min.
 *   - `sabsms_credit_ledger`       — append-only audit trail
 *     (debit / release / adjust rows; delta negative = debit).
 */

export const SABSMS_CREDIT_COLLECTIONS = {
  reservations: 'sabsms_credit_reservations',
  ledger: 'sabsms_credit_ledger',
} as const;

const HOLD_TTL_MS = 15 * 60 * 1000;

export type SabsmsReservationStatus = 'held' | 'finalised' | 'released';

export interface SabsmsCreditReservation {
  _id?: ObjectId;
  /** Opaque uuid handed to the engine — presented back at finalise. */
  token: string;
  workspaceId: string;
  messageId?: string;
  campaignId?: string;
  /** Held amount in integer credits. */
  amount: number;
  /** Batch metadata (reserveBatch only). */
  count?: number;
  segmentsTotal?: number;
  status: SabsmsReservationStatus;
  createdAt: Date;
  expiresAt: Date;
  finalisedAt?: Date;
  releasedAt?: Date;
}

export type SabsmsLedgerKind = 'debit' | 'release' | 'adjust';

export interface SabsmsCreditLedgerRow {
  _id?: ObjectId;
  workspaceId: string;
  messageId?: string;
  campaignId?: string;
  reservationToken: string;
  /** Credits moved — negative = debit from the workspace. */
  delta: number;
  kind: SabsmsLedgerKind;
  balanceAfter?: number;
  createdAt: Date;
}

interface LedgerHandles {
  db: Db;
  reservations: Collection<SabsmsCreditReservation>;
  ledger: Collection<SabsmsCreditLedgerRow>;
  users: Collection<{ _id: ObjectId; credits?: { sms?: number } }>;
}

let indexesEnsured = false;

async function handles(): Promise<LedgerHandles> {
  const { db } = await connectToDatabase();
  const reservations = db.collection<SabsmsCreditReservation>(
    SABSMS_CREDIT_COLLECTIONS.reservations,
  );
  const ledger = db.collection<SabsmsCreditLedgerRow>(SABSMS_CREDIT_COLLECTIONS.ledger);
  const users = db.collection<{ _id: ObjectId; credits?: { sms?: number } }>('users');

  if (!indexesEnsured) {
    indexesEnsured = true;
    // Fire-and-forget — createIndex is idempotent.
    void Promise.all([
      reservations.createIndex({ token: 1 }, { unique: true }),
      reservations.createIndex({ workspaceId: 1, status: 1, expiresAt: 1 }),
      ledger.createIndex({ workspaceId: 1, createdAt: -1 }),
      ledger.createIndex({ reservationToken: 1 }),
    ]).catch(() => {
      indexesEnsured = false; // retry on the next call
    });
  }

  return { db, reservations, ledger, users };
}

function toInt(n: number): number {
  return Math.floor(Number(n) || 0);
}

async function appendLedger(
  h: LedgerHandles,
  row: Omit<SabsmsCreditLedgerRow, '_id' | 'createdAt' | 'balanceAfter'>,
): Promise<void> {
  let balanceAfter: number | undefined;
  try {
    balanceAfter = await getSmsCreditBalance(row.workspaceId);
  } catch {
    balanceAfter = undefined;
  }
  await h.ledger.insertOne({ ...row, balanceAfter, createdAt: new Date() });
}

/** Current SMS credit balance — `users.credits.sms`, undefined → 0. */
export async function getSmsCreditBalance(workspaceId: string): Promise<number> {
  if (!ObjectId.isValid(workspaceId)) return 0;
  const h = await handles();
  const user = await h.users.findOne(
    { _id: new ObjectId(workspaceId) },
    { projection: { 'credits.sms': 1 } },
  );
  return typeof user?.credits?.sms === 'number' ? user.credits.sms : 0;
}

export interface ReserveResult {
  approved: boolean;
  reservationToken?: string;
  reason?: 'insufficient_credits' | 'unknown_workspace' | 'invalid_amount';
}

/**
 * Atomically hold `amount` credits for one message. The conditional
 * `$gte` filter + `$inc` make the hold race-safe: two concurrent
 * reservations can never push the balance below zero.
 */
export async function reserveCredits(params: {
  workspaceId: string;
  messageId?: string;
  amount: number;
}): Promise<ReserveResult> {
  return reserveInternal({
    workspaceId: params.workspaceId,
    messageId: params.messageId,
    amount: params.amount,
  });
}

/**
 * Single hold covering a whole campaign chunk — same mechanics as
 * `reserveCredits`, keyed by campaignId instead of messageId.
 */
export async function reserveBatch(params: {
  workspaceId: string;
  campaignId?: string;
  count?: number;
  segmentsTotal?: number;
  amount: number;
}): Promise<ReserveResult> {
  return reserveInternal(params);
}

async function reserveInternal(params: {
  workspaceId: string;
  messageId?: string;
  campaignId?: string;
  count?: number;
  segmentsTotal?: number;
  amount: number;
}): Promise<ReserveResult> {
  const amount = toInt(params.amount);
  if (amount <= 0) {
    return { approved: false, reason: 'invalid_amount' };
  }
  if (!ObjectId.isValid(params.workspaceId)) {
    return { approved: false, reason: 'unknown_workspace' };
  }

  const h = await handles();
  // Atomic conditional debit — only matches when the balance covers the
  // hold (legacy users without `credits.sms` simply don't match → reject).
  const res = await h.users.updateOne(
    { _id: new ObjectId(params.workspaceId), 'credits.sms': { $gte: amount } },
    { $inc: { 'credits.sms': -amount } },
  );
  if (res.modifiedCount === 0) {
    return { approved: false, reason: 'insufficient_credits' };
  }

  const now = new Date();
  const token = randomUUID();
  await h.reservations.insertOne({
    token,
    workspaceId: params.workspaceId,
    ...(params.messageId ? { messageId: params.messageId } : {}),
    ...(params.campaignId ? { campaignId: params.campaignId } : {}),
    ...(typeof params.count === 'number' ? { count: params.count } : {}),
    ...(typeof params.segmentsTotal === 'number' ? { segmentsTotal: params.segmentsTotal } : {}),
    amount,
    status: 'held',
    createdAt: now,
    expiresAt: new Date(now.getTime() + HOLD_TTL_MS),
  });

  return { approved: true, reservationToken: token };
}

export interface FinaliseResult {
  ok: boolean;
  idempotent?: boolean;
  reason?: 'unknown_reservation';
}

/**
 * Settle a hold after the engine reports the send outcome.
 *
 *   - charge=false → refund the held amount, mark released ('release').
 *   - charge=true  → keep the debit, mark finalised ('debit'); when the
 *     actual cost differs from the hold, the difference is adjusted on
 *     the balance and logged as 'adjust'.
 *
 * Idempotent: a reservation that is already finalised/released returns
 * ok without moving credits again (the `status: 'held'` guard on the
 * state transition makes the no-double-spend race-safe too).
 */
export async function finaliseCredits(params: {
  workspaceId: string;
  reservationToken: string;
  actualCost?: number;
  charge: boolean;
}): Promise<FinaliseResult> {
  const h = await handles();
  const now = new Date();

  const reservation = await h.reservations.findOne({
    token: params.reservationToken,
    workspaceId: params.workspaceId,
  });
  if (!reservation) {
    return { ok: false, reason: 'unknown_reservation' };
  }
  if (reservation.status !== 'held') {
    return { ok: true, idempotent: true };
  }

  const base = {
    workspaceId: reservation.workspaceId,
    ...(reservation.messageId ? { messageId: reservation.messageId } : {}),
    ...(reservation.campaignId ? { campaignId: reservation.campaignId } : {}),
    reservationToken: reservation.token,
  };

  if (!params.charge) {
    // Claim the transition first — if another finalise won the race, the
    // guard fails and we treat it as idempotent.
    const claimed = await h.reservations.updateOne(
      { token: reservation.token, status: 'held' },
      { $set: { status: 'released', releasedAt: now } },
    );
    if (claimed.modifiedCount === 0) return { ok: true, idempotent: true };

    if (reservation.amount > 0 && ObjectId.isValid(reservation.workspaceId)) {
      await h.users.updateOne(
        { _id: new ObjectId(reservation.workspaceId) },
        { $inc: { 'credits.sms': reservation.amount } },
      );
    }
    await appendLedger(h, { ...base, delta: reservation.amount, kind: 'release' });
    return { ok: true };
  }

  // charge = true
  const claimed = await h.reservations.updateOne(
    { token: reservation.token, status: 'held' },
    { $set: { status: 'finalised', finalisedAt: now } },
  );
  if (claimed.modifiedCount === 0) return { ok: true, idempotent: true };

  await appendLedger(h, { ...base, delta: -reservation.amount, kind: 'debit' });

  // True-up: actual cost differs from the held amount.
  const actualCost = params.actualCost;
  if (
    typeof actualCost === 'number' &&
    Number.isInteger(actualCost) &&
    actualCost > 0 &&
    actualCost !== reservation.amount &&
    ObjectId.isValid(reservation.workspaceId)
  ) {
    const diff = reservation.amount - actualCost; // + refund, - extra charge
    await h.users.updateOne(
      { _id: new ObjectId(reservation.workspaceId) },
      { $inc: { 'credits.sms': diff } },
    );
    await appendLedger(h, { ...base, delta: diff, kind: 'adjust' });
  }

  return { ok: true };
}

/**
 * Lazy sweep: refund holds whose `expiresAt` passed without a finalise.
 * Called opportunistically (fire-and-forget) from the credits route.
 */
export async function releaseExpiredHolds(limit = 20): Promise<number> {
  const h = await handles();
  const now = new Date();
  const expired = await h.reservations
    .find({ status: 'held', expiresAt: { $lt: now } })
    .limit(Math.max(1, limit))
    .toArray();

  let released = 0;
  for (const reservation of expired) {
    const claimed = await h.reservations.updateOne(
      { token: reservation.token, status: 'held' },
      { $set: { status: 'released', releasedAt: now } },
    );
    if (claimed.modifiedCount === 0) continue; // raced with a finalise

    if (reservation.amount > 0 && ObjectId.isValid(reservation.workspaceId)) {
      await h.users.updateOne(
        { _id: new ObjectId(reservation.workspaceId) },
        { $inc: { 'credits.sms': reservation.amount } },
      );
    }
    await appendLedger(h, {
      workspaceId: reservation.workspaceId,
      ...(reservation.messageId ? { messageId: reservation.messageId } : {}),
      ...(reservation.campaignId ? { campaignId: reservation.campaignId } : {}),
      reservationToken: reservation.token,
      delta: reservation.amount,
      kind: 'release',
    });
    released += 1;
  }
  return released;
}

/**
 * SabSMS credits — worker-safe atomic movement core (V2.12 dedup).
 *
 * The canonical balance mechanics (conditional `$inc` on
 * `users.credits.sms`, the `sabsms_credit_reservations` state machine,
 * and append-only `sabsms_credit_ledger` rows) live HERE as pure
 * functions that take a `Db`. This module has NO `server-only` import
 * and NO `@/` path, so it loads inside the tsx events worker as well as
 * the Next server.
 *
 * `credits/ledger.ts` is a thin `server-only` wrapper that calls
 * `connectToDatabase()` and delegates to these functions; the agent
 * store (`agent/store.ts`) calls `instantDebit` directly. Single source
 * of truth — no hand-mirrored copies that can drift.
 */

import { randomUUID } from 'node:crypto';
import { ObjectId, type Collection, type Db } from 'mongodb';

export const SABSMS_CREDIT_COLLECTIONS = {
  reservations: 'sabsms_credit_reservations',
  ledger: 'sabsms_credit_ledger',
} as const;

export const HOLD_TTL_MS = 15 * 60 * 1000;

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

/** Distinguishes SMS/MMS/RCS message debits from agent-turn metering. */
export type SabsmsChargeType = 'message' | 'agent_turn';

export interface SabsmsCreditLedgerRow {
  _id?: ObjectId;
  workspaceId: string;
  messageId?: string;
  campaignId?: string;
  reservationToken: string;
  /** Credits moved — negative = debit from the workspace. */
  delta: number;
  kind: SabsmsLedgerKind;
  /** Optional spend bucket; absent rows are treated as 'message'. */
  chargeType?: SabsmsChargeType;
  /**
   * Provider wholesale cost in cents for THIS movement (analytics only —
   * NEVER used to adjust the credit balance). Written on finalise.
   */
  providerCostCents?: number;
  balanceAfter?: number;
  createdAt: Date;
}

export interface CoreHandles {
  reservations: Collection<SabsmsCreditReservation>;
  ledger: Collection<SabsmsCreditLedgerRow>;
  users: Collection<{ _id: ObjectId; credits?: { sms?: number } }>;
}

const indexesEnsuredFor = new WeakSet<Db>();

/** Bind collection handles to a `Db` (idempotent index creation). */
export function coreHandles(db: Db): CoreHandles {
  const reservations = db.collection<SabsmsCreditReservation>(
    SABSMS_CREDIT_COLLECTIONS.reservations,
  );
  const ledger = db.collection<SabsmsCreditLedgerRow>(SABSMS_CREDIT_COLLECTIONS.ledger);
  const users = db.collection<{ _id: ObjectId; credits?: { sms?: number } }>('users');

  if (!indexesEnsuredFor.has(db)) {
    indexesEnsuredFor.add(db);
    // Fire-and-forget — createIndex is idempotent.
    void Promise.all([
      reservations.createIndex({ token: 1 }, { unique: true }),
      reservations.createIndex({ workspaceId: 1, status: 1, expiresAt: 1 }),
      // Replay guard for instant (agent-turn) debits keyed by messageId.
      reservations.createIndex({ workspaceId: 1, messageId: 1 }),
      ledger.createIndex({ workspaceId: 1, createdAt: -1 }),
      ledger.createIndex({ reservationToken: 1 }),
    ]).catch(() => {
      indexesEnsuredFor.delete(db); // retry on the next call
    });
  }

  return { reservations, ledger, users };
}

function toInt(n: number): number {
  return Math.floor(Number(n) || 0);
}

/** Current SMS credit balance — `users.credits.sms`, undefined → 0. */
export async function getSmsCreditBalance(h: CoreHandles, workspaceId: string): Promise<number> {
  if (!ObjectId.isValid(workspaceId)) return 0;
  const user = await h.users.findOne(
    { _id: new ObjectId(workspaceId) },
    { projection: { 'credits.sms': 1 } },
  );
  return typeof user?.credits?.sms === 'number' ? user.credits.sms : 0;
}

async function appendLedger(
  h: CoreHandles,
  row: Omit<SabsmsCreditLedgerRow, '_id' | 'createdAt' | 'balanceAfter'>,
): Promise<void> {
  let balanceAfter: number | undefined;
  try {
    balanceAfter = await getSmsCreditBalance(h, row.workspaceId);
  } catch {
    balanceAfter = undefined;
  }
  await h.ledger.insertOne({ ...row, balanceAfter, createdAt: new Date() });
}

export interface ReserveResult {
  approved: boolean;
  reservationToken?: string;
  reason?: 'insufficient_credits' | 'unknown_workspace' | 'invalid_amount';
}

export interface ReserveMovementParams {
  workspaceId: string;
  messageId?: string;
  campaignId?: string;
  count?: number;
  segmentsTotal?: number;
  amount: number;
}

/**
 * Atomically hold `amount` credits. The conditional `$gte` filter +
 * `$inc` make the hold race-safe: two concurrent reservations can never
 * push the balance below zero. Inserts a `held` reservation doc with a
 * +15 min TTL and leaves the audit row to finalise/release.
 */
export async function reserveMovement(
  h: CoreHandles,
  params: ReserveMovementParams,
): Promise<ReserveResult> {
  const amount = toInt(params.amount);
  if (amount <= 0) {
    return { approved: false, reason: 'invalid_amount' };
  }
  if (!ObjectId.isValid(params.workspaceId)) {
    return { approved: false, reason: 'unknown_workspace' };
  }

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

export interface FinaliseMovementParams {
  workspaceId: string;
  reservationToken: string;
  charge: boolean;
  /**
   * The TRUE credit charge for the send (already priced from the real
   * billed segments + channel by the caller). When omitted, the held
   * amount stands. The hold is trued-up to this exact credit figure.
   */
  chargeCredits?: number;
  /**
   * Provider wholesale cost in cents — recorded on the debit ledger row's
   * metadata for analytics. NEVER moves the credit balance.
   */
  providerCostCents?: number;
}

/**
 * Settle a hold after the send outcome is known.
 *
 *   - charge=false → refund the held amount, mark released ('release').
 *   - charge=true  → keep the debit, mark finalised ('debit'); when the
 *     recomputed credit charge differs from the hold, the difference is
 *     adjusted on the balance and logged as 'adjust'. `providerCostCents`
 *     is written to the debit row's metadata only.
 *
 * Idempotent: a reservation already finalised/released returns ok without
 * moving credits again (the `status: 'held'` guard on the transition
 * makes the no-double-spend race-safe too).
 */
export async function finaliseMovement(
  h: CoreHandles,
  params: FinaliseMovementParams,
): Promise<FinaliseResult> {
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

  // The debit ledger row carries the provider wholesale cost (cents) for
  // analytics — it is NEVER used to move the credit balance.
  await appendLedger(h, {
    ...base,
    delta: -reservation.amount,
    kind: 'debit',
    ...(typeof params.providerCostCents === 'number' && Number.isFinite(params.providerCostCents)
      ? { providerCostCents: Math.max(0, Math.round(params.providerCostCents)) }
      : {}),
  });

  // True-up: the recomputed CREDIT charge differs from the held amount.
  // `chargeCredits` is already denominated in credits (priced from the
  // real billed segments + channel by the caller) — apples to apples with
  // the hold, never provider cents.
  const chargeCredits = params.chargeCredits;
  if (
    typeof chargeCredits === 'number' &&
    Number.isInteger(chargeCredits) &&
    chargeCredits > 0 &&
    chargeCredits !== reservation.amount &&
    ObjectId.isValid(reservation.workspaceId)
  ) {
    const diff = reservation.amount - chargeCredits; // + refund, - extra charge
    await h.users.updateOne(
      { _id: new ObjectId(reservation.workspaceId) },
      { $inc: { 'credits.sms': diff } },
    );
    await appendLedger(h, { ...base, delta: diff, kind: 'adjust' });
  }

  return { ok: true };
}

export interface InstantDebitParams {
  workspaceId: string;
  /** Synthetic id used for the reservation + ledger rows AND replay guard. */
  messageId: string;
  amount: number;
  /** Spend bucket on the ledger row (default 'message'). */
  chargeType?: SabsmsChargeType;
}

export interface InstantDebitResult {
  approved: boolean;
  reason?: 'insufficient_credits' | 'unknown_workspace' | 'invalid_amount';
}

/**
 * Reserve-and-finalise in one write: an instant debit with no async send
 * outcome to wait for (e.g. an AI agent turn). Replay-safe on
 * `messageId` — the same id never double-charges. Uses the SAME atomic
 * `$inc` recipe and the SAME collections as `reserveMovement`, so agent
 * spend and message spend stay coherent in the ledger.
 */
export async function instantDebit(
  h: CoreHandles,
  params: InstantDebitParams,
): Promise<InstantDebitResult> {
  const amount = toInt(params.amount);
  if (amount <= 0) {
    return { approved: false, reason: 'invalid_amount' };
  }
  if (!ObjectId.isValid(params.workspaceId)) {
    return { approved: false, reason: 'unknown_workspace' };
  }

  // Replay tolerance: the same messageId never double-charges.
  const existing = await h.reservations.findOne({
    messageId: params.messageId,
    workspaceId: params.workspaceId,
  });
  if (existing) return { approved: true };

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
    messageId: params.messageId,
    amount,
    status: 'finalised',
    createdAt: now,
    expiresAt: now,
    finalisedAt: now,
  });
  await appendLedger(h, {
    workspaceId: params.workspaceId,
    messageId: params.messageId,
    reservationToken: token,
    delta: -amount,
    kind: 'debit',
    ...(params.chargeType ? { chargeType: params.chargeType } : {}),
  });
  return { approved: true };
}

/**
 * Sweep: refund holds whose `expiresAt` passed without a finalise.
 * Returns the number of holds released. Pure core — the caller supplies
 * handles (server route, periodic worker, etc.).
 */
export async function releaseExpiredMovements(h: CoreHandles, limit = 200): Promise<number> {
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

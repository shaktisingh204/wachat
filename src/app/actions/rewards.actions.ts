'use server';

/**
 * Unified Rewards module server actions.
 *
 * Ties the legacy `crm_loyalty_programs` tier engine and the legacy
 * `affiliates` collection into one Zoho-Thrive-equivalent surface:
 *
 *   • rewards_programs       — program entity (tierEngineRef -> loyalty)
 *   • rewards_members        — per-customer membership
 *   • rewards_catalog        — redeemable items (SabFiles image refs)
 *   • rewards_redemptions    — append-only spend ledger
 *   • rewards_referrals      — referral codes + conversion attribution
 *
 * Read/write goes through the Rust BFF when `USE_RUST_CRM === 'true'`
 * and falls back to direct Mongo otherwise (mirrors the loyalty pattern).
 * All collections are scoped by `userId`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  rewardsProgramsApi,
  type RewardsProgramDoc,
  type RewardsProgramCreateInput,
  type RewardsProgramUpdateInput,
} from '@/lib/rust-client/rewards-programs';
import {
  rewardsMembersApi,
  type RewardsMemberDoc,
  type RewardsMemberCreateInput,
  type RewardsMemberAdjustInput,
} from '@/lib/rust-client/rewards-members';
import {
  rewardsCatalogApi,
  type RewardsCatalogItemDoc,
  type RewardsCatalogCreateInput,
  type RewardsCatalogUpdateInput,
} from '@/lib/rust-client/rewards-catalog';
import {
  rewardsRedemptionsApi,
  type RewardsRedemptionDoc,
  type RewardsRedemptionCreateInput,
  type RewardsRedemptionStatusInput,
} from '@/lib/rust-client/rewards-redemptions';
import {
  rewardsReferralsApi,
  type RewardsReferralDoc,
  type RewardsReferralCreateInput,
  type RewardsReferralConversionInput,
} from '@/lib/rust-client/rewards-referrals';

const REWARDS_BASE_PATH = '/dashboard/sabrewards';

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

async function requireUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.user) return null;
  return String((session.user as { _id?: string })._id ?? '');
}

type ActionResult<T = void> =
  | ({ success: true } & (T extends void ? { data?: never } : { data: T }))
  | { success: false; error: string };

function ok<T>(data: T): ActionResult<T> {
  return { success: true, data } as ActionResult<T>;
}

function okVoid(): ActionResult {
  return { success: true } as ActionResult;
}

function fail(err: unknown): ActionResult {
  return { success: false, error: getErrorMessage(err) };
}

function serialise<T>(doc: T): T {
  return JSON.parse(JSON.stringify(doc));
}

// ───────────────────────────── Programs ─────────────────────────────

export async function listRewardsPrograms(): Promise<RewardsProgramDoc[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  if (useRustCrm()) {
    try {
      const res = await rewardsProgramsApi.list({ limit: 100 });
      return serialise(res.items);
    } catch (e) {
      recordRustFallback({
        entity: 'rewards_program',
        op: 'list',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  try {
    const { db } = await connectToDatabase();
    const rows = await db
      .collection('rewards_programs')
      .find({ userId: new ObjectId(userId), status: { $ne: 'archived' } })
      .sort({ createdAt: -1 })
      .toArray();
    return rows.map((r) => ({ ...r, _id: r._id.toString() })) as RewardsProgramDoc[];
  } catch (e) {
    console.error('[listRewardsPrograms]', e);
    return [];
  }
}

export async function getRewardsProgram(id: string): Promise<RewardsProgramDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const userId = await requireUserId();
  if (!userId) return null;

  if (useRustCrm()) {
    try {
      return serialise(await rewardsProgramsApi.getById(id));
    } catch (e) {
      recordRustFallback({
        entity: 'rewards_program',
        op: 'get',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
    }
  }

  const { db } = await connectToDatabase();
  const row = await db
    .collection('rewards_programs')
    .findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
  return row ? ({ ...row, _id: row._id.toString() } as RewardsProgramDoc) : null;
}

export async function createRewardsProgram(
  input: RewardsProgramCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));

  try {
    if (useRustCrm()) {
      const res = await rewardsProgramsApi.create(input);
      revalidatePath(REWARDS_BASE_PATH);
      return ok({ id: res.id });
    }
    const { db } = await connectToDatabase();
    const now = new Date();
    const result = await db.collection('rewards_programs').insertOne({
      ...input,
      userId: new ObjectId(userId),
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(REWARDS_BASE_PATH);
    return ok({ id: result.insertedId.toString() });
  } catch (e) {
    return fail(e);
  }
}

export async function updateRewardsProgram(
  id: string,
  patch: RewardsProgramUpdateInput,
): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));

  try {
    if (useRustCrm()) {
      await rewardsProgramsApi.update(id, patch);
    } else {
      const { db } = await connectToDatabase();
      await db
        .collection('rewards_programs')
        .updateOne(
          { _id: new ObjectId(id), userId: new ObjectId(userId) },
          { $set: { ...patch, updatedAt: new Date() } },
        );
    }
    revalidatePath(REWARDS_BASE_PATH);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRewardsProgram(id: string): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));

  try {
    if (useRustCrm()) {
      await rewardsProgramsApi.delete(id);
    } else {
      const { db } = await connectToDatabase();
      await db
        .collection('rewards_programs')
        .updateOne(
          { _id: new ObjectId(id), userId: new ObjectId(userId) },
          { $set: { status: 'archived', updatedAt: new Date() } },
        );
    }
    revalidatePath(REWARDS_BASE_PATH);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

// ───────────────────────────── Members ─────────────────────────────

export async function listRewardsMembers(programId?: string): Promise<RewardsMemberDoc[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  if (useRustCrm()) {
    try {
      const res = await rewardsMembersApi.list({
        programId,
        limit: 200,
      });
      return serialise(res.items);
    } catch (e) {
      recordRustFallback({
        entity: 'rewards_member',
        op: 'list',
        errorCode: e instanceof RustApiError ? e.code : undefined,
      });
    }
  }

  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId: new ObjectId(userId) };
  if (programId && ObjectId.isValid(programId)) {
    filter.programId = new ObjectId(programId);
  }
  const rows = await db
    .collection('rewards_members')
    .find(filter)
    .sort({ lifetimePoints: -1, joinedAt: -1 })
    .limit(200)
    .toArray();
  return rows.map((r) => ({
    ...r,
    _id: r._id.toString(),
    programId: r.programId?.toString(),
    customerId: r.customerId?.toString(),
  })) as RewardsMemberDoc[];
}

export async function getRewardsMember(id: string): Promise<RewardsMemberDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const userId = await requireUserId();
  if (!userId) return null;

  if (useRustCrm()) {
    try {
      return serialise(await rewardsMembersApi.getById(id));
    } catch {
      // fall through
    }
  }

  const { db } = await connectToDatabase();
  const row = await db
    .collection('rewards_members')
    .findOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
  return row
    ? ({
        ...row,
        _id: row._id.toString(),
        programId: row.programId?.toString(),
        customerId: row.customerId?.toString(),
      } as RewardsMemberDoc)
    : null;
}

export async function createRewardsMember(
  input: RewardsMemberCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      const res = await rewardsMembersApi.create(input);
      revalidatePath(REWARDS_BASE_PATH);
      return ok({ id: res.id });
    }
    const { db } = await connectToDatabase();
    const bonus = input.welcomeBonus ?? 0;
    const result = await db.collection('rewards_members').insertOne({
      userId: new ObjectId(userId),
      programId: new ObjectId(input.programId),
      customerId: new ObjectId(input.customerId),
      currentPoints: bonus,
      lifetimePoints: bonus,
      currentTier: input.initialTier,
      joinedAt: new Date(),
      updatedAt: new Date(),
    });
    revalidatePath(REWARDS_BASE_PATH);
    return ok({ id: result.insertedId.toString() });
  } catch (e) {
    return fail(e);
  }
}

export async function adjustRewardsMember(
  id: string,
  input: RewardsMemberAdjustInput,
): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));

  try {
    if (useRustCrm()) {
      await rewardsMembersApi.adjust(id, input);
    } else {
      const { db } = await connectToDatabase();
      const inc: Record<string, number> = { currentPoints: input.delta };
      if (input.delta > 0) inc.lifetimePoints = input.delta;
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (input.newTier) set.currentTier = input.newTier;
      await db
        .collection('rewards_members')
        .updateOne(
          { _id: new ObjectId(id), userId: new ObjectId(userId) },
          { $inc: inc, $set: set },
        );
    }
    revalidatePath(REWARDS_BASE_PATH);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

// ───────────────────────────── Catalog ─────────────────────────────

export async function listRewardsCatalog(
  opts: { programId?: string; activeOnly?: boolean } = {},
): Promise<RewardsCatalogItemDoc[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  if (useRustCrm()) {
    try {
      const res = await rewardsCatalogApi.list({
        programId: opts.programId,
        activeOnly: opts.activeOnly,
        limit: 200,
      });
      return serialise(res.items);
    } catch (e) {
      recordRustFallback({
        entity: 'rewards_catalog_item',
        op: 'list',
        errorCode: e instanceof RustApiError ? e.code : undefined,
      });
    }
  }

  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId: new ObjectId(userId) };
  if (opts.programId && ObjectId.isValid(opts.programId)) {
    filter.programId = new ObjectId(opts.programId);
  }
  if (opts.activeOnly) filter.active = true;
  const rows = await db
    .collection('rewards_catalog')
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return rows.map((r) => ({
    ...r,
    _id: r._id.toString(),
    programId: r.programId?.toString(),
  })) as RewardsCatalogItemDoc[];
}

export async function createRewardsCatalogItem(
  input: RewardsCatalogCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));

  try {
    if (useRustCrm()) {
      const res = await rewardsCatalogApi.create(input);
      revalidatePath(`${REWARDS_BASE_PATH}/catalog`);
      return ok({ id: res.id });
    }
    const { db } = await connectToDatabase();
    const now = new Date();
    const result = await db.collection('rewards_catalog').insertOne({
      ...input,
      programId:
        input.programId && ObjectId.isValid(input.programId)
          ? new ObjectId(input.programId)
          : undefined,
      active: input.active ?? true,
      userId: new ObjectId(userId),
      createdAt: now,
      updatedAt: now,
    });
    revalidatePath(`${REWARDS_BASE_PATH}/catalog`);
    return ok({ id: result.insertedId.toString() });
  } catch (e) {
    return fail(e);
  }
}

export async function updateRewardsCatalogItem(
  id: string,
  patch: RewardsCatalogUpdateInput,
): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      await rewardsCatalogApi.update(id, patch);
    } else {
      const { db } = await connectToDatabase();
      await db
        .collection('rewards_catalog')
        .updateOne(
          { _id: new ObjectId(id), userId: new ObjectId(userId) },
          { $set: { ...patch, updatedAt: new Date() } },
        );
    }
    revalidatePath(`${REWARDS_BASE_PATH}/catalog`);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRewardsCatalogItem(id: string): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      await rewardsCatalogApi.delete(id);
    } else {
      const { db } = await connectToDatabase();
      await db
        .collection('rewards_catalog')
        .deleteOne({ _id: new ObjectId(id), userId: new ObjectId(userId) });
    }
    revalidatePath(`${REWARDS_BASE_PATH}/catalog`);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

// ──────────────────────────── Redemptions ───────────────────────────

export async function listRewardsRedemptions(memberId?: string): Promise<RewardsRedemptionDoc[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  if (useRustCrm()) {
    try {
      const res = await rewardsRedemptionsApi.list({ memberId, limit: 100 });
      return serialise(res.items);
    } catch {
      // fall through
    }
  }
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId: new ObjectId(userId) };
  if (memberId && ObjectId.isValid(memberId)) filter.memberId = new ObjectId(memberId);
  const rows = await db
    .collection('rewards_redemptions')
    .find(filter)
    .sort({ redeemedAt: -1 })
    .limit(100)
    .toArray();
  return rows.map((r) => ({
    ...r,
    _id: r._id.toString(),
    memberId: r.memberId?.toString(),
    catalogItemId: r.catalogItemId?.toString(),
  })) as RewardsRedemptionDoc[];
}

export async function createRewardsRedemption(
  input: RewardsRedemptionCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      const res = await rewardsRedemptionsApi.create(input);
      await rewardsMembersApi.adjust(input.memberId, { delta: -input.points });
      revalidatePath(REWARDS_BASE_PATH);
      return ok({ id: res.id });
    }
    const { db } = await connectToDatabase();
    const now = new Date();
    const result = await db.collection('rewards_redemptions').insertOne({
      userId: new ObjectId(userId),
      memberId: new ObjectId(input.memberId),
      catalogItemId: new ObjectId(input.catalogItemId),
      points: input.points,
      status: 'pending',
      redeemedAt: now,
      notes: input.notes,
      updatedAt: now,
    });
    await db.collection('rewards_members').updateOne(
      { _id: new ObjectId(input.memberId), userId: new ObjectId(userId) },
      { $inc: { currentPoints: -input.points }, $set: { updatedAt: now } },
    );
    revalidatePath(REWARDS_BASE_PATH);
    return ok({ id: result.insertedId.toString() });
  } catch (e) {
    return fail(e);
  }
}

export async function setRewardsRedemptionStatus(
  id: string,
  input: RewardsRedemptionStatusInput,
): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      await rewardsRedemptionsApi.updateStatus(id, input);
    } else {
      const { db } = await connectToDatabase();
      const now = new Date();
      const set: Record<string, unknown> = {
        status: input.status,
        updatedAt: now,
        ...(input.status === 'fulfilled' ? { fulfilledAt: now } : { cancelledAt: now }),
      };
      if (input.notes) set.notes = input.notes;
      await db
        .collection('rewards_redemptions')
        .updateOne({ _id: new ObjectId(id), userId: new ObjectId(userId) }, { $set: set });
    }
    revalidatePath(REWARDS_BASE_PATH);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

// ──────────────────────────── Referrals ─────────────────────────────

export async function listRewardsReferrals(
  opts: { memberId?: string; programId?: string; activeOnly?: boolean } = {},
): Promise<RewardsReferralDoc[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  if (useRustCrm()) {
    try {
      const res = await rewardsReferralsApi.list({ ...opts, limit: 200 });
      return serialise(res.items);
    } catch {
      // fall through
    }
  }
  const { db } = await connectToDatabase();
  const filter: Record<string, unknown> = { userId: new ObjectId(userId) };
  if (opts.memberId && ObjectId.isValid(opts.memberId)) filter.memberId = new ObjectId(opts.memberId);
  if (opts.programId && ObjectId.isValid(opts.programId)) filter.programId = new ObjectId(opts.programId);
  if (opts.activeOnly) filter.active = true;
  const rows = await db
    .collection('rewards_referrals')
    .find(filter)
    .sort({ rewardPoints: -1, sharedAt: -1 })
    .limit(200)
    .toArray();
  return rows.map((r) => ({
    ...r,
    _id: r._id.toString(),
    memberId: r.memberId?.toString(),
    programId: r.programId?.toString(),
  })) as RewardsReferralDoc[];
}

export async function createRewardsReferral(
  input: RewardsReferralCreateInput,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      const res = await rewardsReferralsApi.create(input);
      revalidatePath(`${REWARDS_BASE_PATH}/referrals`);
      return ok({ id: res.id });
    }
    const { db } = await connectToDatabase();
    const result = await db.collection('rewards_referrals').insertOne({
      userId: new ObjectId(userId),
      memberId: new ObjectId(input.memberId),
      programId:
        input.programId && ObjectId.isValid(input.programId)
          ? new ObjectId(input.programId)
          : undefined,
      code: input.code,
      sharedAt: new Date(),
      conversions: [],
      rewardPoints: 0,
      active: true,
      updatedAt: new Date(),
    });
    revalidatePath(`${REWARDS_BASE_PATH}/referrals`);
    return ok({ id: result.insertedId.toString() });
  } catch (e) {
    return fail(e);
  }
}

export async function logRewardsReferralConversion(
  id: string,
  input: RewardsReferralConversionInput,
): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      await rewardsReferralsApi.logConversion(id, input);
    } else {
      const { db } = await connectToDatabase();
      const awarded = input.awardedPoints ?? 0;
      await db.collection('rewards_referrals').updateOne(
        { _id: new ObjectId(id), userId: new ObjectId(userId) },
        {
          $push: {
            conversions: {
              inviteeId: new ObjectId(input.inviteeId),
              convertedAt: new Date(),
              kind: input.kind,
              awardedPoints: awarded,
            },
          },
          $inc: { rewardPoints: awarded },
          $set: { updatedAt: new Date() },
        } as any,
      );
    }
    revalidatePath(`${REWARDS_BASE_PATH}/referrals`);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

export async function deleteRewardsReferral(id: string): Promise<ActionResult> {
  if (!ObjectId.isValid(id)) return fail(new Error('Invalid id'));
  const userId = await requireUserId();
  if (!userId) return fail(new Error('Unauthorized'));
  try {
    if (useRustCrm()) {
      await rewardsReferralsApi.delete(id);
    } else {
      const { db } = await connectToDatabase();
      await db
        .collection('rewards_referrals')
        .updateOne(
          { _id: new ObjectId(id), userId: new ObjectId(userId) },
          { $set: { active: false, updatedAt: new Date() } },
        );
    }
    revalidatePath(`${REWARDS_BASE_PATH}/referrals`);
    return okVoid();
  } catch (e) {
    return fail(e);
  }
}

// ────────────────────────────── Dashboard ────────────────────────────

export interface RewardsDashboardKpis {
  totalMembers: number;
  pointsOutstanding: number;
  redemptionsTotal: number;
  redemptionsPending: number;
  referralsIssued: number;
  referralConversions: number;
}

export interface RewardsTopEarner {
  memberId: string;
  customerId: string;
  lifetimePoints: number;
  currentPoints: number;
  currentTier?: string;
}

export async function getRewardsDashboard(): Promise<{
  kpis: RewardsDashboardKpis;
  topEarners: RewardsTopEarner[];
}> {
  const empty = {
    kpis: {
      totalMembers: 0,
      pointsOutstanding: 0,
      redemptionsTotal: 0,
      redemptionsPending: 0,
      referralsIssued: 0,
      referralConversions: 0,
    },
    topEarners: [] as RewardsTopEarner[],
  };

  const userId = await requireUserId();
  if (!userId) return empty;

  try {
    const { db } = await connectToDatabase();
    const uoid = new ObjectId(userId);

    const [
      totalMembers,
      pointsAgg,
      redemptionsTotal,
      redemptionsPending,
      referralsIssued,
      referralsAgg,
      topEarners,
    ] = await Promise.all([
      db.collection('rewards_members').countDocuments({ userId: uoid }),
      db
        .collection('rewards_members')
        .aggregate([
          { $match: { userId: uoid } },
          { $group: { _id: null, total: { $sum: '$currentPoints' } } },
        ])
        .toArray(),
      db.collection('rewards_redemptions').countDocuments({ userId: uoid }),
      db
        .collection('rewards_redemptions')
        .countDocuments({ userId: uoid, status: 'pending' }),
      db.collection('rewards_referrals').countDocuments({ userId: uoid }),
      db
        .collection('rewards_referrals')
        .aggregate([
          { $match: { userId: uoid } },
          {
            $group: {
              _id: null,
              conversions: { $sum: { $size: { $ifNull: ['$conversions', []] } } },
            },
          },
        ])
        .toArray(),
      db
        .collection('rewards_members')
        .find({ userId: uoid })
        .sort({ lifetimePoints: -1 })
        .limit(5)
        .toArray(),
    ]);

    return {
      kpis: {
        totalMembers,
        pointsOutstanding: pointsAgg[0]?.total ?? 0,
        redemptionsTotal,
        redemptionsPending,
        referralsIssued,
        referralConversions: referralsAgg[0]?.conversions ?? 0,
      },
      topEarners: topEarners.map((m) => ({
        memberId: m._id.toString(),
        customerId: m.customerId?.toString() ?? '',
        lifetimePoints: m.lifetimePoints ?? 0,
        currentPoints: m.currentPoints ?? 0,
        currentTier: m.currentTier,
      })),
    };
  } catch (e) {
    console.error('[getRewardsDashboard]', e);
    return empty;
  }
}

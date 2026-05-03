/**
 * Public roadmap — items + tenant-weighted voting.
 *
 * Voting rules:
 *   - One vote per (itemId, tenantId).
 *   - Vote weight is derived from the tenant's plan (free→1, pro→2, scale→3,
 *     enterprise→5). This balances raw vote counts with revenue-weighted signal.
 *   - Re-voting from the same tenant is idempotent and does NOT double-count.
 */

import 'server-only';

import { randomBytes } from 'node:crypto';

import type { RoadmapItem, RoadmapStatus, RoadmapVote } from './types';

export type RoadmapPlanTier = 'free' | 'pro' | 'scale' | 'enterprise';

const PLAN_VOTE_WEIGHT: Record<RoadmapPlanTier, number> = {
  free: 1,
  pro: 2,
  scale: 3,
  enterprise: 5,
};

export function voteWeightForPlan(plan: RoadmapPlanTier): number {
  return PLAN_VOTE_WEIGHT[plan] ?? 1;
}

export interface CreateRoadmapItemInput {
  title: string;
  description: string;
  category: string;
  submittedByTenantId?: string;
  status?: RoadmapStatus;
}

export function createRoadmapItem(input: CreateRoadmapItemInput): RoadmapItem {
  const now = new Date();
  return {
    itemId: randomBytes(8).toString('hex'),
    title: input.title,
    description: input.description,
    category: input.category,
    status: input.status ?? 'submitted',
    votes: 0,
    voterCount: 0,
    submittedByTenantId: input.submittedByTenantId,
    createdAt: now,
    updatedAt: now,
  };
}

export interface CastVoteInput {
  item: RoadmapItem;
  tenantId: string;
  userId: string;
  plan: RoadmapPlanTier;
  /** Existing votes for this item — used to enforce one-per-tenant. */
  existingVotes: RoadmapVote[];
}

export interface CastVoteResult {
  item: RoadmapItem;
  vote: RoadmapVote | null;
  /** True if a new vote was cast; false if the tenant already voted. */
  applied: boolean;
}

/**
 * Cast a vote, enforcing one-vote-per-tenant. If the tenant has already voted,
 * the call is a no-op and `applied: false` is returned.
 */
export function castVote(input: CastVoteInput): CastVoteResult {
  const { item, tenantId, userId, plan, existingVotes } = input;
  const already = existingVotes.find((v) => v.itemId === item.itemId && v.tenantId === tenantId);
  if (already) {
    return { item, vote: already, applied: false };
  }
  const weight = voteWeightForPlan(plan);
  const vote: RoadmapVote = {
    itemId: item.itemId,
    tenantId,
    userId,
    weight,
    votedAt: new Date(),
  };
  const updatedItem: RoadmapItem = {
    ...item,
    votes: item.votes + weight,
    voterCount: item.voterCount + 1,
    updatedAt: vote.votedAt,
  };
  return { item: updatedItem, vote, applied: true };
}

export function setRoadmapStatus(
  item: RoadmapItem,
  status: RoadmapStatus,
  at: Date = new Date(),
): RoadmapItem {
  return {
    ...item,
    status,
    updatedAt: at,
    shippedAt: status === 'shipped' ? at : item.shippedAt,
  };
}

/** Sort helper for "Top voted" listings. */
export function sortByVotes(items: RoadmapItem[]): RoadmapItem[] {
  return [...items].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    if (b.voterCount !== a.voterCount) return b.voterCount - a.voterCount;
    return a.title.localeCompare(b.title);
  });
}

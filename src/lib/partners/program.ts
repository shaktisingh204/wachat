/**
 * Partner program tier rules.
 *
 * Tier is computed deterministically from three signals:
 *   - certifiedEmployees: how many employees passed at least one cert exam.
 *   - activeTenants:      currently active downstream tenants the partner manages.
 *   - referredArr:        lifetime referred ARR in the smallest currency unit.
 *
 * The thresholds below can later be moved to a config collection without
 * changing the public API.
 */

import 'server-only';

import type { Partner, PartnerTier } from './types';

interface TierThreshold {
  tier: PartnerTier;
  certifiedEmployees: number;
  activeTenants: number;
  /** ARR in smallest currency unit (e.g. cents). */
  referredArr: number;
}

/** Ordered platinum→bronze, evaluated top-down. */
export const TIER_THRESHOLDS: readonly TierThreshold[] = [
  { tier: 'platinum', certifiedEmployees: 10, activeTenants: 100, referredArr: 50_000_00 },
  { tier: 'gold', certifiedEmployees: 5, activeTenants: 40, referredArr: 20_000_00 },
  { tier: 'silver', certifiedEmployees: 2, activeTenants: 10, referredArr: 5_000_00 },
  { tier: 'bronze', certifiedEmployees: 0, activeTenants: 0, referredArr: 0 },
] as const;

/**
 * Pick the highest tier whose thresholds are all met.
 */
export function tierFor(
  partner: Pick<Partner, 'certifiedEmployees' | 'activeTenants' | 'referredArr'>,
): PartnerTier {
  for (const threshold of TIER_THRESHOLDS) {
    if (
      partner.certifiedEmployees >= threshold.certifiedEmployees &&
      partner.activeTenants >= threshold.activeTenants &&
      partner.referredArr >= threshold.referredArr
    ) {
      return threshold.tier;
    }
  }
  return 'bronze';
}

/**
 * Tier ordering helper — useful when comparing or sorting partners.
 */
export function tierRank(tier: PartnerTier): number {
  switch (tier) {
    case 'platinum':
      return 4;
    case 'gold':
      return 3;
    case 'silver':
      return 2;
    case 'bronze':
      return 1;
    default:
      return 0;
  }
}

/**
 * Benefits exposed per tier — purely informational; consumers may layer in
 * additional plan/feature gating as needed.
 */
export interface TierBenefits {
  /** Default commission rate (0–1 fraction). */
  commissionRate: number;
  /** Co-marketing budget per month, smallest currency unit. */
  coMarketingBudget: number;
  /** Number of dedicated solution-architect hours / month. */
  saHoursPerMonth: number;
  /** Whether the partner is featured on the homepage directory. */
  featured: boolean;
}

const TIER_BENEFITS: Record<PartnerTier, TierBenefits> = {
  bronze: { commissionRate: 0.10, coMarketingBudget: 0, saHoursPerMonth: 0, featured: false },
  silver: { commissionRate: 0.15, coMarketingBudget: 50_000, saHoursPerMonth: 2, featured: false },
  gold: { commissionRate: 0.20, coMarketingBudget: 250_000, saHoursPerMonth: 8, featured: true },
  platinum: { commissionRate: 0.30, coMarketingBudget: 1_000_000, saHoursPerMonth: 24, featured: true },
};

export function benefitsFor(tier: PartnerTier): TierBenefits {
  return TIER_BENEFITS[tier];
}

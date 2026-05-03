/**
 * Commission calculation for partner referrals.
 *
 * Plans configure a `rate` (0–1 fraction of monthly revenue) and an optional
 * one-time `bonus` paid on conversion. Pure function so it's trivially testable.
 */

import 'server-only';

import type { Referral } from './types';

export interface CommissionPlan {
  /** Fraction (0–1) of monthly revenue paid to the partner. */
  rate: number;
  /** One-time conversion bonus, smallest currency unit. */
  bonus?: number;
  /** Optional monthly cap on commission, smallest currency unit. */
  monthlyCap?: number;
}

/**
 * Returns the commission owed for a single referral payout cycle.
 *
 * - Pending / rejected referrals return 0.
 * - Qualified (not yet converted) returns the bonus only.
 * - Converted returns bonus + rate * monthlyRevenue, capped at monthlyCap.
 */
export function calculateCommission(referral: Referral, plan: CommissionPlan): number {
  if (referral.status === 'pending' || referral.status === 'rejected') {
    return 0;
  }

  const bonus = plan.bonus ?? 0;
  if (referral.status === 'qualified') {
    return Math.max(0, bonus);
  }

  // converted
  const revenue = referral.monthlyRevenue ?? 0;
  const recurring = Math.max(0, Math.floor(revenue * plan.rate));
  const capped = plan.monthlyCap !== undefined ? Math.min(recurring, plan.monthlyCap) : recurring;
  return capped + bonus;
}

/**
 * Double-sided reward: amount credited to the referee on conversion.
 * Modeled as a flat fraction of first-month revenue plus optional bonus.
 */
export interface RefereeRewardPlan {
  /** Fraction of first-month revenue credited to the referee. */
  rate: number;
  bonus?: number;
}

export function calculateRefereeReward(referral: Referral, plan: RefereeRewardPlan): number {
  if (referral.status !== 'converted') return 0;
  const revenue = referral.monthlyRevenue ?? 0;
  return Math.max(0, Math.floor(revenue * plan.rate)) + (plan.bonus ?? 0);
}

/**
 * Referral link generator + tracking helpers.
 *
 * Each partner gets a stable, URL-safe code; conversion is captured via the
 * referee's signup form which decodes the code server-side. Rewards are
 * calculated by `commissions.calculateCommission` / `calculateRefereeReward`.
 */

import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { calculateCommission, calculateRefereeReward } from './commissions';
import type { CommissionPlan, RefereeRewardPlan } from './commissions';
import type { Referral, ReferralStatus } from './types';

/**
 * Deterministic, URL-safe referral code derived from the partner tenant id.
 * 10 characters of base32 should give us ~50 bits of identifier — enough for
 * billions of partners with negligible collision risk, while remaining short
 * enough to ship in an email.
 */
export function generateReferralCode(partnerTenantId: string, salt?: string): string {
  const seed = salt ?? randomBytes(8).toString('hex');
  const hash = createHash('sha256')
    .update(`${partnerTenantId}:${seed}`)
    .digest('hex');
  // Map hex → base32-like (alphanumeric, no confusable chars).
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 10; i++) {
    const byte = parseInt(hash.slice(i * 2, i * 2 + 2), 16);
    code += alphabet[byte % alphabet.length];
  }
  return code;
}

export interface ReferralLinkOptions {
  /** Base URL of the public site (no trailing slash). */
  baseUrl: string;
  /** Optional UTM source (defaults to "partner"). */
  utmSource?: string;
  /** Optional landing path (defaults to "/signup"). */
  landingPath?: string;
}

export function buildReferralUrl(code: string, opts: ReferralLinkOptions): string {
  const path = opts.landingPath ?? '/signup';
  const params = new URLSearchParams({
    ref: code,
    utm_source: opts.utmSource ?? 'partner',
    utm_medium: 'referral',
    utm_campaign: code,
  });
  return `${opts.baseUrl}${path}?${params.toString()}`;
}

export interface CreateReferralInput {
  partnerTenantId: string;
  refereeEmail?: string;
  /** Optional pre-shared code; if absent, one is generated. */
  code?: string;
}

export function createReferral(input: CreateReferralInput): Referral {
  return {
    referralId: randomBytes(12).toString('hex'),
    partnerTenantId: input.partnerTenantId,
    code: input.code ?? generateReferralCode(input.partnerTenantId),
    refereeEmail: input.refereeEmail,
    status: 'pending',
    commissionPaid: 0,
    refereeReward: 0,
    createdAt: new Date(),
  };
}

export interface ConvertReferralInput {
  refereeTenantId: string;
  planId: string;
  monthlyRevenue: number;
  currency: string;
  commissionPlan: CommissionPlan;
  refereeRewardPlan: RefereeRewardPlan;
}

/**
 * Mark a referral as converted and compute the dual-sided rewards.
 * Pure: returns a new referral object; persistence is the caller's job.
 */
export function convertReferral(referral: Referral, input: ConvertReferralInput): Referral {
  const next: Referral = {
    ...referral,
    status: 'converted' as ReferralStatus,
    refereeTenantId: input.refereeTenantId,
    planId: input.planId,
    monthlyRevenue: input.monthlyRevenue,
    currency: input.currency,
    convertedAt: new Date(),
  };
  next.commissionPaid = calculateCommission(next, input.commissionPlan);
  next.refereeReward = calculateRefereeReward(next, input.refereeRewardPlan);
  return next;
}

export function rejectReferral(referral: Referral): Referral {
  return { ...referral, status: 'rejected' };
}

export function qualifyReferral(referral: Referral): Referral {
  return { ...referral, status: 'qualified' };
}

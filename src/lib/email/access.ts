/**
 * Email Suite — plan-gate helpers.
 *
 * Mirrors Mailchimp's Free / Essentials / Standard / Premium tiers.
 * Combine with the SabNode RBAC layer (`src/lib/rbac.ts`) — RBAC checks
 * who-can-do-what, this file checks plan-tier-can-do-what.
 *
 * Usage:
 *   const cap = getEmailPlanCaps(plan);
 *   if (cap.monthlySends < requested) throw new PlanLimitError('monthly_sends');
 */

export type EmailPlanTier = 'free' | 'essentials' | 'standard' | 'premium';

export interface EmailPlanCaps {
  tier: EmailPlanTier;
  contacts: number;            // -1 = unlimited
  monthlySends: number;
  activeJourneys: number;
  abTesting: 'none' | 'subject_only' | 'full';
  sendTimeOptimization: boolean;
  multivariate: boolean;
  advancedSegmentation: boolean;
  predictiveSegments: boolean;
  brandKit: boolean;
  customDomain: boolean;
  dedicatedIp: boolean;
  removeFooterBranding: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
}

const PLAN_TABLE: Record<EmailPlanTier, EmailPlanCaps> = {
  free: {
    tier: 'free',
    contacts: 500,
    monthlySends: 1_000,
    activeJourneys: 1,
    abTesting: 'none',
    sendTimeOptimization: false,
    multivariate: false,
    advancedSegmentation: false,
    predictiveSegments: false,
    brandKit: false,
    customDomain: false,
    dedicatedIp: false,
    removeFooterBranding: false,
    apiAccess: false,
    prioritySupport: false,
  },
  essentials: {
    tier: 'essentials',
    contacts: 5_000,
    monthlySends: 50_000,
    activeJourneys: 5,
    abTesting: 'subject_only',
    sendTimeOptimization: false,
    multivariate: false,
    advancedSegmentation: false,
    predictiveSegments: false,
    brandKit: true,
    customDomain: true,
    dedicatedIp: false,
    removeFooterBranding: true,
    apiAccess: true,
    prioritySupport: false,
  },
  standard: {
    tier: 'standard',
    contacts: 100_000,
    monthlySends: 1_200_000,
    activeJourneys: -1,
    abTesting: 'full',
    sendTimeOptimization: true,
    multivariate: false,
    advancedSegmentation: true,
    predictiveSegments: true,
    brandKit: true,
    customDomain: true,
    dedicatedIp: false,
    removeFooterBranding: true,
    apiAccess: true,
    prioritySupport: false,
  },
  premium: {
    tier: 'premium',
    contacts: -1,
    monthlySends: 15_000_000,
    activeJourneys: -1,
    abTesting: 'full',
    sendTimeOptimization: true,
    multivariate: true,
    advancedSegmentation: true,
    predictiveSegments: true,
    brandKit: true,
    customDomain: true,
    dedicatedIp: true,
    removeFooterBranding: true,
    apiAccess: true,
    prioritySupport: true,
  },
};

export function getEmailPlanCaps(tier: EmailPlanTier | undefined | null): EmailPlanCaps {
  return PLAN_TABLE[tier ?? 'free'];
}

export function isWithin(cap: number, used: number): boolean {
  return cap === -1 || used < cap;
}

export class EmailPlanLimitError extends Error {
  constructor(public readonly limit: keyof EmailPlanCaps, message?: string) {
    super(message ?? `Email plan limit reached: ${String(limit)}`);
    this.name = 'EmailPlanLimitError';
  }
}

export function assertPlanAllows<K extends keyof EmailPlanCaps>(
  caps: EmailPlanCaps,
  feature: K,
  required?: EmailPlanCaps[K],
): void {
  const have = caps[feature];
  if (typeof have === 'boolean') {
    if (!have) throw new EmailPlanLimitError(feature);
    return;
  }
  if (typeof have === 'number' && typeof required === 'number') {
    if (have !== -1 && have < required) throw new EmailPlanLimitError(feature);
    return;
  }
  if (typeof have === 'string' && typeof required === 'string') {
    if (have !== required && !(feature === 'abTesting' && have === 'full')) {
      throw new EmailPlanLimitError(feature);
    }
  }
}

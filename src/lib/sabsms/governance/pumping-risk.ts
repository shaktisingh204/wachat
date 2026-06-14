/**
 * SabSMS v3.4 — cross-tenant SMS-pumping (AIT) risk score.
 *
 * SMS pumping is the dominant CPaaS fraud vector, and the leaders gate
 * "guaranteed" protection behind a data moat: they can see a number being
 * hammered across many customers' OTP flows. SabNode is multi-tenant, so
 * we have the SAME signal natively — a destination that's burning OTPs
 * across several workspaces with ~0 conversions is almost certainly a pump.
 *
 * `scorePumpingRisk` is pure; the cross-tenant signal loader aggregates
 * across ALL workspaces (no tenant filter) and is dynamic-imported.
 */

export interface PumpingSignals {
  /** Sends to this destination across ALL tenants in the window. */
  crossTenantSends: number;
  /** Distinct tenants that sent to this destination in the window. */
  distinctTenants: number;
  /** Verifications completed for this destination across tenants. */
  crossTenantConversions: number;
}

export type PumpingLevel = 'low' | 'medium' | 'high';

export interface PumpingVerdict {
  score: number; // 0–100
  level: PumpingLevel;
  reasons: string[];
}

/**
 * Heuristic risk score. Three independent signals stack:
 *  - raw volume to one destination,
 *  - how many distinct tenants it's hitting (the cross-tenant tell),
 *  - conversion starvation (lots of sends, almost no completions).
 */
export function scorePumpingRisk(s: PumpingSignals): PumpingVerdict {
  const reasons: string[] = [];
  let score = 0;

  if (s.crossTenantSends >= 50) {
    score += 50;
    reasons.push('very_high_volume');
  } else if (s.crossTenantSends >= 20) {
    score += 30;
    reasons.push('high_volume');
  }

  if (s.distinctTenants >= 3) {
    score += 25;
    reasons.push('multi_tenant_target');
  }

  if (s.crossTenantSends >= 10) {
    const rate = s.crossTenantConversions / s.crossTenantSends;
    if (rate < 0.05) {
      score += 40;
      reasons.push('zero_conversion');
    } else if (rate < 0.15) {
      score += 15;
      reasons.push('low_conversion');
    }
  }

  score = Math.min(100, score);
  const level: PumpingLevel = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { score, level, reasons };
}

/**
 * Aggregate cross-tenant pumping signals for a destination over `windowMs`.
 * Counts OTP-category sends across every workspace (the cross-tenant view
 * the engine's per-workspace fraud guard can't see) plus completed
 * verifications to the same destination hash.
 */
export async function loadPumpingSignals(
  e164: string,
  windowMs: number,
): Promise<PumpingSignals> {
  const { getSabsmsCollections } = await import('../db/collections');
  const { recipientHash } = await import('../verify/codes');
  const { cols } = await getSabsmsCollections();
  const since = new Date(Date.now() - windowMs);

  const sendMatch = {
    to: e164,
    direction: 'outbound' as const,
    category: 'otp' as const,
    createdAt: { $gte: since },
  };

  const [crossTenantSends, tenants, crossTenantConversions] = await Promise.all([
    cols.messages.countDocuments(sendMatch),
    cols.messages.distinct('workspaceId', sendMatch),
    cols.verifications.countDocuments({
      recipientHash: recipientHash(e164),
      status: 'verified',
      createdAt: { $gte: since },
    }),
  ]);

  return {
    crossTenantSends,
    distinctTenants: tenants.length,
    crossTenantConversions,
  };
}

/** Default guard: load signals + score; used by the Verify orchestrator. */
export async function pumpingGuard(e164: string): Promise<PumpingVerdict> {
  const signals = await loadPumpingSignals(e164, 60 * 60 * 1000); // 1h window
  return scorePumpingRisk(signals);
}

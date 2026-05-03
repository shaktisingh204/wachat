/**
 * Lead routing — supports four strategies:
 *   - round-robin    (state held externally; a cursor is passed in/out)
 *   - weighted       (probabilistic by `SalesRep.weight`, deterministic mode also available)
 *   - territory      (matches `lead.country`/`region` against `rep.territories`)
 *   - sla-aware      (prefers reps with available SLA capacity / lowest open load)
 *
 * `routeLead` is the umbrella function that dispatches to a strategy.
 */
import type { Lead, SalesRep } from './types';

export type RoutingStrategy =
  | 'round-robin'
  | 'weighted'
  | 'territory'
  | 'sla-aware';

export interface RoutingOptions {
  strategy: RoutingStrategy;
  /** Round-robin cursor (caller persists this across calls). */
  cursor?: number;
  /** When using `weighted`, pass a deterministic random in [0,1) for tests. */
  random?: number;
  /** Fallback strategy when primary returns nothing. */
  fallback?: RoutingStrategy;
}

export interface RoutingResult {
  repId: string | null;
  /** Updated cursor — only meaningful for `round-robin`. */
  cursor: number;
  reason: string;
  strategyUsed: RoutingStrategy | 'none';
}

function availableReps(reps: SalesRep[]): SalesRep[] {
  return reps.filter(r => r.available !== false);
}

export function roundRobin(
  reps: SalesRep[],
  cursor = 0,
): RoutingResult {
  const pool = availableReps(reps);
  if (pool.length === 0) {
    return { repId: null, cursor, reason: 'no-available-reps', strategyUsed: 'round-robin' };
  }
  const idx = ((cursor % pool.length) + pool.length) % pool.length;
  return {
    repId: pool[idx].id,
    cursor: cursor + 1,
    reason: 'round-robin',
    strategyUsed: 'round-robin',
  };
}

export function weighted(
  reps: SalesRep[],
  random?: number,
): RoutingResult {
  const pool = availableReps(reps).filter(r => (r.weight ?? 1) > 0);
  if (pool.length === 0) {
    return { repId: null, cursor: 0, reason: 'no-weighted-reps', strategyUsed: 'weighted' };
  }
  const totalWeight = pool.reduce((s, r) => s + (r.weight ?? 1), 0);
  const r = typeof random === 'number' ? random : Math.random();
  let target = r * totalWeight;
  for (const rep of pool) {
    target -= rep.weight ?? 1;
    if (target <= 0) {
      return {
        repId: rep.id,
        cursor: 0,
        reason: `weighted (w=${rep.weight ?? 1})`,
        strategyUsed: 'weighted',
      };
    }
  }
  // Floating-point safety: return last rep.
  const last = pool[pool.length - 1];
  return {
    repId: last.id,
    cursor: 0,
    reason: 'weighted-fallback',
    strategyUsed: 'weighted',
  };
}

export function territoryMatch(
  lead: Lead,
  reps: SalesRep[],
): RoutingResult {
  const pool = availableReps(reps);
  if (pool.length === 0) {
    return { repId: null, cursor: 0, reason: 'no-available-reps', strategyUsed: 'territory' };
  }
  const wanted = [lead.country, lead.region].filter(Boolean) as string[];
  if (wanted.length === 0) {
    return { repId: null, cursor: 0, reason: 'no-territory-on-lead', strategyUsed: 'territory' };
  }
  const matches = pool.filter(rep =>
    (rep.territories ?? []).some(t => wanted.includes(t)),
  );
  if (matches.length === 0) {
    return { repId: null, cursor: 0, reason: 'no-territory-match', strategyUsed: 'territory' };
  }
  // Pick the rep with the most specific match (most matching territories).
  matches.sort((a, b) => {
    const aHits = (a.territories ?? []).filter(t => wanted.includes(t)).length;
    const bHits = (b.territories ?? []).filter(t => wanted.includes(t)).length;
    return bHits - aHits;
  });
  return {
    repId: matches[0].id,
    cursor: 0,
    reason: `territory-match (${wanted.join(',')})`,
    strategyUsed: 'territory',
  };
}

export function slaAware(
  lead: Lead,
  reps: SalesRep[],
): RoutingResult {
  const pool = availableReps(reps);
  if (pool.length === 0) {
    return { repId: null, cursor: 0, reason: 'no-available-reps', strategyUsed: 'sla-aware' };
  }
  // Score: tighter SLA + lower open-lead load wins.
  const scored = pool.map(rep => {
    const sla = rep.slaMinutes ?? 1440;
    const open = rep.openLeads ?? 0;
    // Lower score is better.
    const score = sla / 60 + open * 5;
    return { rep, score };
  });
  scored.sort((a, b) => a.score - b.score);
  const winner = scored[0].rep;
  return {
    repId: winner.id,
    cursor: 0,
    reason: `sla-aware (sla=${winner.slaMinutes ?? 'n/a'}m, open=${winner.openLeads ?? 0})`,
    strategyUsed: 'sla-aware',
  };
}

/**
 * Route a lead to a sales rep using the requested strategy. The function is
 * pure — round-robin state is supplied via `options.cursor` and returned for
 * the caller to persist.
 */
export function routeLead(
  lead: Lead,
  reps: SalesRep[],
  options: RoutingOptions = { strategy: 'round-robin' },
): RoutingResult {
  // First, narrow by industry where the rep declares specialisation.
  let pool = reps;
  if (lead.industry) {
    const specialised = reps.filter(r =>
      (r.industries ?? []).length === 0 || r.industries!.includes(lead.industry!),
    );
    if (specialised.length > 0) pool = specialised;
  }

  let result: RoutingResult;
  switch (options.strategy) {
    case 'weighted':
      result = weighted(pool, options.random);
      break;
    case 'territory':
      result = territoryMatch(lead, pool);
      break;
    case 'sla-aware':
      result = slaAware(lead, pool);
      break;
    case 'round-robin':
    default:
      result = roundRobin(pool, options.cursor ?? 0);
      break;
  }

  if (!result.repId && options.fallback && options.fallback !== options.strategy) {
    return routeLead(lead, reps, { ...options, strategy: options.fallback, fallback: undefined });
  }
  return result;
}

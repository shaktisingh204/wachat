/**
 * Competitor gap analysis. Given our keyword positions and theirs, find
 * keywords where competitors outrank us and surface them as opportunities.
 */
import type { CompetitorGap, RankPosition } from './types';

export type CompetitorRanks = {
  competitor: string;
  positions: RankPosition[];
};

export type GapAnalysisInput = {
  ourPositions: RankPosition[];
  competitors: CompetitorRanks[];
  /** Volume estimates by keyword, optional. */
  volumeMap?: Record<string, number>;
};

/**
 * Pure function. Returns gaps sorted by opportunity (descending volume,
 * then by ease of catch-up).
 */
export function analyzeGaps(input: GapAnalysisInput): CompetitorGap[] {
  const ourMap = new Map(input.ourPositions.map((p) => [p.keyword, p.position]));
  const gaps: CompetitorGap[] = [];

  for (const c of input.competitors) {
    for (const pos of c.positions) {
      if (pos.position == null) continue;
      const ours = ourMap.get(pos.keyword) ?? null;
      if (ours != null && ours <= pos.position) continue; // we already win
      const volume = input.volumeMap?.[pos.keyword] ?? 0;
      gaps.push({
        keyword: pos.keyword,
        ourPosition: ours,
        theirPosition: pos.position,
        competitor: c.competitor,
        volume,
        opportunity: classify(pos.position, ours),
      });
    }
  }

  return gaps.sort((a, b) => {
    if (b.volume !== a.volume) return b.volume - a.volume;
    return rank(a.opportunity) - rank(b.opportunity);
  });
}

function classify(theirPos: number, ourPos: number | null): CompetitorGap['opportunity'] {
  if (theirPos <= 3) return 'hard';
  if (theirPos <= 10) return ourPos == null ? 'medium' : 'medium';
  return 'easy';
}

function rank(o: CompetitorGap['opportunity']): number {
  return { easy: 0, medium: 1, hard: 2 }[o];
}

/**
 * Roll up gaps to a per-competitor scorecard for dashboards.
 */
export function summarizeByCompetitor(gaps: CompetitorGap[]): {
  competitor: string;
  totalGaps: number;
  totalVolume: number;
  easyWins: number;
}[] {
  const map = new Map<string, { totalGaps: number; totalVolume: number; easyWins: number }>();
  for (const g of gaps) {
    const e = map.get(g.competitor) ?? { totalGaps: 0, totalVolume: 0, easyWins: 0 };
    e.totalGaps += 1;
    e.totalVolume += g.volume;
    if (g.opportunity === 'easy') e.easyWins += 1;
    map.set(g.competitor, e);
  }
  return Array.from(map.entries()).map(([competitor, v]) => ({ competitor, ...v }));
}

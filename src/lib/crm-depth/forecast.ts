/**
 * Revenue forecasting from a pipeline + deal set.
 *
 * Three methods:
 *   - best-case  — sum of all open + won deals at full amount.
 *   - commit     — sum of deals tagged `forecastCategory: 'commit'` (or 'won').
 *   - weighted   — sum of `amount * probability`, defaulting to stage probability.
 */
import type {
  Deal,
  ForecastBreakdown,
  ForecastMethod,
  ForecastResult,
  Pipeline,
} from './types';

function probabilityFor(deal: Deal, pipeline: Pipeline): number {
  if (typeof deal.probability === 'number') {
    return Math.max(0, Math.min(100, deal.probability)) / 100;
  }
  const stage = pipeline.stages.find(s => s.id === deal.stageId);
  if (!stage) return 0;
  return Math.max(0, Math.min(100, stage.probability)) / 100;
}

function isOpen(deal: Deal): boolean {
  return deal.status === 'open';
}

function isWon(deal: Deal): boolean {
  return deal.status === 'won';
}

/**
 * Compute a forecast over the deals using one of the supported methods.
 * The pipeline supplies stage probabilities for the `weighted` method.
 */
export function forecastRevenue(
  pipeline: Pipeline,
  deals: Deal[],
  method: ForecastMethod = 'weighted',
): ForecastResult {
  const currency = pipeline.currency ?? deals[0]?.currency ?? 'USD';
  const breakdownMap = new Map<string, ForecastBreakdown>();
  const stageMeta = new Map(pipeline.stages.map(s => [s.id, s]));

  for (const stage of pipeline.stages) {
    breakdownMap.set(stage.id, {
      stageId: stage.id,
      stageName: stage.name,
      dealCount: 0,
      totalAmount: 0,
      weightedAmount: 0,
    });
  }

  let total = 0;
  let dealCount = 0;

  for (const deal of deals) {
    if (deal.pipelineId !== pipeline.id) continue;

    const stage = stageMeta.get(deal.stageId);
    const stageType = stage?.type ?? 'open';

    if (stageType === 'lost') continue; // exclude lost from all forecast methods

    const inclusionByMethod = (() => {
      if (method === 'best-case') return isOpen(deal) || isWon(deal);
      if (method === 'commit') {
        if (isWon(deal)) return true;
        return isOpen(deal) && deal.forecastCategory === 'commit';
      }
      // weighted: include all open + won
      return isOpen(deal) || isWon(deal);
    })();

    if (!inclusionByMethod) continue;

    const amount = deal.amount;
    const prob = isWon(deal) ? 1 : probabilityFor(deal, pipeline);

    let contribution = 0;
    if (method === 'best-case') contribution = amount;
    else if (method === 'commit') contribution = amount;
    else contribution = amount * prob;

    total += contribution;
    dealCount += 1;

    const row = breakdownMap.get(deal.stageId) ?? {
      stageId: deal.stageId,
      stageName: stage?.name ?? deal.stageId,
      dealCount: 0,
      totalAmount: 0,
      weightedAmount: 0,
    };
    row.dealCount += 1;
    row.totalAmount += amount;
    row.weightedAmount += amount * prob;
    breakdownMap.set(deal.stageId, row);
  }

  const breakdown = Array.from(breakdownMap.values()).filter(b => b.dealCount > 0);
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return {
    method,
    currency,
    total: round2(total),
    dealCount,
    breakdown: breakdown.map(b => ({
      ...b,
      totalAmount: round2(b.totalAmount),
      weightedAmount: round2(b.weightedAmount),
    })),
    computedAt: new Date().toISOString(),
  };
}

/**
 * Compute all three methods at once — handy for dashboards.
 */
export function forecastAll(
  pipeline: Pipeline,
  deals: Deal[],
): Record<ForecastMethod, ForecastResult> {
  return {
    'best-case': forecastRevenue(pipeline, deals, 'best-case'),
    'commit': forecastRevenue(pipeline, deals, 'commit'),
    'weighted': forecastRevenue(pipeline, deals, 'weighted'),
  };
}

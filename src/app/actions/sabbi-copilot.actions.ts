'use server';

/**
 * SabBI AI copilot action — natural language → governed MetricQuery → result.
 * Grounded on the model's semantic layer (see `copilot.server.ts`).
 */

import { nlToMetricQuery } from '@/lib/sabbi/copilot.server';
import type { BiChartRunResponse, BiChartType } from '@/lib/rust-client/bi-charts';

import { getModelAction, runMetricQueryAction } from './sabbi-models.actions';

export type CopilotAnswer =
  | {
      ok: true;
      answer: string;
      query: {
        modelId: string;
        measures: string[];
        dimensions: string[];
        segments: string[];
        chartType?: BiChartType;
      };
      result: BiChartRunResponse;
    }
  | { ok: false; error: string };

export async function askCopilotAction(modelId: string, question: string): Promise<CopilotAnswer> {
  let model;
  try {
    model = await getModelAction(modelId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Model not found' };
  }

  const nl = await nlToMetricQuery(model, question);
  if (!nl.ok) return { ok: false, error: nl.error };

  try {
    const result = await runMetricQueryAction(nl.query);
    return {
      ok: true,
      answer: nl.answer,
      query: {
        modelId: nl.query.modelId,
        measures: nl.query.measures ?? [],
        dimensions: nl.query.dimensions ?? [],
        segments: nl.query.segments ?? [],
        chartType: nl.query.chartType,
      },
      result,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Query failed' };
  }
}

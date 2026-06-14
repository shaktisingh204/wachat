/**
 * Explore — the visual notebook query builder. Pick a governed model, then
 * stack Filter / Summarize / Visualize steps; results preview live and the
 * generated MetricQuery is always visible.
 */
import { listModelsAction } from '@/app/actions/sabbi-models.actions';

import { ExploreBuilder } from './explore-builder';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  let models: Awaited<ReturnType<typeof listModelsAction>>['items'] = [];
  try {
    models = (await listModelsAction({ limit: 200 })).items;
  } catch {
    models = [];
  }
  return <ExploreBuilder models={models} />;
}

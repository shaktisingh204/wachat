/**
 * Query Lab — the raw, governed aggregation surface (the SQL-Lab analog for
 * SabBI's Mongo engine). Write aggregation stages against a model's collection;
 * the tenant + base-filter `$match` is enforced server-side and write/code
 * stages are rejected.
 */
import { listModelsAction } from '@/app/actions/sabbi-models.actions';

import { QueryLab } from './query-lab';

export const dynamic = 'force-dynamic';

export default async function SqlLabPage() {
  let models: Awaited<ReturnType<typeof listModelsAction>>['items'] = [];
  try {
    models = (await listModelsAction({ limit: 200 })).items;
  } catch {
    models = [];
  }
  return <QueryLab models={models} />;
}

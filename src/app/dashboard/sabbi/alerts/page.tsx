/**
 * Alerts — threshold checks on a model's measure, delivered by email + a
 * SabFlow webhook trigger. "Check now" evaluates them on demand (a cron/worker
 * runs the same logic on a schedule).
 */
import { listAlertsAction } from '@/app/actions/sabbi-alerts.actions';
import { listModelsAction } from '@/app/actions/sabbi-models.actions';

import { AlertsView } from './alerts-view';

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const [alerts, modelsRes] = await Promise.all([
    listAlertsAction().catch(() => []),
    listModelsAction({ limit: 200 }).catch(() => ({ items: [] as Awaited<ReturnType<typeof listModelsAction>>['items'] })),
  ]);
  return <AlertsView alerts={alerts} models={modelsRes.items} />;
}

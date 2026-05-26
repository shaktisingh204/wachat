/**
 * Velocity chart — last N completed sprints. Server pre-fetches the
 * snapshots (oldest-first) and hands them to the client chart.
 */
import { listVelocity } from '@/app/actions/agile.actions';

import { VelocityChart } from './_components/velocity-chart';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function VelocityPage({ params }: PageProps) {
  const { projectId } = await params;
  const res = await listVelocity({ projectId, limit: 12 });
  const items = res.ok ? res.data.items : [];
  return <VelocityChart items={items} />;
}

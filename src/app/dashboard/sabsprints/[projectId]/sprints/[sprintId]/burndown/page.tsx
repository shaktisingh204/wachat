/**
 * Burndown — ideal vs actual remaining-points line chart for one sprint.
 * Server pre-fetches the sprint (for capacity / dates) and the burndown
 * samples; client component renders the chart.
 */
import { notFound } from 'next/navigation';

import { getSprint, listBurndown, listStories } from '@/app/actions/agile.actions';

import { BurndownChart } from './_components/burndown-chart';

interface PageProps {
  params: Promise<{ projectId: string; sprintId: string }>;
}

export default async function BurndownPage({ params }: PageProps) {
  const { projectId, sprintId } = await params;
  const sprintRes = await getSprint(sprintId);
  if (!sprintRes.ok) notFound();

  const [samplesRes, storiesRes] = await Promise.all([
    listBurndown(sprintId),
    listStories({ projectId, sprintId, limit: 200 }),
  ]);

  const totalPoints = storiesRes.ok
    ? storiesRes.data.items.reduce((acc, s) => acc + (s.points ?? 0), 0)
    : 0;

  return (
    <BurndownChart
      sprint={sprintRes.data}
      samples={samplesRes.ok ? samplesRes.data.items : []}
      totalPoints={totalPoints}
    />
  );
}

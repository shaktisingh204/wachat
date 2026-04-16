import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LuChevronRight, LuChartBar as LuBarChart2 } from 'react-icons/lu';
import {
  getFlowSessions,
  getFlowResultsStats,
  getSessionsPerDay,
  type FlowResultsStats,
  type DailyCount,
  type FlowSession,
} from '@/app/actions/sabflow-results';
import { ResultsPageClient } from '@/components/sabflow/results/ResultsPageClient';

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { flowId } = await params;
  const result = await getFlowSessions(flowId, 1, 1);
  const flowName = 'flowName' in result ? result.flowName : 'Flow';
  return {
    title: `${flowName} — Results | SabFlow`,
  };
}

export default async function FlowResultsPage({ params }: Props) {
  const { flowId } = await params;

  // Fetch all initial data in parallel
  const [sessResult, statsResult, dailyResult] = await Promise.all([
    getFlowSessions(flowId, 1, 20),
    getFlowResultsStats(flowId),
    getSessionsPerDay(flowId, 7),
  ]);

  // If ownership check fails, 404
  if ('error' in sessResult || 'error' in statsResult) {
    notFound();
  }

  const { sessions, total, flowName } = sessResult as {
    sessions: FlowSession[];
    total: number;
    flowName: string;
  };

  const stats = statsResult as FlowResultsStats;

  const EMPTY_DAILY: DailyCount[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return { date: d.toISOString().slice(0, 10), total: 0, completed: 0 };
  });

  const dailyCounts: DailyCount[] = Array.isArray(dailyResult)
    ? (dailyResult as DailyCount[])
    : EMPTY_DAILY;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          {/* Breadcrumb */}
          <Link
            href="/dashboard/sabflow/flow-builder"
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            SabFlow
          </Link>
          <LuChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <Link
            href={`/dashboard/sabflow/flow-builder/${flowId}`}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors truncate max-w-[160px]"
            title={flowName}
          >
            {flowName}
          </Link>
          <LuChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Results</span>

          <div className="ml-auto flex items-center gap-1 text-amber-500">
            <LuBarChart2 className="w-4 h-4" />
            <span className="text-sm font-semibold">Analytics</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {flowName}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Flow results and session analytics
          </p>
        </div>

        <ResultsPageClient
          flowId={flowId}
          initialSessions={sessions}
          initialTotal={total}
          initialStats={stats}
          initialDailyCounts={dailyCounts}
        />
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

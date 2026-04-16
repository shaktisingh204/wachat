import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LuChevronRight, LuChartBar as LuBarChart2 } from 'react-icons/lu';
import { getSabFlow } from '@/app/actions/sabflow';
import { FlowResultsClient } from '@/components/sabflow/results/FlowResultsClient';

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);
  return {
    title: flow ? `${flow.name} — Results | SabFlow` : 'Results | SabFlow',
  };
}

export default async function FlowResultsPage({ params }: Props) {
  const { flowId } = await params;
  const flow = await getSabFlow(flowId);

  if (!flow) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Sticky header with breadcrumb */}
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-2">
          <Link
            href="/dashboard/sabflow/flow-builder"
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            SabFlow
          </Link>
          <LuChevronRight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <Link
            href={`/dashboard/sabflow/flow-builder/${flowId}`}
            className="text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors truncate max-w-[160px]"
            title={flow.name}
          >
            {flow.name}
          </Link>
          <LuChevronRight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Results</span>
          <div className="ml-auto flex items-center gap-1.5 text-amber-500">
            <LuBarChart2 className="w-4 h-4" />
            <span className="text-sm font-semibold hidden sm:inline">Analytics</span>
          </div>
        </div>
      </div>

      {/* Page body */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{flow.name}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Submission results and analytics
          </p>
        </div>

        {/* All interactivity lives in the client component */}
        <FlowResultsClient flowId={flowId} />
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';

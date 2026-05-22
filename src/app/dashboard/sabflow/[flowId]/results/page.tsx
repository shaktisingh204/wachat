import {
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import {
  notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getFlowResultsStats,
  getFlowSessions,
  getSessionsPerDay,
  type DailyCount,
  type FlowResultsStats,
  type FlowSession,
  } from "@/app/actions/sabflow-results";
import { ResultsPageClient } from "@/components/sabflow/results/ResultsPageClient";

type Props = {
  params: Promise<{ flowId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { flowId } = await params;
  const result = await getFlowSessions(flowId, 1, 1);
  const flowName = "flowName" in result ? result.flowName : "Flow";
  return {
    title: `${flowName} — Results | SabFlow`,
  };
}

export default async function FlowResultsPage({ params }: Props) {
  const { flowId } = await params;

  // Fetch initial data in parallel
  const [sessResult, statsResult, dailyResult] = await Promise.all([
    getFlowSessions(flowId, 1, 20),
    getFlowResultsStats(flowId),
    getSessionsPerDay(flowId, 7),
  ]);

  if ("error" in sessResult || "error" in statsResult) {
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
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabflow/flow-builder">
              SabFlow
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink
              href={`/dashboard/sabflow/flow-builder/${flowId}`}
            >
              {flowName}
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Results</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>{flowName}</ZoruPageTitle>
          <ZoruPageDescription>
            Flow results and session analytics.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      {/* Composite — kept opaque. */}
      <ResultsPageClient
        flowId={flowId}
        initialSessions={sessions}
        initialTotal={total}
        initialStats={stats}
        initialDailyCounts={dailyCounts}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";

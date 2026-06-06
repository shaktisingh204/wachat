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
} from '@/components/sabcrm/20ui/compat';
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  getFlowResultsStats,
  getFlowSessions,
  getSessionsPerDay,
  type DailyCount,
  type FlowResultsStats,
  type FlowSession,
} from "@/app/actions/sabflow-results";
import { ResultsDashboard } from "./ResultsDashboard";

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
    getFlowSessions(flowId, 1, 100), // fetch 100 recent sessions for the data table
    getFlowResultsStats(flowId),
    getSessionsPerDay(flowId, 30), // 30 days for the chart
  ]);

  if ("error" in sessResult || "error" in statsResult) {
    notFound();
  }

  const { sessions, flowName } = sessResult as {
    sessions: FlowSession[];
    flowName: string;
  };

  const stats = statsResult as FlowResultsStats;

  const EMPTY_DAILY: DailyCount[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return { date: d.toISOString().slice(0, 10), total: 0, completed: 0 };
  });

  const dailyCounts: DailyCount[] = Array.isArray(dailyResult)
    ? (dailyResult as DailyCount[])
    : EMPTY_DAILY;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
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
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>{flowName}</ZoruPageTitle>
          <ZoruPageDescription>
            Flow results and session analytics.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <ResultsDashboard
        stats={stats}
        dailyCounts={dailyCounts}
        sessions={sessions}
      />
    </div>
  );
}

export const dynamic = "force-dynamic";

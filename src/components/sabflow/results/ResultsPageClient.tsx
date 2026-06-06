'use client';

import { useState, useCallback, useTransition } from 'react';
import { LuActivity, LuCircleCheck as LuCheckCircle, LuUsers, LuMessageSquare } from 'react-icons/lu';
import {
  getFlowSessions,
  getFlowResultsStats,
  getSessionsPerDay,
  type FlowSession,
  type FlowResultsStats,
  type DailyCount,
} from '@/app/actions/sabflow-results';
import { ResultsTable } from './ResultsTable';
import { AnalyticsChart } from './AnalyticsChart';

/* ── StatCard ───────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex items-center gap-4 bg-white dark:bg-[var(--st-text)] border border-[var(--st-border)] dark:border-[var(--st-border)] rounded-xl px-5 py-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/20 flex items-center justify-center text-[var(--st-text)]">
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--st-text-secondary)] dark:text-[var(--st-text)] font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-[var(--st-text)] dark:text-white mt-0.5">{value}</p>
      </div>
    </div>
  );
}

/* ── ResultsPageClient ──────────────────────────────────── */

type Props = {
  flowId: string;
  initialSessions: FlowSession[];
  initialTotal: number;
  initialStats: FlowResultsStats;
  initialDailyCounts: DailyCount[];
};

const PAGE_SIZE = 20;

export function ResultsPageClient({
  flowId,
  initialSessions,
  initialTotal,
  initialStats,
  initialDailyCounts,
}: Props) {
  const [sessions, setSessions] = useState<FlowSession[]>(initialSessions);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState<FlowResultsStats>(initialStats);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>(initialDailyCounts);
  const [page, setPage] = useState(1);
  const [isLoading, startTransition] = useTransition();

  const loadPage = useCallback(
    (nextPage: number) => {
      startTransition(async () => {
        const result = await getFlowSessions(flowId, nextPage, PAGE_SIZE);
        if ('error' in result) return;
        setSessions(result.sessions);
        setTotal(result.total);
        setPage(nextPage);
      });
    },
    [flowId],
  );

  const refresh = useCallback(() => {
    startTransition(async () => {
      const [sessResult, statsResult, dailyResult] = await Promise.all([
        getFlowSessions(flowId, page, PAGE_SIZE),
        getFlowResultsStats(flowId),
        getSessionsPerDay(flowId, 7),
      ]);
      if (!('error' in sessResult)) {
        setSessions(sessResult.sessions);
        setTotal(sessResult.total);
      }
      if (!('error' in statsResult)) setStats(statsResult);
      if (!Array.isArray(dailyResult) || !('error' in dailyResult)) {
        setDailyCounts(dailyResult as DailyCount[]);
      }
    });
  }, [flowId, page]);

  return (
    <div className="flex flex-col gap-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<LuUsers className="w-5 h-5" />}
          label="Total sessions"
          value={stats.totalSessions}
        />
        <StatCard
          icon={<LuCheckCircle className="w-5 h-5" />}
          label="Completed"
          value={stats.completedSessions}
        />
        <StatCard
          icon={<LuActivity className="w-5 h-5" />}
          label="Completion rate"
          value={`${stats.completionRate}%`}
        />
        <StatCard
          icon={<LuMessageSquare className="w-5 h-5" />}
          label="Avg messages"
          value={stats.avgMessageCount}
        />
      </div>

      {/* Chart */}
      <AnalyticsChart dailyCounts={dailyCounts} completionRate={stats.completionRate} />

      {/* Table */}
      {total === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[var(--st-text)] border border-[var(--st-border)] dark:border-[var(--st-border)] rounded-xl text-center">
          <LuActivity className="w-10 h-10 text-[var(--st-text-secondary)] dark:text-[var(--st-text)] mb-3" />
          <p className="text-base font-semibold text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">No results yet</p>
          <p className="text-sm text-[var(--st-text-secondary)] dark:text-[var(--st-text)] mt-1 max-w-xs">
            Results will appear here once users start interacting with your published flow.
          </p>
        </div>
      ) : (
        <ResultsTable
          sessions={sessions}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          onPageChange={loadPage}
          onRefresh={refresh}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

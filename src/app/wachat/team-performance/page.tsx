'use client';

/**
 * Wachat Team Performance — ZoruUI rebuild.
 *
 * Team leaderboard + agent stat tiles + time-range dropdown
 * + per-agent drill-in sheet. Pure greyscale.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  ChevronDown,
  Eye,
  MessageSquare,
  RefreshCw,
  Timer,
  Users,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { getAgentPerformance } from '@/app/actions/wachat-features.actions';

import {
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuRadioGroup,
  ZoruDropdownMenuRadioItem,
  ZoruDropdownMenuTrigger,
  ZoruEmptyState,
  ZoruProgress,
  ZoruSheet,
  ZoruSheetContent,
  ZoruSheetDescription,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

type TimeRange = '7d' | '30d' | '90d';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

function formatResponseTime(ms: number | null | undefined): string {
  if (!ms) return '--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export default function TeamPerformancePage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<any[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [drillAgent, setDrillAgent] = useState<any | null>(null);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getAgentPerformance(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        const sorted = (res.performance ?? []).sort(
          (a: any, b: any) => (b.messagesSent ?? 0) - (a.messagesSent ?? 0),
        );
        setAgents(sorted);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxMessages = Math.max(1, ...agents.map((a) => a.messagesSent ?? 0));
  const totalMessages = agents.reduce((s, a) => s + (a.messagesSent ?? 0), 0);
  const avgResp = agents.length
    ? agents.reduce((s, a) => s + (a.avgResponseMs || 0), 0) / agents.length
    : 0;
  const topAgent = agents[0];

  return (
    <div className="flex min-h-full flex-col gap-6">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Team Performance</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Team Performance
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-zoru-ink-muted">
            Agent activity — messages sent and average response time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <ZoruButton variant="outline" size="sm">
                {TIME_RANGE_LABELS[timeRange]}
                <ChevronDown className="opacity-60" />
              </ZoruButton>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Time range</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuRadioGroup
                value={timeRange}
                onValueChange={(v) => setTimeRange(v as TimeRange)}
              >
                <ZoruDropdownMenuRadioItem value="7d">Last 7 days</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="30d">Last 30 days</ZoruDropdownMenuRadioItem>
                <ZoruDropdownMenuRadioItem value="90d">Last 90 days</ZoruDropdownMenuRadioItem>
              </ZoruDropdownMenuRadioGroup>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
          <ZoruButton variant="outline" size="sm" onClick={fetchData} disabled={isPending}>
            <RefreshCw className={isPending ? 'animate-spin' : ''} /> Refresh
          </ZoruButton>
        </div>
      </div>

      {isPending && agents.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <ZoruSkeleton key={i} className="h-[120px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ZoruStatCard
            label="Active Agents"
            value={agents.length.toLocaleString()}
            icon={<Users />}
          />
          <ZoruStatCard
            label="Total Messages"
            value={totalMessages.toLocaleString()}
            icon={<MessageSquare />}
          />
          <ZoruStatCard
            label="Avg Response"
            value={formatResponseTime(avgResp)}
            icon={<Timer />}
            period="Lower is better"
          />
          <ZoruStatCard
            label="Top Agent"
            value={topAgent?.agentName ?? '--'}
            period={
              topAgent
                ? `${(topAgent.messagesSent ?? 0).toLocaleString()} msgs`
                : 'No data'
            }
          />
        </div>
      )}

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Agent Leaderboard</ZoruCardTitle>
        </ZoruCardHeader>
        <ZoruCardContent>
          {isPending && agents.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <ZoruSkeleton key={i} className="h-10" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <ZoruEmptyState
              icon={<Users />}
              title="No agent activity"
              description="Agent leaderboard will populate once your team starts sending messages."
            />
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="w-[1%]">#</ZoruTableHead>
                  <ZoruTableHead>Agent</ZoruTableHead>
                  <ZoruTableHead className="text-right">Messages</ZoruTableHead>
                  <ZoruTableHead>Avg Response</ZoruTableHead>
                  <ZoruTableHead className="w-[40%]">Activity</ZoruTableHead>
                  <ZoruTableHead className="w-[1%]" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {agents.map((a, i) => {
                  const value =
                    ((a.messagesSent ?? 0) / maxMessages) * 100;
                  return (
                    <ZoruTableRow key={a._id}>
                      <ZoruTableCell className="text-zoru-ink-muted tabular-nums">
                        {i + 1}
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium">
                        <span className="inline-flex items-center gap-2">
                          {a.agentName}
                          {i === 0 && (
                            <ZoruBadge variant="success">Top</ZoruBadge>
                          )}
                        </span>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right tabular-nums font-mono">
                        {(a.messagesSent ?? 0).toLocaleString()}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink-muted tabular-nums">
                        {formatResponseTime(a.avgResponseMs)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruProgress value={value} className="h-2" />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          onClick={() => setDrillAgent(a)}
                        >
                          <Eye /> View
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>

      {/* Per-agent drill-in sheet */}
      <ZoruSheet
        open={!!drillAgent}
        onOpenChange={(open) => {
          if (!open) setDrillAgent(null);
        }}
      >
        <ZoruSheetContent side="right">
          <ZoruSheetHeader>
            <ZoruSheetTitle>{drillAgent?.agentName ?? 'Agent'}</ZoruSheetTitle>
            <ZoruSheetDescription>
              Detailed performance for this team member.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {drillAgent && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <ZoruStatCard
                label="Messages Sent"
                value={(drillAgent.messagesSent ?? 0).toLocaleString()}
                icon={<MessageSquare />}
              />
              <ZoruStatCard
                label="Avg Response"
                value={formatResponseTime(drillAgent.avgResponseMs)}
                icon={<Timer />}
                period="Lower is better"
              />
              {typeof drillAgent.totalConversations === 'number' && (
                <ZoruStatCard
                  label="Conversations"
                  value={drillAgent.totalConversations.toLocaleString()}
                  icon={<Users />}
                />
              )}
              <ZoruStatCard
                label="Share of Volume"
                value={`${Math.round(
                  ((drillAgent.messagesSent ?? 0) / Math.max(totalMessages, 1)) * 100,
                )}%`}
              />
            </div>
          )}
        </ZoruSheetContent>
      </ZoruSheet>

      <div className="h-6" />
    </div>
  );
}

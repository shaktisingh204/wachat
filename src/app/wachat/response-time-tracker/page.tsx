'use client';

/**
 * Wachat Response Time Tracker — ZoruUI rebuild.
 *
 * Stat strip + agent leaderboard table + per-agent drill-in sheet.
 * Response-time deltas use invertDelta=true (lower is better).
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import {
  BarChart3,
  CircleCheck,
  CircleX,
  Eye,
  RefreshCw,
  TriangleAlert,
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
  ZoruEmptyState,
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

function fmtMs(ms: number | undefined) {
  if (!ms || !Number.isFinite(ms)) return '--';
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function speedTone(ms: number) {
  if (!ms) return 'ghost' as const;
  if (ms < 60_000) return 'success' as const;
  if (ms < 300_000) return 'warning' as const;
  return 'danger' as const;
}

function speedLabel(ms: number) {
  if (!ms) return '—';
  if (ms < 60_000) return 'Fast';
  if (ms < 300_000) return 'Average';
  return 'Slow';
}

export default function ResponseTimeTrackerPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<any[]>([]);
  const [drillAgent, setDrillAgent] = useState<any | null>(null);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getAgentPerformance(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      setAgents(res.performance ?? []);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const totalMsgs = agents.reduce((s, a) => s + (a.messagesSent || 0), 0);
  const avgResp = agents.length
    ? agents.reduce((s, a) => s + (a.avgResponseMs || 0), 0) / agents.length
    : 0;
  const fastest = agents.length
    ? Math.min(...agents.map((a) => a.avgResponseMs || Infinity))
    : 0;
  const slowest = agents.length
    ? Math.max(...agents.map((a) => a.avgResponseMs || 0))
    : 0;

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
            <ZoruBreadcrumbPage>Response Time Tracker</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-zoru-ink leading-[1.1]">
            Response Time Tracker
          </h1>
          <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
            Monitor how quickly your team responds to customer messages.
          </p>
        </div>
        <ZoruButton variant="outline" size="sm" onClick={load} disabled={isPending}>
          <RefreshCw className={isPending ? 'animate-spin' : ''} /> Refresh
        </ZoruButton>
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
            label="Total Messages"
            value={totalMsgs.toLocaleString()}
            icon={<BarChart3 />}
          />
          <ZoruStatCard
            label="Avg Response"
            value={fmtMs(avgResp)}
            icon={<CircleCheck />}
            period="Lower is better"
          />
          <ZoruStatCard
            label="Fastest Agent"
            value={fmtMs(fastest)}
            icon={<CircleCheck />}
          />
          <ZoruStatCard
            label="Slowest Agent"
            value={fmtMs(slowest)}
            icon={<TriangleAlert />}
          />
        </div>
      )}

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Per-Agent Breakdown</ZoruCardTitle>
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
              title="No agent performance yet"
              description="Performance data will appear once agents start responding to chats."
            />
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead>Agent</ZoruTableHead>
                  <ZoruTableHead>Avg Response</ZoruTableHead>
                  <ZoruTableHead className="text-right">Messages Sent</ZoruTableHead>
                  <ZoruTableHead className="text-right">Status</ZoruTableHead>
                  <ZoruTableHead className="w-[1%]" />
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {agents.map((a: any) => (
                  <ZoruTableRow key={a._id}>
                    <ZoruTableCell className="font-medium">{a.agentName}</ZoruTableCell>
                    <ZoruTableCell className="tabular-nums">
                      {fmtMs(a.avgResponseMs)}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right tabular-nums">
                      {(a.messagesSent ?? 0).toLocaleString()}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruBadge variant={speedTone(a.avgResponseMs || 0)}>
                        {speedLabel(a.avgResponseMs || 0)}
                      </ZoruBadge>
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
                ))}
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
              Activity and response performance for this agent.
            </ZoruSheetDescription>
          </ZoruSheetHeader>
          {drillAgent && (
            <div className="mt-6 grid grid-cols-2 gap-3">
              <ZoruStatCard
                label="Avg Response"
                value={fmtMs(drillAgent.avgResponseMs)}
                period="Lower is better"
              />
              <ZoruStatCard
                label="Messages Sent"
                value={(drillAgent.messagesSent ?? 0).toLocaleString()}
              />
              <ZoruStatCard
                label="Status"
                value={speedLabel(drillAgent.avgResponseMs || 0)}
              />
              {typeof drillAgent.totalConversations === 'number' && (
                <ZoruStatCard
                  label="Conversations"
                  value={drillAgent.totalConversations.toLocaleString()}
                />
              )}
            </div>
          )}
        </ZoruSheetContent>
      </ZoruSheet>

      <div className="h-6" />
    </div>
  );
}

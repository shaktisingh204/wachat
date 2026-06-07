'use client';

import {
  useToast,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Menu,
  MenuItem,
  MenuLabel,
  EmptyState,
  Progress,
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  Skeleton,
  StatCard,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
  Tooltip,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  MessageSquare,
  RefreshCw,
  Star,
  Timer,
  Trophy,
  Users,
  } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { getAgentPerformance } from '@/app/actions/wachat-analytics.actions';
import type { AgentPerformanceRow } from '@/lib/rust-client/wachat-analytics';
import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * Wachat Team Performance — 20ui rebuild.
 *
 * Team leaderboard + agent stat tiles + time-range menu
 * + per-agent drill-in drawer. Gamification and statistical significance included.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

type TimeRange = '7d' | '30d' | '90d';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
};

const TIME_RANGES: TimeRange[] = ['7d', '30d', '90d'];

/** Map legacy ui20 badge variants onto 20ui Badge tones. */
type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
function badgeTone(variant?: string): BadgeTone {
  switch (variant) {
    case 'success':
      return 'success';
    case 'secondary':
      return 'info';
    case 'default':
      return 'accent';
    default:
      return 'neutral';
  }
}

function formatResponseTime(ms: number | null | undefined): string {
  if (!ms) return '--';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/**
 * CSAT is a 1–5 star average from `wa_chat_ratings` (never a percentage).
 * Show `—` when an agent has no ratings so an empty score never reads as 0/5.
 */
function formatCsat(score: number, reviews: number): string {
  if (!reviews) return '—';
  return `${score.toFixed(1)} / 5`;
}

type AgentBadge = { label: string; variant: string };
type EnrichedAgent = AgentPerformanceRow & {
  points: number;
  badges: AgentBadge[];
};

export default function TeamPerformancePage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [agents, setAgents] = useState<EnrichedAgent[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [drillAgent, setDrillAgent] = useState<EnrichedAgent | null>(null);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const days = parseInt(timeRange.replace('d', ''));
      const res = await getAgentPerformance(activeProjectId, days);
      if ('error' in res) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
      } else {
        // Real per-agent stats from Mongo (incl. CSAT) — gamification points
        // and badges are display-only derivations of those real numbers.
        const enhanced: EnrichedAgent[] = (res.performance ?? []).map((a) => {
          const responseTimeSec = Math.floor((a.avgResponseMs || 0) / 1000);
          const points = Math.max(0, (a.messagesSent || 0) * 10 - responseTimeSec);

          const badges: AgentBadge[] = [];
          if (responseTimeSec > 0 && responseTimeSec < 60) badges.push({ label: 'Speed Demon', variant: 'success' });
          if ((a.messagesSent || 0) > 50) badges.push({ label: 'Volume King', variant: 'default' });
          if (a.csatScore >= 4.5 && a.csatReviews >= 30) badges.push({ label: 'Customer Favorite', variant: 'secondary' });

          return { ...a, points, badges };
        });

        const sorted = enhanced.sort((a, b) => (b.points ?? 0) - (a.points ?? 0));
        setAgents(sorted);
      }
    });
  }, [activeProjectId, toast, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const maxPoints = Math.max(1, ...agents.map((a) => a.points ?? 0));
  const totalMessages = agents.reduce((s, a) => s + (a.messagesSent ?? 0), 0);
  const avgResp = agents.length
    ? agents.reduce((s, a) => s + (a.avgResponseMs || 0), 0) / agents.length
    : 0;
  const topAgent = agents[0];

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Team Performance' },
      ]}
      title="Team Performance"
      description="Agent activity — messages sent, average response time, and gamified performance."
      width="wide"
      actions={
        <div className="flex items-center gap-2">
          <Menu
            align="end"
            label="Time range"
            trigger={
              <Button variant="outline" size="sm" iconRight={ChevronDown}>
                {TIME_RANGE_LABELS[timeRange]}
              </Button>
            }
          >
            <MenuLabel>Time range</MenuLabel>
            {TIME_RANGES.map((r) => (
              <MenuItem
                key={r}
                icon={timeRange === r ? Check : undefined}
                onSelect={() => setTimeRange(r)}
              >
                {TIME_RANGE_LABELS[r]}
              </MenuItem>
            ))}
          </Menu>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={isPending}
            iconLeft={RefreshCw}
          >
            Refresh
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {isPending && agents.length === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={120} radius="var(--st-radius-lg)" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Active Agents"
              value={agents.length.toLocaleString()}
              icon={Users}
            />
            <StatCard
              label="Total Messages"
              value={totalMessages.toLocaleString()}
              icon={MessageSquare}
            />
            <StatCard
              label="Avg Response"
              value={formatResponseTime(avgResp)}
              icon={Timer}
              delta={{ value: 'Lower is better', tone: 'neutral' }}
            />
            <StatCard
              label="Top Agent"
              value={topAgent?.agentName ?? '--'}
              delta={{
                value: topAgent
                  ? `${(topAgent.points ?? 0).toLocaleString()} pts`
                  : 'No data',
                tone: 'neutral',
              }}
            />
          </div>
        )}

        <Card padding="none">
          <CardHeader>
            <CardTitle>Agent Leaderboard</CardTitle>
          </CardHeader>
          <CardBody>
            {isPending && agents.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} height={40} />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No agent activity"
                description="Agent leaderboard will populate once your team starts sending messages."
              />
            ) : (
              <Table>
                <THead>
                  <Tr>
                    <Th width="1%">#</Th>
                    <Th>Agent</Th>
                    <Th align="right">Points</Th>
                    <Th align="right">Messages</Th>
                    <Th>Avg Response</Th>
                    <Th>CSAT</Th>
                    <Th width="25%">Activity</Th>
                    <Th width="1%" />
                  </Tr>
                </THead>
                <TBody>
                  {agents.map((a, i) => {
                    const value =
                      ((a.points ?? 0) / maxPoints) * 100;
                    const isSignificant = a.csatReviews >= 30;
                    return (
                      <Tr key={a.agentId}>
                        <Td className="tabular-nums [color:var(--st-text-tertiary)]">
                          {i + 1}
                        </Td>
                        <Td className="font-medium">
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-flex items-center gap-2">
                              {a.agentName}
                              {i === 0 && (
                                <Trophy
                                  size={14}
                                  aria-hidden="true"
                                  className="[color:var(--st-text)]"
                                />
                              )}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {i === 0 && (
                                <Badge tone="success">Top Agent</Badge>
                              )}
                              {a.badges?.map((b, bi) => (
                                <Badge key={bi} tone={badgeTone(b.variant)}>
                                  {b.label}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </Td>
                        <Td
                          align="right"
                          className="tabular-nums font-mono font-bold [color:var(--st-text)]"
                        >
                          {(a.points ?? 0).toLocaleString()}
                        </Td>
                        <Td align="right" className="tabular-nums font-mono">
                          {(a.messagesSent ?? 0).toLocaleString()}
                        </Td>
                        <Td className="tabular-nums [color:var(--st-text-tertiary)]">
                          {formatResponseTime(a.avgResponseMs)}
                        </Td>
                        <Td className="tabular-nums">
                          <div className="flex items-center gap-1">
                            <span
                              className={
                                isSignificant
                                  ? '[color:var(--st-text)]'
                                  : '[color:var(--st-text-tertiary)]'
                              }
                            >
                              {formatCsat(a.csatScore, a.csatReviews)}
                            </span>
                            {!isSignificant && (
                              <Tooltip
                                label={`Not statistically significant (n = ${a.csatReviews} < 30)`}
                              >
                                <span
                                  role="img"
                                  aria-label={`Not statistically significant: n = ${a.csatReviews}, below 30`}
                                  className="inline-flex cursor-help [color:var(--st-warn)]"
                                  tabIndex={0}
                                >
                                  <AlertTriangle size={14} aria-hidden="true" />
                                </span>
                              </Tooltip>
                            )}
                            {isSignificant && (
                              <span className="text-xs ml-1 [color:var(--st-text-tertiary)]">
                                (n={a.csatReviews})
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td>
                          <Progress value={value} size="sm" label="Activity" />
                        </Td>
                        <Td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDrillAgent(a)}
                            iconLeft={Eye}
                          >
                            View
                          </Button>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Per-agent drill-in drawer */}
      <Drawer
        side="right"
        open={!!drillAgent}
        onOpenChange={(open) => {
          if (!open) setDrillAgent(null);
        }}
      >
        <DrawerContent side="right">
          <DrawerHeader>
            <DrawerTitle>{drillAgent?.agentName ?? 'Agent'}</DrawerTitle>
            <DrawerDescription>
              Detailed performance for this team member.
            </DrawerDescription>
          </DrawerHeader>
          {drillAgent && (
            <div className="mt-6 flex flex-col gap-6 px-1">
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Points Earned"
                  value={(drillAgent.points ?? 0).toLocaleString()}
                  icon={Trophy}
                />
                <StatCard
                  label="CSAT Score"
                  value={formatCsat(drillAgent.csatScore, drillAgent.csatReviews)}
                  icon={Star}
                  delta={{ value: `${drillAgent.csatReviews} reviews`, tone: 'neutral' }}
                />
                <StatCard
                  label="Messages Sent"
                  value={(drillAgent.messagesSent ?? 0).toLocaleString()}
                  icon={MessageSquare}
                />
                <StatCard
                  label="Avg Response"
                  value={formatResponseTime(drillAgent.avgResponseMs)}
                  icon={Timer}
                  delta={{ value: 'Lower is better', tone: 'neutral' }}
                />
                {typeof drillAgent.totalConversations === 'number' && (
                  <StatCard
                    label="Conversations"
                    value={drillAgent.totalConversations.toLocaleString()}
                    icon={Users}
                  />
                )}
                <StatCard
                  label="Share of Volume"
                  value={`${Math.round(
                    ((drillAgent.messagesSent ?? 0) / Math.max(totalMessages, 1)) * 100,
                  )}%`}
                />
              </div>

              {drillAgent.badges && drillAgent.badges.length > 0 && (
                <Card padding="md">
                  <h3 className="font-medium mb-3 [color:var(--st-text)]">
                    Earned Badges
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {drillAgent.badges.map((b, bi) => (
                      <Badge key={bi} tone={badgeTone(b.variant)}>
                        {b.label}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </WachatPage>
  );
}

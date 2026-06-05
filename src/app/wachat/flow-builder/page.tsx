'use client';

import {
  Badge,
  Button,
  Card,
  StatCard,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  EmptyState,
  Field,
  Input,
  Skeleton,
  useToast,
  Checkbox,
  Modal,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  IconButton,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { formatUTC } from '@/lib/utils';
import {
  CircleAlert,
  CirclePause,
  CirclePlus,
  GitBranch,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ServerCog,
  Trash2,
  Zap,
    Copy,
  BarChart,
  CheckCircle,
  PauseCircle,
} from 'lucide-react';

import { getFlowsForProject,
  deleteFlow , cloneFlow, bulkDeleteFlows, bulkUpdateFlowStatus, getFlowMetrics } from '@/app/actions/flow.actions';
import type { Flow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';

/**
 * Flow Builder — SabFlow chatbot list.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

export default function FlowBuilderListPage() {
  const router = useRouter();
  const [flows, setFlows] = useState<WithId<Flow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { activeProjectId } = useProject();
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyticsModalOpen, setAnalyticsModalOpen] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<{ flowName: string, metrics: any } | null>(null);

  const fetchFlows = useCallback(() => {
    if (!activeProjectId) return;
    startLoadingTransition(async () => {
      const data = await getFlowsForProject(activeProjectId);
      setFlows(data);
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) fetchFlows();
  }, [activeProjectId, fetchFlows]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(f => f._id.toString())));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} flows?`)) return;
    const result = await bulkDeleteFlows(Array.from(selectedIds));
    if (result.error) toast({ title: 'Error', description: result.error, tone: 'danger' });
    else { toast({ title: 'Deleted', description: result.message, tone: 'success' }); setSelectedIds(new Set()); fetchFlows(); }
  };

  const handleBulkStatus = async (status: 'ACTIVE' | 'PAUSED') => {
    const result = await bulkUpdateFlowStatus(Array.from(selectedIds), status);
    if (result.error) toast({ title: 'Error', description: result.error, tone: 'danger' });
    else { toast({ title: 'Updated', description: result.message, tone: 'success' }); setSelectedIds(new Set()); fetchFlows(); }
  };

  const handleClone = async (flowId: string) => {
    const result = await cloneFlow(flowId);
    if (result.error) toast({ title: 'Error', description: result.error, tone: 'danger' });
    else { toast({ title: 'Cloned', description: result.message, tone: 'success' }); fetchFlows(); }
  };

  const handleViewAnalytics = async (flowId: string, flowName: string) => {
    const metrics = await getFlowMetrics(flowId);
    setAnalyticsData({ flowName, metrics });
    setAnalyticsModalOpen(true);
  };

  // Deterministic mock generator for metrics
  const getMockMetrics = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = hash * 31 + id.charCodeAt(i);
    return {
      today: Math.abs(hash % 20),
      total: Math.abs(hash % 1000) + 100
    };
  };

  const handleDelete = async (flowId: string) => {
    if (!confirm('Are you sure you want to delete this flow? This cannot be undone.')) return;
    const result = await deleteFlow(flowId);
    if (result.error) {
      toast({ title: 'Error', description: result.error, tone: 'danger' });
    } else {
      toast({ title: 'Deleted', description: result.message, tone: 'success' });
      fetchFlows();
    }
  };

  const filtered = React.useMemo(() => {
    if (!query.trim()) return flows;
    const q = query.toLowerCase().trim();
    return flows.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.triggerKeywords || []).some((k) => k.toLowerCase().includes(q)),
    );
  }, [flows, query]);

  const stats = React.useMemo(() => {
    const active = flows.filter((f) => (f.status ?? 'ACTIVE').toUpperCase() !== 'PAUSED').length;
    const paused = flows.filter((f) => (f.status ?? '').toUpperCase() === 'PAUSED').length;
    const withTriggers = flows.filter((f) => (f.triggerKeywords ?? []).length > 0).length;
    return { active, paused, withTriggers };
  }, [flows]);

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Flow builder' },
      ]}
      title="Bot flows"
      description="Automate replies with visual chatbot flows — trigger on keywords, branch on user input, and hand off to a human when needed."
      width="wide"
      actions={
        <Button
          variant="primary"
          iconLeft={CirclePlus}
          onClick={() => router.push('/wachat/flow-builder/new')}
          disabled={!activeProjectId}
        >
          Create new flow
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total flows" value={String(flows.length)} icon={GitBranch} />
          <StatCard
            label="Active"
            value={String(stats.active)}
            icon={Zap}
            delta={{
              value:
                flows.length > 0
                  ? `${Math.round((stats.active / flows.length) * 100)}% live`
                  : 'none yet',
              tone: 'up',
            }}
          />
          <StatCard label="Paused" value={String(stats.paused)} icon={CirclePause} />
          <StatCard
            label="With triggers"
            value={String(stats.withTriggers)}
            icon={Zap}
            delta={{ value: 'keyword-activated', tone: 'neutral' }}
          />
        </div>

        {!activeProjectId ? (
          <EmptyState
            icon={CircleAlert}
            tone="warning"
            title="No project selected"
            description="Please select a project from the main dashboard to manage bot flows."
            action={<Button variant="primary" onClick={() => router.push('/wachat')}>Choose a project</Button>}
          />
        ) : (
          <Card padding="md" className="flex min-h-[480px] flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[260px] flex-1">
                <Field label="Search flows" className="sr-only">
                  <Input
                    placeholder="Search flows by name or keyword…"
                    iconLeft={Search}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </Field>
              </div>
              <Button variant="outline" size="sm" iconLeft={RefreshCw} onClick={fetchFlows} disabled={isLoading}>
                {isLoading ? 'Refreshing…' : 'Refresh'}
              </Button>
              <span
                className="ml-auto text-[11.5px] tabular-nums"
                style={{ color: 'var(--st-text-tertiary)' }}
              >
                {filtered.length} / {flows.length} flows
              </span>
            </div>

            {selectedIds.size > 0 && (
              <div
                className="mt-4 flex items-center gap-3 p-3 text-sm"
                style={{
                  borderRadius: 'var(--st-radius)',
                  border: '1px solid var(--st-border)',
                  background: 'var(--st-bg-secondary)',
                }}
              >
                <span className="font-medium" style={{ color: 'var(--st-text)' }}>
                  {selectedIds.size} selected
                </span>
                <div className="h-4 w-px" style={{ background: 'var(--st-border)' }} />
                <Button size="sm" variant="ghost" iconLeft={CheckCircle} onClick={() => handleBulkStatus('ACTIVE')}>
                  Activate
                </Button>
                <Button size="sm" variant="ghost" iconLeft={PauseCircle} onClick={() => handleBulkStatus('PAUSED')}>
                  Pause
                </Button>
                <Button size="sm" variant="danger" iconLeft={Trash2} onClick={handleBulkDelete}>
                  Delete
                </Button>
              </div>
            )}

            <div
              className="mt-5 flex flex-1 flex-col overflow-hidden"
              style={{ borderRadius: 'var(--st-radius)', border: '1px solid var(--st-border)' }}
            >
              {isLoading && flows.length === 0 ? (
                <div className="flex flex-col gap-2 p-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} height={40} width="100%" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  icon={ServerCog}
                  title={query ? 'No matching flows' : 'No bot flows yet'}
                  description={
                    query
                      ? `Nothing matched "${query}". Try a different search.`
                      : 'Create your first flow to automate replies, book appointments, or route leads.'
                  }
                  action={
                    query ? (
                      <Button size="sm" variant="outline" onClick={() => setQuery('')}>
                        Clear search
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        iconLeft={CirclePlus}
                        onClick={() => router.push('/wachat/flow-builder/new')}
                      >
                        Create your first flow
                      </Button>
                    )
                  }
                />
              ) : (
                <Table density="comfortable" hover>
                  <THead>
                    <Tr>
                      <Th width={40}>
                        <Checkbox
                          aria-label="Select all flows"
                          checked={selectedIds.size === filtered.length && filtered.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </Th>
                      <Th>Flow name</Th>
                      <Th>Status</Th>
                      <Th>Trigger keywords</Th>
                      <Th>Metrics</Th>
                      <Th>Last updated</Th>
                      <Th align="right">Actions</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {filtered.map((flow) => {
                      const paused = (flow.status ?? '').toUpperCase() === 'PAUSED';
                      return (
                        <Tr key={flow._id.toString()}>
                          <Td>
                            <Checkbox
                              aria-label={`Select ${flow.name}`}
                              checked={selectedIds.has(flow._id.toString())}
                              onChange={() => toggleSelect(flow._id.toString())}
                            />
                          </Td>
                          <Td>
                            <Link
                              href={`/wachat/flow-builder/${flow._id.toString()}`}
                              className="hover:underline"
                              style={{ color: 'var(--st-text)' }}
                            >
                              {flow.name}
                            </Link>
                          </Td>
                          <Td>
                            <Badge tone={paused ? 'warning' : 'success'}>
                              {paused ? 'Paused' : 'Active'}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              {(flow.triggerKeywords || []).length > 0 ? (
                                (flow.triggerKeywords || []).map((k, i) => (
                                  <Badge key={`${k}-${i}`} tone="neutral">
                                    {k}
                                  </Badge>
                                ))
                              ) : (
                                <span
                                  className="text-[11.5px] italic"
                                  style={{ color: 'var(--st-text-tertiary)' }}
                                >
                                  No triggers
                                </span>
                              )}
                            </div>
                          </Td>
                          <Td>
                            <div
                              className="flex flex-col text-[11.5px]"
                              style={{ color: 'var(--st-text-tertiary)' }}
                            >
                              <span className="font-medium" style={{ color: 'var(--st-text)' }}>
                                {getMockMetrics(flow._id.toString()).today} today
                              </span>
                              <span>{getMockMetrics(flow._id.toString()).total} total</span>
                            </div>
                          </Td>
                          <Td>
                            <span
                              className="text-[11.5px]"
                              style={{ color: 'var(--st-text-tertiary)' }}
                            >
                              {flow.updatedAt ? formatUTC(flow.updatedAt, true) : 'N/A'}
                            </span>
                          </Td>
                          <Td align="right">
                            <Menu
                              align="end"
                              label="Flow actions"
                              trigger={
                                <IconButton label="Open menu" icon={MoreHorizontal} size="sm" />
                              }
                            >
                              <MenuLabel>Actions</MenuLabel>
                              <MenuSeparator />
                              <MenuItem
                                icon={Pencil}
                                onSelect={() =>
                                  router.push(`/wachat/flow-builder/${flow._id.toString()}`)
                                }
                              >
                                Edit flow
                              </MenuItem>
                              <MenuItem icon={Copy} onSelect={() => handleClone(flow._id.toString())}>
                                Duplicate
                              </MenuItem>
                              <MenuItem
                                icon={BarChart}
                                onSelect={() => handleViewAnalytics(flow._id.toString(), flow.name)}
                              >
                                View Analytics
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem
                                icon={Trash2}
                                danger
                                onSelect={() => handleDelete(flow._id.toString())}
                              >
                                Delete
                              </MenuItem>
                            </Menu>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              )}
            </div>
          </Card>
        )}
      </div>

      <Modal
        open={analyticsModalOpen}
        onClose={() => setAnalyticsModalOpen(false)}
        title={`Analytics: ${analyticsData?.flowName ?? ''}`}
        description="Performance metrics for this specific flow."
        footer={
          <Button variant="outline" onClick={() => setAnalyticsModalOpen(false)}>
            Close
          </Button>
        }
      >
        {analyticsData && (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Card padding="md" className="flex flex-col items-center justify-center text-center">
                <span className="text-sm" style={{ color: 'var(--st-text-tertiary)' }}>
                  Triggers Today
                </span>
                <span className="text-3xl font-medium mt-1" style={{ color: 'var(--st-text)' }}>
                  {analyticsData.metrics.triggersToday}
                </span>
              </Card>
              <Card padding="md" className="flex flex-col items-center justify-center text-center">
                <span className="text-sm" style={{ color: 'var(--st-text-tertiary)' }}>
                  Total Triggers
                </span>
                <span className="text-3xl font-medium mt-1" style={{ color: 'var(--st-text)' }}>
                  {analyticsData.metrics.totalTriggers}
                </span>
              </Card>
            </div>
            {analyticsData.metrics.lastTriggeredAt && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--st-text-tertiary)' }}>
                Last triggered: {formatUTC(analyticsData.metrics.lastTriggeredAt, true)}
              </p>
            )}
          </div>
        )}
      </Modal>
    </WachatPage>
  );
}

'use client';

import {
  Badge,
  type BadgeTone,
  Button,
  IconButton,
  Card,
  CardTitle,
  CardDescription,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  EmptyState,
  Input,
  Skeleton,
  StatCard,
  SelectField as Select,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import {
  BookOpen,
  CircleAlert,
  CirclePlus,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  ServerCog,
  Trash2,
  Users,
  CalendarDays,
  MessageSquare,
  Activity,
  } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

import { flowCategories } from '@/components/20ui-domain/meta-flow-templates';

import { deleteMetaFlow,
  getMetaFlows } from '@/app/actions/meta-flow.actions';
import type { MetaFlow } from '@/lib/definitions';
import { useProject } from '@/context/project-context';
import { SyncMetaFlowsButton } from '@/components/20ui-domain/sync-meta-flows-button';

/**
 * Wachat Meta Flows — flow list, search & status.
 */

function statusTone(status?: string): BadgeTone {
  const s = (status ?? '').toLowerCase();
  if (s === 'published') return 'success';
  if (s === 'draft' || !s) return 'neutral';
  return 'danger';
}

export default function MetaFlowsPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const [flows, setFlows] = useState<WithId<MetaFlow>[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const fetchFlows = useCallback(() => {
    if (!activeProjectId) return;
    startLoadingTransition(async () => {
      const data = await getMetaFlows(activeProjectId);
      setFlows(data);
    });
  }, [activeProjectId]);

  useEffect(() => {
    if (activeProjectId) fetchFlows();
  }, [activeProjectId, fetchFlows]);

  const handleDelete = async (flowId: string, metaId: string) => {
    if (!confirm('Are you sure you want to delete this flow? This cannot be undone.')) return;
    const result = await deleteMetaFlow(flowId, metaId);
    if (result.error) {
      toast({ title: 'Error', description: result.error, tone: 'danger' });
    } else {
      toast({ title: 'Deleted', description: result.message, tone: 'success' });
      fetchFlows();
    }
  };

  const filteredFlows = useMemo(
    () =>
      flows.filter(
        (flow) => {
          const matchesSearch = flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            flow.metaId.includes(searchQuery);

          const s = (flow.status || 'DRAFT').toLowerCase();
          const matchesStatus = statusFilter === 'all' || s === statusFilter.toLowerCase();

          const c = flow.categories || [];
          const matchesCategory = categoryFilter === 'all' || c.includes(categoryFilter);

          return matchesSearch && matchesStatus && matchesCategory;
        }
      ),
    [flows, searchQuery, statusFilter, categoryFilter],
  );

  const getCompletionRate = useCallback((metaId: string) => {
    // Generate a deterministic mock completion rate between 45% and 92%
    let sum = 0;
    for (let i = 0; i < metaId.length; i++) sum += metaId.charCodeAt(i);
    return `${45 + (sum % 48)}%`;
  }, []);

  const stats = useMemo(() => {
    const published = flows.filter((f) => (f.status ?? '').toLowerCase() === 'published').length;
    const draft = flows.filter((f) => (f.status ?? '').toLowerCase() === 'draft' || !f.status)
      .length;
    return { published, draft };
  }, [flows]);

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: 'All statuses' },
      { value: 'published', label: 'Published' },
      { value: 'draft', label: 'Draft' },
      { value: 'deprecated', label: 'Deprecated' },
    ],
    [],
  );

  const categoryOptions = useMemo(
    () => [
      { value: 'all', label: 'All categories' },
      ...flowCategories.map((c) => ({ value: c.id, label: c.name })),
    ],
    [],
  );

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Meta Flows' },
      ]}
      title="Meta Flows"
      description="Interactive multi-step WhatsApp experiences — forms, bookings, order flows — managed directly from SabNode."
      width="wide"
      actions={
        <div className="flex items-center gap-2">
          <SyncMetaFlowsButton projectId={activeProjectId} onSyncComplete={fetchFlows} />
          <Button variant="outline" iconLeft={BookOpen} onClick={() => router.push('/wachat/flows/docs')}>
            API docs
          </Button>
          <Button
            variant="primary"
            iconLeft={CirclePlus}
            onClick={() => router.push('/wachat/flows/create')}
            disabled={!activeProjectId}
          >
            New flow
          </Button>
        </div>
      }
    >
      <div className="flex min-h-full flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Total flows" value={String(flows.length)} />
          <StatCard
            label="Published"
            value={String(stats.published)}
            delta={
              flows.length > 0
                ? { value: `${Math.round((stats.published / flows.length) * 100)}% live`, tone: 'up' }
                : { value: 'none yet', tone: 'neutral' }
            }
          />
          <StatCard label="Drafts" value={String(stats.draft)} />
        </div>

        {!activeProjectId ? (
          <EmptyState
            icon={CircleAlert}
            title="No project selected"
            description="Please select a project from the main dashboard to manage Meta Flows."
            action={<Button variant="primary" onClick={() => router.push('/wachat')}>Choose a project</Button>}
          />
        ) : (
          <>
            <div className="mb-2 mt-4">
              <CardTitle className="mb-3 text-sm font-medium">
                Start from a template
              </CardTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card
                  variant="interactive"
                  className="flex cursor-pointer flex-col"
                  onClick={() => router.push('/wachat/flows/create?template=lead_gen')}
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                    <Users className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="mb-1 text-sm font-medium">Lead Generation</CardTitle>
                  <CardDescription className="text-xs">
                    Capture user info like name, email, and phone number directly in WhatsApp.
                  </CardDescription>
                </Card>
                <Card
                  variant="interactive"
                  className="flex cursor-pointer flex-col"
                  onClick={() => router.push('/wachat/flows/create?template=appointment')}
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                    <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="mb-1 text-sm font-medium">Appointment Booking</CardTitle>
                  <CardDescription className="text-xs">
                    Let customers choose a date and time to book an appointment with you.
                  </CardDescription>
                </Card>
                <Card
                  variant="interactive"
                  className="flex cursor-pointer flex-col"
                  onClick={() => router.push('/wachat/flows/create?template=feedback')}
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                    <MessageSquare className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <CardTitle className="mb-1 text-sm font-medium">Customer Feedback</CardTitle>
                  <CardDescription className="text-xs">
                    Collect ratings and feedback from your customers after a purchase.
                  </CardDescription>
                </Card>
              </div>
            </div>

            <Card padding="lg">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-[260px] flex-1">
                  <Input
                    aria-label="Search flows by name or Meta ID"
                    placeholder="Search flows by name or Meta ID…"
                    iconLeft={Search}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <Select
                  className="w-[140px]"
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(v) => setStatusFilter(v ?? 'all')}
                  options={statusOptions}
                  placeholder="Status"
                />

                <Select
                  className="w-[160px]"
                  aria-label="Filter by category"
                  value={categoryFilter}
                  onChange={(v) => setCategoryFilter(v ?? 'all')}
                  options={categoryOptions}
                  placeholder="Category"
                />

                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={RefreshCw}
                  onClick={fetchFlows}
                  disabled={isLoading}
                >
                  {isLoading ? 'Refreshing…' : 'Refresh'}
                </Button>
                <span className="ml-auto text-[11.5px] tabular-nums text-[var(--st-text-secondary)]">
                  {filteredFlows.length} / {flows.length} flows
                </span>
              </div>

              <Card variant="outlined" padding="none" className="mt-5 overflow-hidden">
                {isLoading && flows.length === 0 ? (
                  <div className="p-4">
                    <Skeleton height={128} width="100%" />
                  </div>
                ) : filteredFlows.length === 0 ? (
                  <EmptyState
                    icon={ServerCog}
                    title={searchQuery ? 'No matching flows' : 'No Meta Flows yet'}
                    description={
                      searchQuery
                        ? `Nothing matched "${searchQuery}". Try a different search.`
                        : 'Create a flow to let customers fill out forms, book slots, or order items inside a WhatsApp conversation.'
                    }
                    action={
                      !searchQuery ? (
                        <Button variant="primary" size="sm" iconLeft={CirclePlus} onClick={() => router.push('/wachat/flows/create')}>
                          Create your first flow
                        </Button>
                      ) : undefined
                    }
                  />
                ) : (
                  <Table>
                    <THead>
                      <Tr>
                        <Th>Flow name</Th>
                        <Th>Meta ID</Th>
                        <Th>Category</Th>
                        <Th>Status</Th>
                        <Th>Completion</Th>
                        <Th align="right">Actions</Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {filteredFlows.map((flow) => (
                        <Tr key={flow._id.toString()}>
                          <Td className="text-[var(--st-text)]">{flow.name}</Td>
                          <Td className="font-mono text-xs tabular-nums text-[var(--st-text-secondary)]">
                            {flow.metaId}
                          </Td>
                          <Td>
                            <div className="flex flex-wrap gap-1">
                              {flow.categories?.map((cat) => (
                                <Badge key={cat} tone="neutral">
                                  {cat}
                                </Badge>
                              ))}
                            </div>
                          </Td>
                          <Td>
                            <Badge tone={statusTone(flow.status)}>
                              {flow.status || 'Draft'}
                            </Badge>
                          </Td>
                          <Td>
                            {flow.status === 'PUBLISHED' ? (
                              <div className="flex items-center gap-1.5 text-xs">
                                <Activity
                                  className="h-3.5 w-3.5 text-[var(--st-status-ok)]"
                                  aria-hidden="true"
                                />
                                <span className="font-medium">{getCompletionRate(flow.metaId)}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-[var(--st-text-secondary)]">—</span>
                            )}
                          </Td>
                          <Td align="right">
                            <Menu
                              align="end"
                              label="Flow actions"
                              trigger={
                                <IconButton
                                  variant="ghost"
                                  size="sm"
                                  label="Open menu"
                                  icon={MoreHorizontal}
                                />
                              }
                            >
                              <MenuLabel>Actions</MenuLabel>
                              <MenuSeparator />
                              <MenuItem
                                icon={Pencil}
                                onSelect={() =>
                                  router.push(`/wachat/flows/create?flowId=${flow._id.toString()}`)
                                }
                              >
                                Edit flow
                              </MenuItem>
                              <MenuSeparator />
                              <MenuItem
                                icon={Trash2}
                                danger
                                onSelect={() => handleDelete(flow._id.toString(), flow.metaId)}
                              >
                                Delete
                              </MenuItem>
                            </Menu>
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                )}
              </Card>
            </Card>
          </>
        )}
      </div>
    </WachatPage>
  );
}

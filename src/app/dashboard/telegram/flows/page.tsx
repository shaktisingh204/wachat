'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  PageActions,
  PageDescription,
  PageEyebrow,
  PageHeader,
  PageHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Workflow,
} from 'lucide-react';

import {
  createTelegramFlow,
  deleteTelegramFlow,
  disableTelegramFlow,
  duplicateTelegramFlow,
  enableTelegramFlow,
  listTelegramFlows,
  publishTelegramFlow,
} from '@/app/actions/telegram-flows.actions';
import type {
  FlowRow,
  FlowStatus,
} from '@/lib/rust-client/telegram-flows';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';

/**
 * /dashboard/telegram/flows - list of Telegram-scoped visual flows.
 *
 * Mirrors the SabFlow visual editor concept but scoped to Telegram triggers
 * (incoming_message, command, callback_query, schedule, business_connection).
 * Backed by the `telegram-flows` Rust crate via the server actions in
 * `@/app/actions/telegram-flows.actions`.
 */

/** Telegram brand blue, used only as an icon-chip tint via the `accent` prop. */
const ACCENT = '#229ED9';

/* -- trigger summary helper -------------------------------------------- */

function describeTrigger(t: FlowRow['trigger']): string {
  switch (t?.kind) {
    case 'incoming_message':
      return t.filter?.value ? `Incoming - ${t.filter.value}` : 'Incoming message';
    case 'command':
      return t.command ? `/${t.command}` : 'Command';
    case 'callback_query':
      return t.dataPrefix ? `Callback - ${t.dataPrefix}` : 'Callback';
    case 'schedule':
      return t.cron ? `Schedule - ${t.cron}` : 'Schedule';
    case 'business_connection':
      return 'Business connection';
    default:
      return t?.kind || 'Unknown';
  }
}

function statusVariant(s: string): 'default' | 'secondary' | 'danger' | 'outline' {
  if (s === 'published') return 'default';
  if (s === 'disabled') return 'danger';
  return 'secondary';
}

function relativeTime(iso?: string): string {
  if (!iso) return '-';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '-';
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* -- page -------------------------------------------------------------- */

export default function TelegramFlowsPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const { toast } = useToast();

  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, startLoading] = useTransition();
  const [isMutating, startMutating] = useTransition();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FlowStatus | ''>('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!activeProjectId) return;
    startLoading(async () => {
      const res = await listTelegramFlows({
        projectId: activeProjectId,
        status: statusFilter || undefined,
        search: search || undefined,
        page: 1,
        limit: 100,
      });
      if (res.error) {
        toast({
          title: 'Could not load flows',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      setFlows(res.flows);
      setTotal(res.total);
    });
  }, [activeProjectId, search, statusFilter, toast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const kpis = useMemo(() => {
    const published = flows.filter((f) => f.status === 'published').length;
    const runs = flows.reduce((acc, f) => acc + (f.runCount || 0), 0);
    const errors = flows.reduce((acc, f) => acc + (f.errorCount || 0), 0);
    const errorRate = runs > 0 ? Math.round((errors / runs) * 1000) / 10 : 0;
    return { total, published, runs, errorRate };
  }, [flows, total]);

  const handleCreate = () => {
    if (!activeProjectId) {
      toast({
        title: 'No project selected',
        description: 'Pick an active project before creating a flow.',
        tone: 'danger',
      });
      return;
    }
    startMutating(async () => {
      const res = await createTelegramFlow({
        projectId: activeProjectId,
        name: 'Untitled flow',
        trigger: { kind: 'incoming_message' },
        nodes: [],
        edges: [],
      });
      if (!res.success || !res.flowId) {
        toast({
          title: 'Could not create flow',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      toast({ title: 'Draft created', description: 'Opening editor.', tone: 'success' });
      router.push(`/dashboard/telegram/flows/${res.flowId}`);
    });
  };

  const mutate = (
    op: () => Promise<{ success: boolean; error?: string; message?: string }>,
    successMessage: string,
  ) => {
    startMutating(async () => {
      const res = await op();
      if (!res.success) {
        toast({
          title: 'Action failed',
          description: res.error,
          tone: 'danger',
        });
        return;
      }
      toast({ title: successMessage, tone: 'success' });
      reload();
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <TelegramProjectGate />
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Telegram</PageEyebrow>
          <PageTitle className="flex items-center gap-2">
            <Workflow className="h-6 w-6" aria-hidden="true" /> Telegram Flows
          </PageTitle>
          <PageDescription>
            Visual flows triggered by Telegram messages, commands, callbacks, and schedules.
            Drafts are private; publishing rolls a new version that the bot runs against
            real updates.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={isMutating}
            iconLeft={Plus}
            disabled={!activeProjectId}
          >
            New flow
          </Button>
        </PageActions>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total flows" value={kpis.total.toLocaleString()} />
        <StatCard
          label="Published"
          value={kpis.published.toLocaleString()}
          icon={CheckCircle2}
          accent={ACCENT}
        />
        <StatCard label="Total runs" value={kpis.runs.toLocaleString()} />
        <StatCard
          label="Error rate"
          value={`${kpis.errorRate}%`}
          icon={AlertCircle}
        />
      </div>

      {/* Filter bar */}
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            iconLeft={Search}
            placeholder="Search flows by name"
            aria-label="Search flows by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter || 'all'}
          onValueChange={(v) => setStatusFilter(v === 'all' ? '' : (v as FlowStatus))}
        >
          <SelectTrigger className="w-full md:w-56" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 text-sm text-[var(--st-text-secondary)]">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> Loading flows.
          </div>
        ) : flows.length === 0 ? (
          <EmptyState
            icon={Workflow}
            tone="info"
            title="No flows yet"
            description="Create your first Telegram flow to automate replies, branching, and external API calls."
            action={
              <Button variant="primary" onClick={handleCreate} iconLeft={Plus} disabled={!activeProjectId}>
                New flow
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Name</Th>
                <Th>Status</Th>
                <Th>Version</Th>
                <Th>Trigger</Th>
                <Th align="right">Runs (7d)</Th>
                <Th align="right">Errors (7d)</Th>
                <Th>Last run</Th>
                <Th aria-label="Actions" />
              </Tr>
            </THead>
            <TBody>
              {flows.map((f) => (
                <Tr key={f._id}>
                  <Td>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/telegram/flows/${f._id}`)}
                      className="h-auto px-0 font-medium hover:underline"
                    >
                      {f.name || 'Untitled flow'}
                    </Button>
                    {f.description ? (
                      <div className="text-xs text-[var(--st-text-secondary)]">{f.description}</div>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                  </Td>
                  <Td>
                    v{f.version}
                    {f.latestPublishedVersion > 0 ? (
                      <span className="ml-1 text-xs text-[var(--st-text-secondary)]">
                        (pub v{f.latestPublishedVersion})
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-sm">{describeTrigger(f.trigger)}</Td>
                  <Td align="right" className="tabular-nums">{f.runCount}</Td>
                  <Td align="right" className="tabular-nums">{f.errorCount}</Td>
                  <Td className="text-sm text-[var(--st-text-secondary)]">
                    {relativeTime(f.lastRunAt)}
                  </Td>
                  <Td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Flow actions" className="px-2">
                          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => router.push(`/dashboard/telegram/flows/${f._id}`)}
                        >
                          Open editor
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            mutate(
                              () => duplicateTelegramFlow(f._id, activeProjectId!),
                              'Flow duplicated',
                            )
                          }
                          disabled={!activeProjectId}
                        >
                          <Copy className="mr-2 h-4 w-4" aria-hidden="true" /> Duplicate
                        </DropdownMenuItem>
                        {f.status === 'published' ? (
                          <DropdownMenuItem
                            onClick={() =>
                              mutate(
                                () => disableTelegramFlow(f._id, activeProjectId!),
                                'Flow disabled',
                              )
                            }
                            disabled={!activeProjectId}
                          >
                            <Pause className="mr-2 h-4 w-4" aria-hidden="true" /> Disable
                          </DropdownMenuItem>
                        ) : f.status === 'disabled' ? (
                          <DropdownMenuItem
                            onClick={() =>
                              mutate(
                                () => enableTelegramFlow(f._id, activeProjectId!),
                                'Flow enabled',
                              )
                            }
                            disabled={!activeProjectId}
                          >
                            <Play className="mr-2 h-4 w-4" aria-hidden="true" /> Enable
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() =>
                              mutate(
                                () => publishTelegramFlow(f._id, activeProjectId!),
                                'Flow published',
                              )
                            }
                            disabled={!activeProjectId}
                          >
                            <Play className="mr-2 h-4 w-4" aria-hidden="true" /> Publish
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-[var(--st-danger)] focus:text-[var(--st-danger)]"
                          onClick={() => setConfirmDeleteId(f._id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this flow?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the flow, its versions, and its run history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDeleteId || !activeProjectId) return;
                const id = confirmDeleteId;
                setConfirmDeleteId(null);
                mutate(() => deleteTelegramFlow(id, activeProjectId), 'Flow deleted');
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageEyebrow,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
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
import type { FlowRow,
  FlowStatus } from '@/lib/rust-client/telegram-flows';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';

/**
 * /dashboard/telegram/flows — list of Telegram-scoped visual flows.
 *
 * Mirrors the SabFlow visual editor concept but scoped to Telegram triggers
 * (incoming_message, command, callback_query, schedule, business_connection).
 * Backed by the `telegram-flows` Rust crate via the server actions in
 * `@/app/actions/telegram-flows.actions`.
 */

const ACCENT = '#229ED9';

/* ── trigger summary helper ────────────────────────────────────────────── */

function describeTrigger(t: FlowRow['trigger']): string {
  switch (t?.kind) {
    case 'incoming_message':
      return t.filter?.value ? `Incoming · ${t.filter.value}` : 'Incoming message';
    case 'command':
      return t.command ? `/${t.command}` : 'Command';
    case 'callback_query':
      return t.dataPrefix ? `Callback · ${t.dataPrefix}` : 'Callback';
    case 'schedule':
      return t.cron ? `Schedule · ${t.cron}` : 'Schedule';
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
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
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

/* ── page ──────────────────────────────────────────────────────────────── */

export default function TelegramFlowsPage() {
  const router = useRouter();
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();

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
          variant: 'destructive',
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
        variant: 'destructive',
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
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Draft created', description: 'Opening editor…' });
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
          variant: 'destructive',
        });
        return;
      }
      toast({ title: successMessage });
      reload();
    });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
        <TelegramProjectGate />
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageEyebrow>Telegram</ZoruPageEyebrow>
          <ZoruPageTitle style={{ color: ACCENT }} className="flex items-center gap-2">
            <Workflow className="h-6 w-6" /> Telegram Flows
          </ZoruPageTitle>
          <ZoruPageDescription>
            Visual flows triggered by Telegram messages, commands, callbacks, and schedules.
            Drafts are private; publishing rolls a new version that the bot runs against
            real updates.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Button onClick={handleCreate} disabled={isMutating || !activeProjectId}>
            {isMutating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New flow
          </Button>
        </ZoruPageActions>
      </PageHeader>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total flows" value={kpis.total.toLocaleString()} />
        <StatCard
          label="Published"
          value={kpis.published.toLocaleString()}
          icon={<CheckCircle2 className="h-4 w-4" style={{ color: ACCENT }} />}
        />
        <StatCard label="Total runs" value={kpis.runs.toLocaleString()} />
        <StatCard
          label="Error rate"
          value={`${kpis.errorRate}%`}
          invertDelta
          icon={<AlertCircle className="h-4 w-4 text-[var(--st-text)]" />}
        />
      </div>

      {/* Filter bar */}
      <Card className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            placeholder="Search flows by name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter || 'all'}
          onValueChange={(v) => setStatusFilter(v === 'all' ? '' : (v as FlowStatus))}
        >
          <ZoruSelectTrigger className="w-full md:w-56">
            <ZoruSelectValue placeholder="All statuses" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
            <ZoruSelectItem value="published">Published</ZoruSelectItem>
            <ZoruSelectItem value="disabled">Disabled</ZoruSelectItem>
          </ZoruSelectContent>
        </Select>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-10 text-sm text-[var(--st-text-secondary)]">
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Loading flows…
          </div>
        ) : flows.length === 0 ? (
          <EmptyState
            icon={<Workflow className="h-8 w-8" style={{ color: ACCENT }} />}
            title="No flows yet"
            description="Create your first Telegram flow to automate replies, branching, and external API calls."
            action={
              <Button onClick={handleCreate} disabled={!activeProjectId}>
                <Plus className="h-4 w-4" /> New flow
              </Button>
            }
          />
        ) : (
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Version</ZoruTableHead>
                <ZoruTableHead>Trigger</ZoruTableHead>
                <ZoruTableHead className="text-right">Runs (7d)</ZoruTableHead>
                <ZoruTableHead className="text-right">Errors (7d)</ZoruTableHead>
                <ZoruTableHead>Last run</ZoruTableHead>
                <ZoruTableHead aria-label="Actions" />
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {flows.map((f) => (
                <ZoruTableRow key={f._id}>
                  <ZoruTableCell>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/telegram/flows/${f._id}`)}
                      className="text-left font-medium hover:underline"
                    >
                      {f.name || 'Untitled flow'}
                    </button>
                    {f.description ? (
                      <div className="text-xs text-[var(--st-text-secondary)]">{f.description}</div>
                    ) : null}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    v{f.version}
                    {f.latestPublishedVersion > 0 ? (
                      <span className="ml-1 text-xs text-[var(--st-text-secondary)]">
                        (pub v{f.latestPublishedVersion})
                      </span>
                    ) : null}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-sm">{describeTrigger(f.trigger)}</ZoruTableCell>
                  <ZoruTableCell className="text-right tabular-nums">{f.runCount}</ZoruTableCell>
                  <ZoruTableCell className="text-right tabular-nums">{f.errorCount}</ZoruTableCell>
                  <ZoruTableCell className="text-sm text-[var(--st-text-secondary)]">
                    {relativeTime(f.lastRunAt)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <DropdownMenu>
                      <ZoruDropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="Actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </ZoruDropdownMenuTrigger>
                      <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem
                          onClick={() => router.push(`/dashboard/telegram/flows/${f._id}`)}
                        >
                          Open editor
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                          onClick={() =>
                            mutate(
                              () => duplicateTelegramFlow(f._id, activeProjectId!),
                              'Flow duplicated',
                            )
                          }
                          disabled={!activeProjectId}
                        >
                          <Copy className="mr-2 h-4 w-4" /> Duplicate
                        </ZoruDropdownMenuItem>
                        {f.status === 'published' ? (
                          <ZoruDropdownMenuItem
                            onClick={() =>
                              mutate(
                                () => disableTelegramFlow(f._id, activeProjectId!),
                                'Flow disabled',
                              )
                            }
                            disabled={!activeProjectId}
                          >
                            <Pause className="mr-2 h-4 w-4" /> Disable
                          </ZoruDropdownMenuItem>
                        ) : f.status === 'disabled' ? (
                          <ZoruDropdownMenuItem
                            onClick={() =>
                              mutate(
                                () => enableTelegramFlow(f._id, activeProjectId!),
                                'Flow enabled',
                              )
                            }
                            disabled={!activeProjectId}
                          >
                            <Play className="mr-2 h-4 w-4" /> Enable
                          </ZoruDropdownMenuItem>
                        ) : (
                          <ZoruDropdownMenuItem
                            onClick={() =>
                              mutate(
                                () => publishTelegramFlow(f._id, activeProjectId!),
                                'Flow published',
                              )
                            }
                            disabled={!activeProjectId}
                          >
                            <Play className="mr-2 h-4 w-4" /> Publish
                          </ZoruDropdownMenuItem>
                        )}
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem
                          className="text-[var(--st-text)] focus:text-[var(--st-text)]"
                          onClick={() => setConfirmDeleteId(f._id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </ZoruDropdownMenuItem>
                      </ZoruDropdownMenuContent>
                    </DropdownMenu>
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        )}
      </Card>

      <ZoruAlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this flow?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the flow, its versions, and its run history.
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => {
                if (!confirmDeleteId || !activeProjectId) return;
                const id = confirmDeleteId;
                setConfirmDeleteId(null);
                mutate(() => deleteTelegramFlow(id, activeProjectId), 'Flow deleted');
              }}
            >
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}

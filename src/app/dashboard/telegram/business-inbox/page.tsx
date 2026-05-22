'use client';

import {
  Avatar,
  ZoruAvatarFallback,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDrawer,
  ZoruDrawerContent,
  ZoruDrawerDescription,
  ZoruDrawerHeader,
  ZoruDrawerTitle,
  EmptyState,
  Input,
  ScrollArea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Skeleton,
  Textarea,
  Tooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  AlarmClock,
  AlertTriangle,
  Check,
  CheckCheck,
  CircleDot,
  Clock,
  GripVertical,
  Inbox,
  ListChecks,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  StickyNote,
  Tag,
  Trash2,
  UserCircle2,
  X,
  } from 'lucide-react';

import * as React from 'react';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    analyticsAction,
    assignThreadAction,
    bulkThreadsAction,
    createAutoAssignAction,
    createNoteAction,
    createSlaAction,
    deleteAutoAssignAction,
    deleteNoteAction,
    deleteSlaAction,
    getThreadAction,
    listAgentsAction,
    listAutoAssignAction,
    listMessagesAction,
    listNotesAction,
    listSlaAction,
    listThreadsAction,
    markThreadReadAction,
    sendMessageAction,
    setThreadPriorityAction,
    setThreadStatusAction,
    setThreadTagsAction,
    slaEvalAction,
    updateAutoAssignAction,
    updateSlaAction,
} from '@/app/actions/telegram-business-inbox.actions';
import type {
    AgentRow,
    AnalyticsResp,
    AutoAssignRule,
    InboxMessage,
    InboxNote,
    InboxThread,
    ListThreadsResp,
    SlaPolicy,
    ThreadPriority,
    ThreadStatus,
} from '@/lib/rust-client/telegram-business-inbox';

const ACCENT = '#229ED9';
const POLL_MS = 5000;

const STATUS_FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'pending', label: 'Pending' },
    { value: 'snoozed', label: 'Snoozed' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'archived', label: 'Archived' },
    { value: 'all', label: 'All' },
] as const;

const PRIORITY_OPTIONS: ThreadPriority[] = ['low', 'normal', 'high', 'urgent'];

const PRIORITY_TONE: Record<ThreadPriority, 'ghost' | 'secondary' | 'warning' | 'danger'> = {
    low: 'ghost',
    normal: 'secondary',
    high: 'warning',
    urgent: 'danger',
};

// =========================================================================
// Helpers
// =========================================================================

function initials(s: string): string {
    return s
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('') || '?';
}

function fmtRelative(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso).getTime();
    if (Number.isNaN(d)) return '';
    const diff = Date.now() - d;
    const s = Math.round(diff / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.round(h / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString();
}

function fmtSlaCountdown(iso?: string, breached?: boolean): { text: string; tone: 'warning' | 'danger' | 'success' } | null {
    if (!iso) return null;
    const due = new Date(iso).getTime();
    if (Number.isNaN(due)) return null;
    const diff = due - Date.now();
    if (diff < 0 || breached) {
        return { text: `SLA breached ${fmtRelative(iso)} ago`, tone: 'danger' };
    }
    const mins = Math.round(diff / 60000);
    if (mins < 60) return { text: `SLA in ${mins}m`, tone: 'warning' };
    const hrs = Math.round(mins / 60);
    return { text: `SLA in ${hrs}h`, tone: 'success' };
}

function fmtSeconds(secs: number): string {
    if (!secs) return '—';
    if (secs < 60) return `${secs}s`;
    const mins = Math.round(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.round(hrs / 24)}d`;
}

// =========================================================================
// Page
// =========================================================================

export default function Page() {
    const { activeProject, sessionUser } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useZoruToast();

    // ------ Filter state ------
    const [statusFilter, setStatusFilter] = React.useState<typeof STATUS_FILTERS[number]['value']>('open');
    const [assignedFilter, setAssignedFilter] = React.useState<string>('anyone');
    const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
    const [tagFilter, setTagFilter] = React.useState<string>('');
    const [search, setSearch] = React.useState<string>('');
    const [hasUnread, setHasUnread] = React.useState<boolean>(false);

    // ------ Data ------
    const [threadsState, setThreadsState] = React.useState<ListThreadsResp>({
        threads: [],
        total: 0,
        hasMore: false,
        page: 1,
        pageSize: 30,
        openCount: 0,
        pendingCount: 0,
        snoozedCount: 0,
        resolvedCount: 0,
        breachedCount: 0,
    });
    const [isLoadingThreads, setIsLoadingThreads] = React.useState(false);
    const [selectedId, setSelectedId] = React.useState<string | null>(null);
    const [thread, setThread] = React.useState<InboxThread | null>(null);
    const [relatedThreads, setRelatedThreads] = React.useState<InboxThread[]>([]);
    const [messages, setMessages] = React.useState<InboxMessage[]>([]);
    const [notes, setNotes] = React.useState<InboxNote[]>([]);
    const [agents, setAgents] = React.useState<AgentRow[]>([]);
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);

    // ------ Compose ------
    const [composer, setComposer] = React.useState('');
    const [isSending, setIsSending] = React.useState(false);
    const [noteDraft, setNoteDraft] = React.useState('');
    const [isAddingNote, setIsAddingNote] = React.useState(false);

    // ------ Bulk-select ------
    const [bulkMode, setBulkMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

    // ------ Drawers ------
    const [rulesOpen, setRulesOpen] = React.useState(false);
    const [slaOpen, setSlaOpen] = React.useState(false);
    const [resolveOpen, setResolveOpen] = React.useState(false);

    // ------ Refresh tick ------
    const [refreshTick, setRefreshTick] = React.useState(0);

    // Reload threads when filters change.
    React.useEffect(() => {
        if (!projectId) return;
        let cancelled = false;
        setIsLoadingThreads(true);
        listThreadsAction({
            projectId,
            status: statusFilter,
            assignedAgentId:
                assignedFilter === 'me' && sessionUser?._id
                    ? String(sessionUser._id)
                    : assignedFilter,
            priority: priorityFilter as ThreadPriority | 'all',
            tag: tagFilter || undefined,
            search: search || undefined,
            hasUnread: hasUnread || undefined,
            page: 1,
            pageSize: 50,
        })
            .then((res) => {
                if (cancelled) return;
                setThreadsState(res);
                if (res.error) toast({ title: 'Failed to load threads', description: res.error, variant: 'destructive' });
            })
            .finally(() => {
                if (!cancelled) setIsLoadingThreads(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId, statusFilter, assignedFilter, priorityFilter, tagFilter, search, hasUnread, refreshTick, sessionUser?._id, toast]);

    // Poll every 5s while visible.
    React.useEffect(() => {
        if (!projectId) return;
        const onVis = () => {
            if (document.visibilityState === 'visible') setRefreshTick((t) => t + 1);
        };
        document.addEventListener('visibilitychange', onVis);
        const iv = setInterval(() => {
            if (document.visibilityState === 'visible') setRefreshTick((t) => t + 1);
        }, POLL_MS);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            clearInterval(iv);
        };
    }, [projectId]);

    // Load agents + analytics + sla once per project.
    React.useEffect(() => {
        if (!projectId) return;
        listAgentsAction(projectId).then((r) => setAgents(r.agents || []));
        analyticsAction({ projectId }).then(setAnalytics);
    }, [projectId, refreshTick]);

    // Load selected thread detail.
    React.useEffect(() => {
        if (!projectId || !selectedId) {
            setThread(null);
            setRelatedThreads([]);
            setMessages([]);
            setNotes([]);
            return;
        }
        let cancelled = false;
        Promise.all([
            getThreadAction(selectedId, projectId),
            listMessagesAction(selectedId, projectId, { limit: 50 }),
            listNotesAction(selectedId, projectId, { limit: 50 }),
        ]).then(([detail, msgs, ns]) => {
            if (cancelled) return;
            setThread(detail.thread ?? null);
            setRelatedThreads(detail.relatedThreads ?? []);
            setMessages(msgs.messages ?? []);
            setNotes(ns.notes ?? []);
            // Auto-mark read.
            if (detail.thread && detail.thread.unreadCount > 0) {
                markThreadReadAction(selectedId, projectId).catch(() => {});
            }
        });
        return () => {
            cancelled = true;
        };
    }, [projectId, selectedId, refreshTick]);

    // ---------- mutations ----------
    const refresh = React.useCallback(() => setRefreshTick((t) => t + 1), []);

    const onAssign = async (agentId: string | null) => {
        if (!projectId || !selectedId) return;
        const res = await assignThreadAction(selectedId, projectId, agentId);
        toast({
            title: res.success ? 'Assignment updated.' : 'Failed',
            description: res.success ? res.message : res.error,
            variant: res.success ? 'default' : 'destructive',
        });
        if (res.success) refresh();
    };

    const onStatus = async (status: ThreadStatus, snoozedUntil?: string) => {
        if (!projectId || !selectedId) return;
        const res = await setThreadStatusAction(selectedId, projectId, status, snoozedUntil);
        toast({
            title: res.success ? `Status set to ${status}.` : 'Failed',
            description: res.success ? res.message : res.error,
            variant: res.success ? 'default' : 'destructive',
        });
        if (res.success) refresh();
    };

    const onPriority = async (priority: ThreadPriority) => {
        if (!projectId || !selectedId) return;
        const res = await setThreadPriorityAction(selectedId, projectId, priority);
        toast({
            title: res.success ? 'Priority updated.' : 'Failed',
            description: res.success ? res.message : res.error,
            variant: res.success ? 'default' : 'destructive',
        });
        if (res.success) refresh();
    };

    const onAddTag = async (tag: string) => {
        if (!projectId || !selectedId || !tag.trim()) return;
        const res = await setThreadTagsAction(selectedId, projectId, [tag.trim()]);
        if (res.success) refresh();
    };

    const onRemoveTag = async (tag: string) => {
        if (!projectId || !selectedId) return;
        const res = await setThreadTagsAction(selectedId, projectId, undefined, [tag]);
        if (res.success) refresh();
    };

    const onSend = async () => {
        if (!projectId || !selectedId || !thread || !composer.trim()) return;
        setIsSending(true);
        const res = await sendMessageAction(thread.botId, thread.chatId, composer.trim());
        setIsSending(false);
        if (res.success) {
            setComposer('');
            refresh();
        } else {
            toast({ title: 'Failed to send', description: res.error, variant: 'destructive' });
        }
    };

    const onAddNote = async () => {
        if (!projectId || !selectedId || !noteDraft.trim()) return;
        setIsAddingNote(true);
        const mentions = Array.from(noteDraft.matchAll(/@([\w-]+)/g)).map((m) => m[1]);
        const res = await createNoteAction(selectedId, projectId, noteDraft.trim(), mentions);
        setIsAddingNote(false);
        if (res.success) {
            setNoteDraft('');
            refresh();
        } else {
            toast({ title: 'Failed to add note', description: res.error, variant: 'destructive' });
        }
    };

    const onDeleteNote = async (noteId: string) => {
        if (!projectId || !selectedId) return;
        const res = await deleteNoteAction(selectedId, noteId, projectId);
        if (res.success) refresh();
        else toast({ title: 'Failed', description: res.error, variant: 'destructive' });
    };

    // ---------- Bulk ----------
    const allSelected =
        threadsState.threads.length > 0 &&
        threadsState.threads.every((t) => selectedIds.has(t._id));
    const toggleAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(threadsState.threads.map((t) => t._id)));
    };
    const toggleOne = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const onBulkAction = async (action: 'status' | 'assign' | 'priority' | 'tag', payload: Record<string, unknown>) => {
        if (!projectId || selectedIds.size === 0) return;
        const res = await bulkThreadsAction({
            projectId,
            ids: Array.from(selectedIds),
            action,
            payload,
        });
        toast({
            title: res.success ? `Updated ${('updated' in res ? res.updated : 0)} threads.` : 'Failed',
            description: res.success ? undefined : res.error,
            variant: res.success ? 'default' : 'destructive',
        });
        if (res.success) {
            setSelectedIds(new Set());
            setBulkMode(false);
            refresh();
        }
    };

    // =========================================================================
    // Render
    // =========================================================================

    if (!projectId) {
        return (
            <div className="p-6">
                <ZoruEmptyState
                    icon={<Inbox />}
                    title="Select a project"
                    description="Choose an active project to view its Telegram business inbox."
                />
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
            <TelegramProjectGate />
            {/* Analytics summary bar */}
            <AnalyticsBar
                analytics={analytics}
                openCount={threadsState.openCount}
                breachedCount={threadsState.breachedCount}
                onOpenRules={() => setRulesOpen(true)}
                onOpenSla={() => setSlaOpen(true)}
                onEvalSla={async () => {
                    const res = await slaEvalAction(projectId);
                    toast({
                        title: res.success
                            ? `Evaluated ${'evaluated' in res ? res.evaluated : 0}, ${'breached' in res ? res.breached : 0} breached.`
                            : 'Failed',
                        description: res.success ? undefined : res.error,
                        variant: res.success ? 'default' : 'destructive',
                    });
                    refresh();
                }}
            />

            <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* LEFT pane */}
                <div className="flex w-[300px] flex-shrink-0 flex-col border-r">
                    <ThreadListHeader
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        assignedFilter={assignedFilter}
                        setAssignedFilter={setAssignedFilter}
                        priorityFilter={priorityFilter}
                        setPriorityFilter={setPriorityFilter}
                        agents={agents}
                        search={search}
                        setSearch={setSearch}
                        hasUnread={hasUnread}
                        setHasUnread={setHasUnread}
                        tagFilter={tagFilter}
                        setTagFilter={setTagFilter}
                        sessionUserId={sessionUser?._id ? String(sessionUser._id) : null}
                        bulkMode={bulkMode}
                        setBulkMode={setBulkMode}
                        selectedCount={selectedIds.size}
                        allSelected={allSelected}
                        toggleAll={toggleAll}
                        onBulkAction={onBulkAction}
                        counts={{
                            open: threadsState.openCount,
                            pending: threadsState.pendingCount,
                            snoozed: threadsState.snoozedCount,
                            resolved: threadsState.resolvedCount,
                        }}
                    />
                    <ThreadList
                        threads={threadsState.threads}
                        isLoading={isLoadingThreads}
                        selectedId={selectedId}
                        onSelect={(id) => {
                            if (bulkMode) toggleOne(id);
                            else setSelectedId(id);
                        }}
                        bulkMode={bulkMode}
                        selectedIds={selectedIds}
                        agents={agents}
                    />
                </div>

                {/* CENTER pane */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {!thread ? (
                        <div className="flex h-full items-center justify-center p-8">
                            <ZoruEmptyState
                                icon={<MessageSquare />}
                                title="No conversation selected"
                                description="Pick a thread on the left to view its messages, assign agents, and write internal notes."
                            />
                        </div>
                    ) : (
                        <>
                            <ThreadHeader
                                thread={thread}
                                agents={agents}
                                onAssign={onAssign}
                                onStatus={onStatus}
                                onPriority={onPriority}
                                onResolve={() => setResolveOpen(true)}
                            />
                            <MessageList messages={messages} />
                            <Composer
                                value={composer}
                                onChange={setComposer}
                                onSend={onSend}
                                disabled={!thread || isSending || thread.status === 'archived'}
                                isSending={isSending}
                            />
                        </>
                    )}
                </div>

                {/* RIGHT pane */}
                <div className="flex w-[320px] flex-shrink-0 flex-col border-l">
                    {thread ? (
                        <RightPane
                            thread={thread}
                            relatedThreads={relatedThreads}
                            notes={notes}
                            noteDraft={noteDraft}
                            setNoteDraft={setNoteDraft}
                            onAddNote={onAddNote}
                            onDeleteNote={onDeleteNote}
                            isAddingNote={isAddingNote}
                            onAddTag={onAddTag}
                            onRemoveTag={onRemoveTag}
                            agents={agents}
                            onJumpTo={setSelectedId}
                        />
                    ) : (
                        <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                            Customer info appears here.
                        </div>
                    )}
                </div>
            </div>

            {/* Auto-assign rules drawer */}
            <RulesDrawer
                open={rulesOpen}
                onClose={() => setRulesOpen(false)}
                projectId={projectId}
                agents={agents}
                refresh={refresh}
            />

            {/* SLA policies drawer */}
            <SlaDrawer
                open={slaOpen}
                onClose={() => setSlaOpen(false)}
                projectId={projectId}
                refresh={refresh}
            />

            {/* Resolve confirm */}
            <ZoruDialog open={resolveOpen} onOpenChange={setResolveOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Resolve thread?</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            This marks the conversation as resolved. It will re-open
                            automatically if the customer sends a new message.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <ZoruButton variant="ghost" onClick={() => setResolveOpen(false)}>
                            Cancel
                        </ZoruButton>
                        <ZoruButton
                            onClick={async () => {
                                setResolveOpen(false);
                                await onStatus('resolved');
                            }}
                        >
                            <Check className="mr-1 h-4 w-4" /> Resolve
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </div>
    );
}

// =========================================================================
// Analytics summary
// =========================================================================

function AnalyticsBar({
    analytics,
    openCount,
    breachedCount,
    onOpenRules,
    onOpenSla,
    onEvalSla,
}: {
    analytics: AnalyticsResp | null;
    openCount: number;
    breachedCount: number;
    onOpenRules: () => void;
    onOpenSla: () => void;
    onEvalSla: () => void;
}) {
    return (
        <div className="flex flex-shrink-0 items-center gap-6 border-b bg-card px-4 py-3">
            <div className="flex items-center gap-2">
                <Inbox className="h-5 w-5" style={{ color: ACCENT }} />
                <h1 className="text-base font-semibold">Telegram Business Inbox</h1>
            </div>
            <ZoruSeparator orientation="vertical" className="h-6" />
            <Stat label="Open" value={openCount} icon={CircleDot} />
            <Stat label="Breached" value={breachedCount} icon={AlertTriangle} tone="destructive" />
            <Stat
                label="Avg first response"
                value={fmtSeconds(analytics?.avgFirstResponseSeconds ?? 0)}
                icon={Clock}
            />
            <Stat
                label="Avg resolution"
                value={fmtSeconds(analytics?.avgResolutionSeconds ?? 0)}
                icon={CheckCheck}
            />
            <div className="ml-auto flex items-center gap-2">
                <ZoruButton variant="ghost" size="sm" onClick={onEvalSla}>
                    <AlarmClock className="mr-1 h-4 w-4" /> Re-evaluate SLA
                </ZoruButton>
                <ZoruButton variant="ghost" size="sm" onClick={onOpenRules}>
                    <ListChecks className="mr-1 h-4 w-4" /> Auto-assign
                </ZoruButton>
                <ZoruButton variant="ghost" size="sm" onClick={onOpenSla}>
                    <Settings className="mr-1 h-4 w-4" /> SLA
                </ZoruButton>
            </div>
        </div>
    );
}

function Stat({
    label,
    value,
    icon: Icon,
    tone,
}: {
    label: string;
    value: React.ReactNode;
    icon: React.ComponentType<{ className?: string }>;
    tone?: 'destructive';
}) {
    return (
        <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div className="leading-tight">
                <div className={`text-sm font-medium ${tone === 'destructive' ? 'text-destructive' : ''}`}>{value}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            </div>
        </div>
    );
}

// =========================================================================
// Left pane
// =========================================================================

function ThreadListHeader(props: {
    statusFilter: typeof STATUS_FILTERS[number]['value'];
    setStatusFilter: (v: typeof STATUS_FILTERS[number]['value']) => void;
    assignedFilter: string;
    setAssignedFilter: (v: string) => void;
    priorityFilter: string;
    setPriorityFilter: (v: string) => void;
    agents: AgentRow[];
    search: string;
    setSearch: (v: string) => void;
    hasUnread: boolean;
    setHasUnread: (v: boolean) => void;
    tagFilter: string;
    setTagFilter: (v: string) => void;
    sessionUserId: string | null;
    bulkMode: boolean;
    setBulkMode: (v: boolean) => void;
    selectedCount: number;
    allSelected: boolean;
    toggleAll: () => void;
    onBulkAction: (
        action: 'status' | 'assign' | 'priority' | 'tag',
        payload: Record<string, unknown>,
    ) => Promise<void>;
    counts: { open: number; pending: number; snoozed: number; resolved: number };
}) {
    const {
        statusFilter,
        setStatusFilter,
        assignedFilter,
        setAssignedFilter,
        priorityFilter,
        setPriorityFilter,
        agents,
        search,
        setSearch,
        hasUnread,
        setHasUnread,
        tagFilter,
        setTagFilter,
        sessionUserId,
        bulkMode,
        setBulkMode,
        selectedCount,
        allSelected,
        toggleAll,
        onBulkAction,
        counts,
    } = props;

    return (
        <div className="flex-shrink-0 space-y-2 border-b p-3">
            <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <ZoruInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search threads…"
                    className="h-8 flex-1"
                />
                <ZoruTooltipProvider>
                    <ZoruTooltip>
                        <ZoruTooltipTrigger asChild>
                            <ZoruButton
                                size="icon"
                                variant={bulkMode ? 'default' : 'ghost'}
                                onClick={() => setBulkMode(!bulkMode)}
                                className="h-8 w-8"
                                aria-label="Bulk select"
                            >
                                <ListChecks className="h-4 w-4" />
                            </ZoruButton>
                        </ZoruTooltipTrigger>
                        <ZoruTooltipContent>Bulk select</ZoruTooltipContent>
                    </ZoruTooltip>
                </ZoruTooltipProvider>
            </div>

            <div className="grid grid-cols-5 gap-1 text-xs">
                {STATUS_FILTERS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatusFilter(opt.value)}
                        className={`flex flex-col items-center rounded-md px-1 py-1 transition ${
                            statusFilter === opt.value
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'text-muted-foreground hover:bg-accent'
                        }`}
                    >
                        <span className="truncate">{opt.label}</span>
                        {opt.value === 'open' && <span className="text-[10px]">{counts.open}</span>}
                        {opt.value === 'pending' && <span className="text-[10px]">{counts.pending}</span>}
                        {opt.value === 'snoozed' && <span className="text-[10px]">{counts.snoozed}</span>}
                        {opt.value === 'resolved' && <span className="text-[10px]">{counts.resolved}</span>}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                <ZoruSelect value={assignedFilter} onValueChange={setAssignedFilter}>
                    <ZoruSelectTrigger className="h-8 flex-1">
                        <ZoruSelectValue placeholder="Assignee" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="anyone">Anyone</ZoruSelectItem>
                        {sessionUserId && <ZoruSelectItem value="me">Assigned to me</ZoruSelectItem>}
                        <ZoruSelectItem value="unassigned">Unassigned</ZoruSelectItem>
                        {agents.map((a) => (
                            <ZoruSelectItem key={a._id} value={a._id}>
                                {a.name} ({a.openCount})
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>

                <ZoruSelect value={priorityFilter} onValueChange={setPriorityFilter}>
                    <ZoruSelectTrigger className="h-8 flex-1">
                        <ZoruSelectValue placeholder="Priority" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">Any priority</ZoruSelectItem>
                        {PRIORITY_OPTIONS.map((p) => (
                            <ZoruSelectItem key={p} value={p}>
                                {p}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>

            <div className="flex items-center gap-2">
                <ZoruInput
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="Filter by tag…"
                    className="h-8"
                />
                <label className="flex flex-shrink-0 cursor-pointer items-center gap-1 text-xs">
                    <ZoruCheckbox checked={hasUnread} onCheckedChange={(v) => setHasUnread(Boolean(v))} />
                    Unread
                </label>
            </div>

            {bulkMode && (
                <div className="rounded-md border bg-accent/40 p-2">
                    <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{selectedCount} selected</span>
                        <button onClick={toggleAll} className="text-primary hover:underline">
                            {allSelected ? 'Clear' : 'Select all'}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        <ZoruButton size="sm" variant="ghost" onClick={() => onBulkAction('status', { status: 'resolved' })}>
                            Resolve
                        </ZoruButton>
                        <ZoruButton size="sm" variant="ghost" onClick={() => onBulkAction('status', { status: 'open' })}>
                            Reopen
                        </ZoruButton>
                        <ZoruButton size="sm" variant="ghost" onClick={() => onBulkAction('priority', { priority: 'high' })}>
                            High prio
                        </ZoruButton>
                        <BulkTagButton onAdd={(t) => onBulkAction('tag', { add: [t] })} />
                        <BulkAssignButton agents={agents} onAssign={(id) => onBulkAction('assign', { agentId: id })} />
                    </div>
                </div>
            )}
        </div>
    );
}

function BulkTagButton({ onAdd }: { onAdd: (tag: string) => Promise<void> }) {
    const [open, setOpen] = React.useState(false);
    const [val, setVal] = React.useState('');
    return (
        <>
            <ZoruButton size="sm" variant="ghost" onClick={() => setOpen(true)}>
                <Tag className="mr-1 h-3 w-3" /> Tag
            </ZoruButton>
            <ZoruDialog open={open} onOpenChange={setOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Add tag</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <ZoruInput value={val} onChange={(e) => setVal(e.target.value)} placeholder="tag-name" />
                    <ZoruDialogFooter>
                        <ZoruButton variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
                        <ZoruButton
                            onClick={async () => {
                                await onAdd(val);
                                setOpen(false);
                                setVal('');
                            }}
                            disabled={!val.trim()}
                        >
                            Add
                        </ZoruButton>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </ZoruDialog>
        </>
    );
}

function BulkAssignButton({
    agents,
    onAssign,
}: {
    agents: AgentRow[];
    onAssign: (id: string | null) => Promise<void>;
}) {
    const [open, setOpen] = React.useState(false);
    return (
        <>
            <ZoruButton size="sm" variant="ghost" onClick={() => setOpen(true)}>
                <UserCircle2 className="mr-1 h-3 w-3" /> Assign
            </ZoruButton>
            <ZoruDialog open={open} onOpenChange={setOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Assign to agent</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="max-h-60 space-y-1 overflow-y-auto">
                        <button
                            onClick={async () => {
                                await onAssign(null);
                                setOpen(false);
                            }}
                            className="w-full rounded p-2 text-left text-sm hover:bg-accent"
                        >
                            Unassign
                        </button>
                        {agents.map((a) => (
                            <button
                                key={a._id}
                                onClick={async () => {
                                    await onAssign(a._id);
                                    setOpen(false);
                                }}
                                className="w-full rounded p-2 text-left text-sm hover:bg-accent"
                            >
                                {a.name}
                            </button>
                        ))}
                    </div>
                </ZoruDialogContent>
            </ZoruDialog>
        </>
    );
}

function ThreadList({
    threads,
    isLoading,
    selectedId,
    onSelect,
    bulkMode,
    selectedIds,
    agents,
}: {
    threads: InboxThread[];
    isLoading: boolean;
    selectedId: string | null;
    onSelect: (id: string) => void;
    bulkMode: boolean;
    selectedIds: Set<string>;
    agents: AgentRow[];
}) {
    if (isLoading && threads.length === 0) {
        return (
            <div className="space-y-2 p-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 p-2">
                        <ZoruSkeleton className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-1">
                            <ZoruSkeleton className="h-3 w-3/4" />
                            <ZoruSkeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }
    if (threads.length === 0) {
        return (
            <div className="p-6">
                <ZoruEmptyState icon={<Inbox />} title="No threads" description="No conversations match these filters yet." />
            </div>
        );
    }
    return (
        <ZoruScrollArea className="flex-1">
            <div className="divide-y">
                {threads.map((t) => {
                    const agent = t.assignedAgentId ? agents.find((a) => a._id === t.assignedAgentId) : null;
                    const sla = fmtSlaCountdown(t.slaDueAt, t.slaBreached);
                    const isSelected = selectedId === t._id;
                    return (
                        <button
                            key={t._id}
                            type="button"
                            onClick={() => onSelect(t._id)}
                            className={`flex w-full items-start gap-2 px-3 py-2.5 text-left transition ${
                                isSelected ? 'bg-primary/5' : 'hover:bg-accent/50'
                            }`}
                        >
                            {bulkMode && (
                                <div className="pt-1">
                                    <ZoruCheckbox checked={selectedIds.has(t._id)} />
                                </div>
                            )}
                            <ZoruAvatar className="h-10 w-10 flex-shrink-0">
                                <ZoruAvatarFallback>{initials(t.title)}</ZoruAvatarFallback>
                            </ZoruAvatar>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="truncate font-medium text-sm">{t.title}</div>
                                    <div className="flex-shrink-0 text-[10px] text-muted-foreground">
                                        {fmtRelative(t.lastInboundAt ?? t.updatedAt)}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="truncate text-xs text-muted-foreground">
                                        {t.lastMessageDirection === 'outbound' && '↳ '}
                                        {t.lastMessagePreview || '—'}
                                    </div>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1">
                                    {t.unreadCount > 0 && (
                                        <ZoruBadge variant="default" className="h-4 px-1 text-[10px]">
                                            {t.unreadCount}
                                        </ZoruBadge>
                                    )}
                                    {t.priority !== 'normal' && (
                                        <ZoruBadge variant={PRIORITY_TONE[t.priority]} className="h-4 px-1 text-[10px]">
                                            {t.priority}
                                        </ZoruBadge>
                                    )}
                                    {t.status !== 'open' && (
                                        <ZoruBadge variant="secondary" className="h-4 px-1 text-[10px]">
                                            {t.status}
                                        </ZoruBadge>
                                    )}
                                    {sla && (
                                        <ZoruBadge variant={sla.tone === 'danger' ? 'danger' : sla.tone === 'warning' ? 'warning' : 'secondary'} className="h-4 px-1 text-[10px]">
                                            {sla.text}
                                        </ZoruBadge>
                                    )}
                                    {agent && (
                                        <ZoruAvatar className="h-4 w-4">
                                            <ZoruAvatarFallback className="text-[8px]">
                                                {initials(agent.name)}
                                            </ZoruAvatarFallback>
                                        </ZoruAvatar>
                                    )}
                                    {t.tags.slice(0, 2).map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded bg-muted px-1 text-[10px] text-muted-foreground"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </ZoruScrollArea>
    );
}

// =========================================================================
// Center pane
// =========================================================================

function ThreadHeader({
    thread,
    agents,
    onAssign,
    onStatus,
    onPriority,
    onResolve,
}: {
    thread: InboxThread;
    agents: AgentRow[];
    onAssign: (id: string | null) => Promise<void>;
    onStatus: (s: ThreadStatus) => Promise<void>;
    onPriority: (p: ThreadPriority) => Promise<void>;
    onResolve: () => void;
}) {
    const sla = fmtSlaCountdown(thread.slaDueAt, thread.slaBreached);
    return (
        <div className="flex flex-shrink-0 items-center gap-3 border-b bg-card px-4 py-3">
            <ZoruAvatar className="h-10 w-10">
                <ZoruAvatarFallback>{initials(thread.title)}</ZoruAvatarFallback>
            </ZoruAvatar>
            <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{thread.title}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{thread.type}</span>
                    <span>·</span>
                    <span>Last activity {fmtRelative(thread.lastInboundAt ?? thread.updatedAt)}</span>
                    {sla && (
                        <ZoruBadge variant={sla.tone === 'danger' ? 'danger' : sla.tone === 'warning' ? 'warning' : 'secondary'} className="h-4 px-1 text-[10px]">
                            {sla.text}
                        </ZoruBadge>
                    )}
                </div>
            </div>
            <ZoruSelect
                value={thread.assignedAgentId ?? 'unassigned'}
                onValueChange={(v) => onAssign(v === 'unassigned' ? null : v)}
            >
                <ZoruSelectTrigger className="h-8 w-40">
                    <ZoruSelectValue placeholder="Assign" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="unassigned">Unassigned</ZoruSelectItem>
                    {agents.map((a) => (
                        <ZoruSelectItem key={a._id} value={a._id}>
                            {a.name}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={thread.status} onValueChange={(v) => onStatus(v as ThreadStatus)}>
                <ZoruSelectTrigger className="h-8 w-32">
                    <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="open">Open</ZoruSelectItem>
                    <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                    <ZoruSelectItem value="snoozed">Snoozed</ZoruSelectItem>
                    <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
                    <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect value={thread.priority} onValueChange={(v) => onPriority(v as ThreadPriority)}>
                <ZoruSelectTrigger className="h-8 w-28">
                    <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                        <ZoruSelectItem key={p} value={p}>
                            {p}
                        </ZoruSelectItem>
                    ))}
                </ZoruSelectContent>
            </ZoruSelect>
            <ZoruButton size="sm" onClick={onResolve}>
                <CheckCheck className="mr-1 h-4 w-4" /> Resolve
            </ZoruButton>
        </div>
    );
}

function MessageList({ messages }: { messages: InboxMessage[] }) {
    const ref = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => {
        ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' });
    }, [messages.length]);
    if (messages.length === 0) {
        return (
            <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                No messages yet.
            </div>
        );
    }
    return (
        <div ref={ref} className="flex-1 space-y-2 overflow-y-auto bg-muted/20 p-4">
            {messages.map((m) => {
                const outbound = m.direction === 'outbound';
                return (
                    <div key={m._id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[70%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                                outbound
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-card border'
                            }`}
                        >
                            {m.text && <div className="whitespace-pre-wrap">{m.text}</div>}
                            {m.caption && !m.text && <div className="italic">{m.caption}</div>}
                            <div className="mt-1 text-[10px] opacity-70">
                                {new Date(m.createdAt).toLocaleTimeString()}
                                {m.status === 'failed' && (
                                    <span className="ml-1 text-destructive">· failed</span>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function Composer({
    value,
    onChange,
    onSend,
    disabled,
    isSending,
}: {
    value: string;
    onChange: (v: string) => void;
    onSend: () => void;
    disabled: boolean;
    isSending: boolean;
}) {
    return (
        <div className="flex flex-shrink-0 items-end gap-2 border-t bg-card p-3">
            <ZoruTextarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Type a reply…"
                rows={2}
                className="flex-1 resize-none"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!disabled && value.trim()) onSend();
                    }
                }}
                disabled={disabled}
            />
            <ZoruButton onClick={onSend} disabled={disabled || !value.trim()}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </ZoruButton>
        </div>
    );
}

// =========================================================================
// Right pane
// =========================================================================

function RightPane({
    thread,
    relatedThreads,
    notes,
    noteDraft,
    setNoteDraft,
    onAddNote,
    onDeleteNote,
    isAddingNote,
    onAddTag,
    onRemoveTag,
    agents,
    onJumpTo,
}: {
    thread: InboxThread;
    relatedThreads: InboxThread[];
    notes: InboxNote[];
    noteDraft: string;
    setNoteDraft: (v: string) => void;
    onAddNote: () => void;
    onDeleteNote: (id: string) => void;
    isAddingNote: boolean;
    onAddTag: (tag: string) => Promise<void>;
    onRemoveTag: (tag: string) => Promise<void>;
    agents: AgentRow[];
    onJumpTo: (id: string) => void;
}) {
    const [newTag, setNewTag] = React.useState('');
    const agent = thread.assignedAgentId ? agents.find((a) => a._id === thread.assignedAgentId) : null;
    return (
        <ZoruScrollArea className="flex-1">
            <div className="space-y-4 p-3">
                {/* Contact card */}
                <ZoruCard>
                    <ZoruCardContent className="space-y-1 py-3">
                        <div className="flex items-center gap-2">
                            <ZoruAvatar className="h-10 w-10">
                                <ZoruAvatarFallback>{initials(thread.title)}</ZoruAvatarFallback>
                            </ZoruAvatar>
                            <div>
                                <div className="font-medium">{thread.title}</div>
                                <div className="text-xs text-muted-foreground">{thread.type}</div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 pt-2 text-xs">
                            <div className="text-muted-foreground">Chat ID</div>
                            <div className="font-mono">{thread.chatId}</div>
                            <div className="text-muted-foreground">Created</div>
                            <div>{fmtRelative(thread.createdAt)} ago</div>
                            <div className="text-muted-foreground">Notes</div>
                            <div>{thread.internalNotesCount}</div>
                            {agent && (
                                <>
                                    <div className="text-muted-foreground">Agent</div>
                                    <div>{agent.name}</div>
                                </>
                            )}
                        </div>
                    </ZoruCardContent>
                </ZoruCard>

                {/* Tags */}
                <div>
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <Tag className="h-3 w-3" /> Tags
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {thread.tags.map((t) => (
                            <ZoruBadge key={t} variant="secondary" className="cursor-default gap-1">
                                #{t}
                                <button
                                    type="button"
                                    aria-label={`Remove ${t}`}
                                    onClick={() => onRemoveTag(t)}
                                    className="ml-1 opacity-50 hover:opacity-100"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </ZoruBadge>
                        ))}
                        <div className="flex items-center gap-1">
                            <ZoruInput
                                value={newTag}
                                onChange={(e) => setNewTag(e.target.value)}
                                placeholder="+ tag"
                                className="h-6 w-24 text-xs"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter' && newTag.trim()) {
                                        await onAddTag(newTag.trim());
                                        setNewTag('');
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div>
                    <div className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        <StickyNote className="h-3 w-3" /> Internal notes
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-end gap-1">
                            <ZoruTextarea
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                placeholder="Write a note (mention with @userId)…"
                                rows={2}
                                className="resize-none text-xs"
                            />
                            <ZoruButton
                                size="sm"
                                onClick={onAddNote}
                                disabled={isAddingNote || !noteDraft.trim()}
                            >
                                {isAddingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                            </ZoruButton>
                        </div>
                        {notes.length === 0 && (
                            <div className="rounded border border-dashed p-2 text-center text-xs text-muted-foreground">
                                No notes yet.
                            </div>
                        )}
                        {notes.map((n) => (
                            <div key={n._id} className="rounded border bg-amber-50 p-2 text-xs">
                                <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span>by {n.authorId.slice(0, 8)}…</span>
                                    <div className="flex items-center gap-1">
                                        <span>{fmtRelative(n.createdAt)}</span>
                                        <button
                                            onClick={() => onDeleteNote(n._id)}
                                            aria-label="Delete note"
                                        >
                                            <Trash2 className="h-3 w-3 opacity-50 hover:opacity-100" />
                                        </button>
                                    </div>
                                </div>
                                <div className="whitespace-pre-wrap">{n.body}</div>
                                {n.mentions.length > 0 && (
                                    <div className="mt-1 flex gap-1 text-[10px]">
                                        {n.mentions.map((m) => (
                                            <span key={m} className="text-primary">@{m}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity */}
                <div>
                    <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Activity
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <div>Created {fmtRelative(thread.createdAt)} ago</div>
                        {thread.firstResponseAt && (
                            <div>First reply {fmtRelative(thread.firstResponseAt)} ago</div>
                        )}
                        {thread.resolvedAt && (
                            <div>Resolved {fmtRelative(thread.resolvedAt)} ago</div>
                        )}
                        {thread.slaDueAt && !thread.resolvedAt && (
                            <div>
                                SLA due {fmtRelative(thread.slaDueAt)}
                                {thread.slaBreached ? ' (breached)' : ''}
                            </div>
                        )}
                    </div>
                </div>

                {/* Related threads */}
                {relatedThreads.length > 0 && (
                    <div>
                        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Related threads
                        </div>
                        <div className="space-y-1">
                            {relatedThreads.map((r) => (
                                <button
                                    key={r._id}
                                    onClick={() => onJumpTo(r._id)}
                                    className="block w-full rounded border p-2 text-left text-xs hover:bg-accent"
                                >
                                    <div className="font-medium">{r.title}</div>
                                    <div className="text-muted-foreground">
                                        {r.status} · {fmtRelative(r.lastInboundAt ?? r.updatedAt)} ago
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </ZoruScrollArea>
    );
}

// =========================================================================
// Auto-assign rules drawer
// =========================================================================

function RulesDrawer({
    open,
    onClose,
    projectId,
    agents,
    refresh,
}: {
    open: boolean;
    onClose: () => void;
    projectId: string;
    agents: AgentRow[];
    refresh: () => void;
}) {
    const { toast } = useZoruToast();
    const [rules, setRules] = React.useState<AutoAssignRule[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [editing, setEditing] = React.useState<AutoAssignRule | null>(null);
    const [showForm, setShowForm] = React.useState(false);

    const load = React.useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        const res = await listAutoAssignAction(projectId);
        setRules(res.rules || []);
        setIsLoading(false);
    }, [projectId]);

    React.useEffect(() => {
        if (open) load();
    }, [open, load]);

    const onDelete = async (id: string) => {
        if (!confirm('Delete this rule?')) return;
        const res = await deleteAutoAssignAction(id, projectId);
        if (res.success) {
            toast({ title: 'Rule deleted.' });
            load();
            refresh();
        } else {
            toast({ title: 'Failed', description: res.error, variant: 'destructive' });
        }
    };

    return (
        <ZoruDrawer open={open} onOpenChange={(v) => !v && onClose()}>
            <ZoruDrawerContent>
                <ZoruDrawerHeader>
                    <ZoruDrawerTitle>Auto-assign rules</ZoruDrawerTitle>
                    <ZoruDrawerDescription>
                        Rules run in priority order when a new thread is created. The first match wins.
                    </ZoruDrawerDescription>
                </ZoruDrawerHeader>
                <div className="space-y-3 p-4">
                    <ZoruButton
                        onClick={() => {
                            setEditing(null);
                            setShowForm(true);
                        }}
                    >
                        <Plus className="mr-1 h-4 w-4" /> New rule
                    </ZoruButton>
                    {isLoading && <ZoruSkeleton className="h-20 w-full" />}
                    {!isLoading && rules.length === 0 && (
                        <ZoruEmptyState
                            icon={<ListChecks />}
                            title="No rules yet"
                            description="Add a rule to automatically route incoming threads."
                        />
                    )}
                    <div className="space-y-2">
                        {rules.map((r) => (
                            <ZoruCard key={r._id}>
                                <ZoruCardContent className="flex items-center gap-2 py-2">
                                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{r.name}</span>
                                            <ZoruBadge variant={r.enabled ? 'success' : 'ghost'} className="h-4 px-1 text-[10px]">
                                                {r.enabled ? 'on' : 'off'}
                                            </ZoruBadge>
                                            <span className="text-xs text-muted-foreground">priority {r.priority}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {r.assignTo?.kind ?? 'agent'} →{' '}
                                            {(r.assignTo?.agentIds ?? []).join(', ') || 'none'}
                                        </div>
                                    </div>
                                    <ZoruButton size="icon" variant="ghost" onClick={() => { setEditing(r); setShowForm(true); }} aria-label="Edit rule">
                                        <Pencil className="h-3 w-3" />
                                    </ZoruButton>
                                    <ZoruButton size="icon" variant="ghost" onClick={() => onDelete(r._id)} aria-label="Delete rule">
                                        <Trash2 className="h-3 w-3" />
                                    </ZoruButton>
                                </ZoruCardContent>
                            </ZoruCard>
                        ))}
                    </div>
                </div>
                <RuleForm
                    open={showForm}
                    onClose={() => setShowForm(false)}
                    rule={editing}
                    projectId={projectId}
                    agents={agents}
                    onSaved={() => {
                        setShowForm(false);
                        load();
                        refresh();
                    }}
                />
            </ZoruDrawerContent>
        </ZoruDrawer>
    );
}

function RuleForm({
    open,
    onClose,
    rule,
    projectId,
    agents,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    rule: AutoAssignRule | null;
    projectId: string;
    agents: AgentRow[];
    onSaved: () => void;
}) {
    const { toast } = useZoruToast();
    const [name, setName] = React.useState(rule?.name ?? '');
    const [enabled, setEnabled] = React.useState(rule?.enabled ?? true);
    const [priority, setPriority] = React.useState<number>(rule?.priority ?? 100);
    const [kind, setKind] = React.useState<string>(rule?.assignTo?.kind ?? 'agent');
    const [agentIds, setAgentIds] = React.useState<string[]>(rule?.assignTo?.agentIds ?? []);
    const [keywords, setKeywords] = React.useState<string>((rule?.match?.keywordIn ?? []).join(', '));
    const [tagsCsv, setTagsCsv] = React.useState<string>((rule?.applyTags ?? []).join(', '));
    const [setSla, setSetSla] = React.useState<string>(rule?.setSlaSeconds?.toString() ?? '');
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setName(rule?.name ?? '');
            setEnabled(rule?.enabled ?? true);
            setPriority(rule?.priority ?? 100);
            setKind(rule?.assignTo?.kind ?? 'agent');
            setAgentIds(rule?.assignTo?.agentIds ?? []);
            setKeywords((rule?.match?.keywordIn ?? []).join(', '));
            setTagsCsv((rule?.applyTags ?? []).join(', '));
            setSetSla(rule?.setSlaSeconds?.toString() ?? '');
        }
    }, [open, rule]);

    const onSave = async () => {
        if (!name.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        setBusy(true);
        const body = {
            projectId,
            name: name.trim(),
            enabled,
            priority,
            match: {
                keywordIn: keywords
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
            },
            assignTo: { kind: kind as 'agent' | 'round_robin' | 'random' | 'least_loaded', agentIds },
            applyTags: tagsCsv
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            setSlaSeconds: setSla ? Number(setSla) : undefined,
        };
        const res = rule
            ? await updateAutoAssignAction(rule._id, body)
            : await createAutoAssignAction(body);
        setBusy(false);
        if (res.success) {
            toast({ title: rule ? 'Rule updated.' : 'Rule created.' });
            onSaved();
        } else {
            toast({ title: 'Failed', description: res.error, variant: 'destructive' });
        }
    };

    return (
        <ZoruDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>{rule ? 'Edit rule' : 'New rule'}</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium" htmlFor="rule-name">Name</label>
                        <ZoruInput id="rule-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-medium" htmlFor="rule-priority">Priority (lower = first)</label>
                            <ZoruInput id="rule-priority" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
                        </div>
                        <div className="flex flex-col">
                            <label className="text-xs font-medium" htmlFor="rule-enabled">Enabled</label>
                            <div className="pt-2">
                                <ZoruCheckbox id="rule-enabled" checked={enabled} onCheckedChange={(v) => setEnabled(Boolean(v))} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium" htmlFor="rule-keywords">Match keywords (comma-separated)</label>
                        <ZoruInput id="rule-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="refund, billing, urgent" />
                    </div>
                    <div>
                        <label className="text-xs font-medium" htmlFor="rule-kind">Assignment kind</label>
                        <ZoruSelect value={kind} onValueChange={setKind}>
                            <ZoruSelectTrigger id="rule-kind"><ZoruSelectValue /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="agent">Fixed agent (first in list)</ZoruSelectItem>
                                <ZoruSelectItem value="round_robin">Round robin</ZoruSelectItem>
                                <ZoruSelectItem value="random">Random</ZoruSelectItem>
                                <ZoruSelectItem value="least_loaded">Least loaded</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <div>
                        <label className="text-xs font-medium">Agents</label>
                        <div className="grid grid-cols-2 gap-1">
                            {agents.map((a) => (
                                <label key={a._id} className="flex items-center gap-1 text-xs">
                                    <ZoruCheckbox
                                        checked={agentIds.includes(a._id)}
                                        onCheckedChange={(v) => {
                                            setAgentIds((prev) =>
                                                v ? [...prev, a._id] : prev.filter((id) => id !== a._id),
                                            );
                                        }}
                                    />
                                    {a.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium" htmlFor="rule-tags">Apply tags (comma-separated)</label>
                        <ZoruInput id="rule-tags" value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium" htmlFor="rule-sla">SLA seconds (optional)</label>
                        <ZoruInput id="rule-sla" type="number" value={setSla} onChange={(e) => setSetSla(e.target.value)} />
                    </div>
                </div>
                <ZoruDialogFooter>
                    <ZoruButton variant="ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton onClick={onSave} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

// =========================================================================
// SLA policies drawer
// =========================================================================

function SlaDrawer({
    open,
    onClose,
    projectId,
    refresh,
}: {
    open: boolean;
    onClose: () => void;
    projectId: string;
    refresh: () => void;
}) {
    const { toast } = useZoruToast();
    const [policies, setPolicies] = React.useState<SlaPolicy[]>([]);
    const [showForm, setShowForm] = React.useState(false);
    const [editing, setEditing] = React.useState<SlaPolicy | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);

    const load = React.useCallback(async () => {
        if (!projectId) return;
        setIsLoading(true);
        const res = await listSlaAction(projectId);
        setPolicies(res.policies || []);
        setIsLoading(false);
    }, [projectId]);

    React.useEffect(() => {
        if (open) load();
    }, [open, load]);

    const onDelete = async (id: string) => {
        if (!confirm('Delete this SLA policy?')) return;
        const res = await deleteSlaAction(id, projectId);
        if (res.success) {
            toast({ title: 'SLA deleted.' });
            load();
            refresh();
        } else {
            toast({ title: 'Failed', description: res.error, variant: 'destructive' });
        }
    };

    return (
        <ZoruDrawer open={open} onOpenChange={(v) => !v && onClose()}>
            <ZoruDrawerContent>
                <ZoruDrawerHeader>
                    <ZoruDrawerTitle>SLA policies</ZoruDrawerTitle>
                    <ZoruDrawerDescription>
                        Each thread picks the most specific matching policy at creation.
                    </ZoruDrawerDescription>
                </ZoruDrawerHeader>
                <div className="space-y-3 p-4">
                    <ZoruButton onClick={() => { setEditing(null); setShowForm(true); }}>
                        <Plus className="mr-1 h-4 w-4" /> New SLA
                    </ZoruButton>
                    {isLoading && <ZoruSkeleton className="h-20 w-full" />}
                    {!isLoading && policies.length === 0 && (
                        <ZoruEmptyState
                            icon={<AlarmClock />}
                            title="No SLA policies"
                            description="Add one to start measuring response and resolution times."
                        />
                    )}
                    <div className="space-y-2">
                        {policies.map((p) => (
                            <ZoruCard key={p._id}>
                                <ZoruCardContent className="flex items-center gap-2 py-2">
                                    <div className="flex-1">
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-xs text-muted-foreground">
                                            First response {fmtSeconds(p.firstResponseSeconds)} · Resolution {fmtSeconds(p.resolutionSeconds)}
                                            {p.applyToTags && p.applyToTags.length > 0 && (
                                                <span> · tags: {p.applyToTags.join(', ')}</span>
                                            )}
                                        </div>
                                    </div>
                                    <ZoruButton size="icon" variant="ghost" onClick={() => { setEditing(p); setShowForm(true); }} aria-label="Edit policy">
                                        <Pencil className="h-3 w-3" />
                                    </ZoruButton>
                                    <ZoruButton size="icon" variant="ghost" onClick={() => onDelete(p._id)} aria-label="Delete policy">
                                        <Trash2 className="h-3 w-3" />
                                    </ZoruButton>
                                </ZoruCardContent>
                            </ZoruCard>
                        ))}
                    </div>
                </div>
                <SlaForm
                    open={showForm}
                    onClose={() => setShowForm(false)}
                    policy={editing}
                    projectId={projectId}
                    onSaved={() => {
                        setShowForm(false);
                        load();
                        refresh();
                    }}
                />
            </ZoruDrawerContent>
        </ZoruDrawer>
    );
}

function SlaForm({
    open,
    onClose,
    policy,
    projectId,
    onSaved,
}: {
    open: boolean;
    onClose: () => void;
    policy: SlaPolicy | null;
    projectId: string;
    onSaved: () => void;
}) {
    const { toast } = useZoruToast();
    const [name, setName] = React.useState(policy?.name ?? '');
    const [first, setFirst] = React.useState(String(policy?.firstResponseSeconds ?? 3600));
    const [resolution, setResolution] = React.useState(String(policy?.resolutionSeconds ?? 86400));
    const [tagsCsv, setTagsCsv] = React.useState((policy?.applyToTags ?? []).join(', '));
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setName(policy?.name ?? '');
            setFirst(String(policy?.firstResponseSeconds ?? 3600));
            setResolution(String(policy?.resolutionSeconds ?? 86400));
            setTagsCsv((policy?.applyToTags ?? []).join(', '));
        }
    }, [open, policy]);

    const onSave = async () => {
        if (!name.trim()) {
            toast({ title: 'Name required', variant: 'destructive' });
            return;
        }
        setBusy(true);
        const body = {
            projectId,
            name: name.trim(),
            firstResponseSeconds: Number(first),
            resolutionSeconds: Number(resolution),
            applyToTags: tagsCsv.split(',').map((t) => t.trim()).filter(Boolean),
        };
        const res = policy
            ? await updateSlaAction(policy._id, body)
            : await createSlaAction(body);
        setBusy(false);
        if (res.success) {
            toast({ title: policy ? 'SLA updated.' : 'SLA created.' });
            onSaved();
        } else {
            toast({ title: 'Failed', description: res.error, variant: 'destructive' });
        }
    };

    return (
        <ZoruDialog open={open} onOpenChange={(v) => !v && onClose()}>
            <ZoruDialogContent>
                <ZoruDialogHeader>
                    <ZoruDialogTitle>{policy ? 'Edit SLA' : 'New SLA'}</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium" htmlFor="sla-name">Name</label>
                        <ZoruInput id="sla-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-medium" htmlFor="sla-first">First response (s)</label>
                            <ZoruInput id="sla-first" type="number" value={first} onChange={(e) => setFirst(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-medium" htmlFor="sla-resolution">Resolution (s)</label>
                            <ZoruInput id="sla-resolution" type="number" value={resolution} onChange={(e) => setResolution(e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium" htmlFor="sla-tags">Apply to tags (comma-separated; blank = global)</label>
                        <ZoruInput id="sla-tags" value={tagsCsv} onChange={(e) => setTagsCsv(e.target.value)} />
                    </div>
                </div>
                <ZoruDialogFooter>
                    <ZoruButton variant="ghost" onClick={onClose} disabled={busy}>
                        Cancel
                    </ZoruButton>
                    <ZoruButton onClick={onSave} disabled={busy}>
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                    </ZoruButton>
                </ZoruDialogFooter>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

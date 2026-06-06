'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Checkbox,
  DatePicker,
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
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  RadioGroup,
  ZoruRadioGroupItem,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Separator,
  Skeleton,
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  AlertCircle,
  BookOpen,
  Clapperboard,
  Download,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  Video as VideoIcon,
  X,
  XCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  } from 'lucide-react';

/**
 * Telegram Stories — Bot API 7.0+ stories on channels (with
 * `can_post_stories` admin rights) and on business accounts (via
 * `business_connection_id`).
 *
 * SabFiles policy: media is picked from the user's SabFiles library
 * (never a free-text URL). The picker call lives in
 * `<SabFileUrlInput>`.
 */

import * as React from 'react';

import { SabFileUrlInput } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import {
    cancelTelegramStoryAction,
    createTelegramStoryAction,
    deleteTelegramStoryAction,
    deleteTelegramStoryBusinessConnectionAction,
    deleteTelegramStoryOnTelegramAction,
    editTelegramStoryOnTelegramAction,
    exportTelegramStoriesCsvAction,
    getTelegramStoriesAnalyticsAction,
    getTelegramStoryStarBalanceAction,
    listTelegramBotsAction,
    listTelegramStoriesAction,
    listTelegramStoryBusinessConnectionsAction,
    postTelegramStoryAction,
    registerTelegramStoryBusinessConnectionAction,
    scheduleTelegramStoryAction,
    updateTelegramStoryAction,
} from '@/app/actions/telegram-extra.actions';
import { listChannels } from '@/app/actions/telegram-channels.actions';
import type {
    AnalyticsResp,
    BusinessConnectionRow,
    StoryActivePeriodSeconds,
    StoryArea,
    StoryContent,
    StoryMediaKind,
    StoryPrivacy,
    StoryPrivacyKind,
    StoryRow,
    StoryStatus,
    StoryType,
} from '@/lib/rust-client/telegram-stories';
import type { BotRow } from '@/lib/rust-client/telegram-bots';
import type { ChannelRow } from '@/lib/rust-client/telegram-channels';
import { StoryCard } from './_components/story-card';
import { StoryDetail } from './_components/story-detail';
import { AreaEditor, AreaDraft } from './_components/area-editor';
import { StoryEditorDrawer, FormState, EMPTY_FORM, combineDateTime, makeAreaKey, parseUserIds } from './_components/story-editor-drawer';

const ACCENT = '#229ED9';
const ACCENT_DARK = '#1d8ec0';
const PAGE_SIZE = 12;

const STATUS_OPTIONS: { value: StoryStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'posted', label: 'Posted' },
    { value: 'expired', label: 'Expired' },
    { value: 'failed', label: 'Failed' },
    { value: 'deleted', label: 'Deleted' },
];

const TYPE_OPTIONS: { value: StoryType | 'all'; label: string }[] = [
    { value: 'all', label: 'Channel & business' },
    { value: 'channel', label: 'Channel' },
    { value: 'business', label: 'Business' },
];

const PRIVACY_OPTIONS: { value: StoryPrivacyKind; label: string }[] = [
    { value: 'public', label: 'Everyone' },
    { value: 'contacts', label: 'Contacts' },
    { value: 'close_friends', label: 'Close friends' },
    { value: 'selected', label: 'Selected users' },
];



function buildContent(form: FormState): StoryContent {
    return {
        mediaKind: form.mediaKind,
        sabFileId: form.mediaSabFileId,
        caption: form.caption.trim() || undefined,
        parseMode: form.parseMode || undefined,
        areas:
            form.areas.length > 0
                ? form.areas.map((a) => ({
                      position: a.position,
                      type: a.type,
                      payload: a.payload,
                  }))
                : undefined,
    };
}

function buildPrivacy(form: FormState): StoryPrivacy {
    return {
        kind: form.privacyKind,
        userIds:
            form.privacyKind === 'selected'
                ? parseUserIds(form.userIdsRaw)
                : undefined,
    };
}

function validateForm(form: FormState): string | null {
    if (!form.botId) return 'Pick a bot.';
    if (form.type === 'channel' && !form.channelId) {
        return 'Pick a channel to post to.';
    }
    if (form.type === 'business' && !form.businessConnectionId) {
        return 'Pick a business connection to post from.';
    }
    if (!form.mediaSabFileId) {
        return 'Pick a photo or video from SabFiles.';
    }
    if (form.privacyKind === 'selected') {
        const ids = parseUserIds(form.userIdsRaw);
        if (ids.length === 0) return 'Add at least one user id.';
        if (ids.length > 200) return 'Maximum 200 user ids.';
    }
    if (form.scheduleMode === 'later') {
        const dt = combineDateTime(form.scheduledDate, form.scheduledTime);
        if (!dt) return 'Pick a schedule date & time.';
        if (dt.getTime() <= Date.now()) {
            return 'Scheduled time must be in the future.';
        }
    }
    return null;
}

export default function TelegramStoriesPage() {
    return (
        <TelegramProjectGate>
            <TelegramStoriesContent />
        </TelegramProjectGate>
    );
}

function TelegramStoriesContent() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useZoruToast();

    // -- Data --
    const [data, setData] = React.useState<{
        stories: StoryRow[];
        total: number;
        hasMore: boolean;
    }>({ stories: [], total: 0, hasMore: false });
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [analyticsLoading, setAnalyticsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    const [bots, setBots] = React.useState<BotRow[]>([]);
    const [channels, setChannels] = React.useState<ChannelRow[]>([]);
    const [businessConnections, setBusinessConnections] = React.useState<
        BusinessConnectionRow[]
    >([]);
    const [starBalance, setStarBalance] = React.useState<{
        amount: number;
        nanostarAmount: number;
    } | null>(null);
    const [selectedBcId, setSelectedBcId] = React.useState<string>('');

    // -- Filters / paging --
    const [search, setSearch] = React.useState('');
    const [searchDebounced, setSearchDebounced] = React.useState('');
    const [botFilter, setBotFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<StoryStatus | 'all'>(
        'all',
    );
    const [typeFilter, setTypeFilter] = React.useState<StoryType | 'all'>('all');
    const [page, setPage] = React.useState(1);
    const [sortField, setSortField] = React.useState<'createdAt' | 'activePeriodSeconds'>('createdAt');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

    // -- Editor drawer --
    const [editorOpen, setEditorOpen] = React.useState(false);
    const [editorForm, setEditorForm] = React.useState<FormState>(EMPTY_FORM);
    const [editorErr, setEditorErr] = React.useState<string | null>(null);
    const [savingEditor, setSavingEditor] = React.useState(false);

    // -- Detail drawer --
    const [detailRow, setDetailRow] = React.useState<StoryRow | null>(null);

    // -- Confirm dialogs --
    const [deleteRow, setDeleteRow] = React.useState<StoryRow | null>(null);
    const [tgDeleteRow, setTgDeleteRow] = React.useState<StoryRow | null>(null);
    const [postRow, setPostRow] = React.useState<StoryRow | null>(null);

    // -- Business connections panel --
    const [bcOpen, setBcOpen] = React.useState(false);
    const [bcAddOpen, setBcAddOpen] = React.useState(false);
    const [bcAddBot, setBcAddBot] = React.useState('');
    const [bcAddConnectionId, setBcAddConnectionId] = React.useState('');
    const [bcSaving, setBcSaving] = React.useState(false);

    // -- Search debounce --
    React.useEffect(() => {
        const id = setTimeout(() => setSearchDebounced(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    React.useEffect(() => {
        setPage(1);
    }, [searchDebounced, statusFilter, typeFilter, botFilter, projectId]);

    const reloadStories = React.useCallback(async (silent = false) => {
        if (!projectId) {
            setData({ stories: [], total: 0, hasMore: false });
            if (!silent) setLoading(false);
            return;
        }
        if (!silent) setLoading(true);
        if (!silent) setError(null);
        const res = await listTelegramStoriesAction({
            projectId,
            page,
            pageSize: PAGE_SIZE,
            status: statusFilter === 'all' ? undefined : statusFilter,
            type: typeFilter === 'all' ? undefined : typeFilter,
            botId: botFilter === 'all' ? undefined : botFilter,
            search: searchDebounced || undefined,
        });
        setData({
            stories: res.stories ?? [],
            total: res.total ?? 0,
            hasMore: res.hasMore ?? false,
        });
        if (res.error && !silent) setError(res.error);
        if (!silent) setLoading(false);
    }, [projectId, page, statusFilter, typeFilter, botFilter, searchDebounced]);

    const reloadAnalytics = React.useCallback(async (silent = false) => {
        if (!projectId) {
            setAnalytics(null);
            if (!silent) setAnalyticsLoading(false);
            return;
        }
        if (!silent) setAnalyticsLoading(true);
        const res = await getTelegramStoriesAnalyticsAction({ projectId });
        if (res.error && !silent) {
            toast({ title: 'Analytics error', description: res.error, variant: 'destructive' });
        }
        setAnalytics(res);
        if (!silent) setAnalyticsLoading(false);
    }, [projectId, toast]);

    const reloadBots = React.useCallback(async () => {
        if (!projectId) {
            setBots([]);
            return;
        }
        const res = await listTelegramBotsAction({
            projectId,
            pageSize: 100,
        });
        if (res.error) {
            toast({ title: 'Error fetching bots', description: res.error, variant: 'destructive' });
        }
        setBots(res.bots ?? []);
    }, [projectId, toast]);

    const reloadChannels = React.useCallback(async () => {
        if (!projectId) {
            setChannels([]);
            return;
        }
        const res = await listChannels({ projectId, limit: 200 });
        if (res.error) {
            toast({ title: 'Error fetching channels', description: res.error, variant: 'destructive' });
        }
        setChannels(res.channels ?? []);
    }, [projectId, toast]);

    const reloadBusinessConnections = React.useCallback(async () => {
        if (!projectId) {
            setBusinessConnections([]);
            return;
        }
        const res =
            await listTelegramStoryBusinessConnectionsAction(projectId);
        if (res.error) {
            toast({ title: 'Error fetching business connections', description: res.error, variant: 'destructive' });
        }
        setBusinessConnections(res.connections ?? []);
    }, [projectId, toast]);

    React.useEffect(() => {
        void reloadStories();
        void reloadAnalytics();
        
        // Polling for real-time updates, pausing when document is not visible
        const intervalId = setInterval(() => {
            if (document.visibilityState === 'visible') {
                void reloadStories(true);
                void reloadAnalytics(true);
            }
        }, 15000);
        return () => clearInterval(intervalId);
    }, [reloadStories, reloadAnalytics]);
    React.useEffect(() => {
        void reloadBots();
    }, [reloadBots]);
    React.useEffect(() => {
        void reloadChannels();
    }, [reloadChannels]);
    React.useEffect(() => {
        void reloadBusinessConnections();
    }, [reloadBusinessConnections]);

    // -- Star balance on connection select --
    React.useEffect(() => {
        if (!selectedBcId || !projectId) {
            setStarBalance(null);
            return;
        }
        const conn = businessConnections.find((b) => b._id === selectedBcId);
        if (!conn) {
            setStarBalance(null);
            return;
        }
        void (async () => {
            const r = await getTelegramStoryStarBalanceAction({
                projectId,
                botId: conn.botId,
                connectionId: conn.connectionId,
            });
            if (r.success) {
                setStarBalance({
                    amount: r.amount,
                    nanostarAmount: r.nanostarAmount,
                });
            } else {
                setStarBalance(null);
            }
        })();
    }, [selectedBcId, projectId, businessConnections]);

    const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

    function openCreate() {
        setEditorForm({
            ...EMPTY_FORM,
            botId: bots[0]?._id ?? '',
        });
        setEditorErr(null);
        setEditorOpen(true);
    }

    function openEdit(row: StoryRow) {
        setEditorForm({
            storyId: row._id,
            botId: row.botId,
            type: row.type,
            channelId: row.channelId ?? '',
            businessConnectionId: row.businessConnectionId ?? '',
            mediaKind: row.content.mediaKind,
            mediaUrl: '',
            mediaSabFileId: row.content.sabFileId,
            caption: row.content.caption ?? '',
            parseMode: row.content.parseMode ?? '',
            areas: (row.content.areas ?? []).map((a) => ({
                ...a,
                _key: makeAreaKey(),
            })),
            privacyKind: row.privacy.kind,
            userIdsRaw: (row.privacy.userIds ?? []).join(', '),
            activePeriod: row.activePeriodSeconds as StoryActivePeriodSeconds,
            postToChatPage: row.postToChatPage,
            protectContent: row.protectContent,
            scheduleMode: row.status === 'scheduled' ? 'later' : 'now',
            scheduledDate: row.scheduledAt
                ? new Date(row.scheduledAt)
                : undefined,
            scheduledTime: row.scheduledAt
                ? new Date(row.scheduledAt).toISOString().slice(11, 16)
                : '12:00',
        });
        setEditorErr(null);
        setEditorOpen(true);
    }

    async function saveEditor() {
        if (!projectId) return;
        const v = validateForm(editorForm);
        if (v) {
            setEditorErr(v);
            return;
        }
        setSavingEditor(true);
        const content = buildContent(editorForm);
        const privacy = buildPrivacy(editorForm);
        const scheduledAt =
            editorForm.scheduleMode === 'later'
                ? combineDateTime(
                      editorForm.scheduledDate,
                      editorForm.scheduledTime,
                  )?.toISOString()
                : undefined;

        if (editorForm.storyId) {
            const res = await updateTelegramStoryAction(editorForm.storyId, {
                projectId,
                content,
                privacy,
                activePeriodSeconds: editorForm.activePeriod,
                postToChatPage: editorForm.postToChatPage,
                protectContent: editorForm.protectContent,
                scheduledAt,
            });
            setSavingEditor(false);
            if (res.success) {
                toast({
                    title: 'Saved',
                    description: res.message ?? 'Story updated.',
                });
                setEditorOpen(false);
                void reloadStories();
                void reloadAnalytics();
            } else {
                setEditorErr(res.error ?? 'Failed to save.');
                toast({
                    title: 'Error',
                    description: res.error ?? 'Failed to save story.',
                    variant: 'destructive',
                });
            }
            return;
        }

        const res = await createTelegramStoryAction({
            projectId,
            botId: editorForm.botId,
            type: editorForm.type,
            channelId:
                editorForm.type === 'channel'
                    ? editorForm.channelId
                    : undefined,
            businessConnectionId:
                editorForm.type === 'business'
                    ? editorForm.businessConnectionId
                    : undefined,
            content,
            privacy,
            activePeriodSeconds: editorForm.activePeriod,
            postToChatPage: editorForm.postToChatPage,
            protectContent: editorForm.protectContent,
            scheduledAt,
        });
        setSavingEditor(false);
        if (res.success) {
            toast({
                title: 'Saved',
                description: res.message ?? 'Story created.',
            });
            setEditorOpen(false);
            void reloadStories();
            void reloadAnalytics();
        } else {
            setEditorErr(res.error ?? 'Failed to create.');
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to create story.',
                variant: 'destructive',
            });
        }
    }

    async function confirmPostNow(row: StoryRow) {
        if (!projectId) return;
        const res = await postTelegramStoryAction(row._id, projectId);
        if (res.success) {
            toast({
                title: 'Posted',
                description: res.message ?? 'Story posted to Telegram.',
            });
            setPostRow(null);
            void reloadStories();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Failed to post',
                description: res.error ?? 'Telegram rejected the request.',
                variant: 'destructive',
            });
        }
    }

    async function confirmCancel(row: StoryRow) {
        if (!projectId) return;
        const res = await cancelTelegramStoryAction(row._id, projectId);
        if (res.success) {
            toast({
                title: 'Cancelled',
                description: res.message ?? 'Back to draft.',
            });
            void reloadStories();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to cancel.',
                variant: 'destructive',
            });
        }
    }

    async function confirmDeleteLocal() {
        if (!deleteRow || !projectId) return;
        const res = await deleteTelegramStoryAction(deleteRow._id, projectId);
        if (res.success) {
            toast({ title: 'Deleted', description: 'Local record removed.' });
            setDeleteRow(null);
            void reloadStories();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Failed to delete.',
                variant: 'destructive',
            });
        }
    }

    async function confirmDeleteOnTelegram() {
        if (!tgDeleteRow || !projectId) return;
        const res = await deleteTelegramStoryOnTelegramAction(
            tgDeleteRow._id,
            projectId,
        );
        if (res.success) {
            toast({
                title: 'Deleted on Telegram',
                description: res.message ?? 'Story removed from Telegram.',
            });
            setTgDeleteRow(null);
            void reloadStories();
            void reloadAnalytics();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Telegram rejected the request.',
                variant: 'destructive',
            });
        }
    }

    async function runExport() {
        if (!projectId) return;
        const csv = await exportTelegramStoriesCsvAction(projectId);
        if (!csv) {
            toast({
                title: 'Export failed',
                description: 'Could not generate CSV.',
                variant: 'destructive',
            });
            return;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `telegram-stories-${new Date()
            .toISOString()
            .slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: 'CSV downloaded.' });
    }

    async function saveBusinessConnection() {
        if (!projectId || !bcAddBot || !bcAddConnectionId.trim()) return;
        setBcSaving(true);
        const res = await registerTelegramStoryBusinessConnectionAction({
            projectId,
            botId: bcAddBot,
            connectionId: bcAddConnectionId.trim(),
        });
        setBcSaving(false);
        if (res.success) {
            toast({
                title: 'Connection added',
                description: res.message ?? 'Saved.',
            });
            setBcAddOpen(false);
            setBcAddBot('');
            setBcAddConnectionId('');
            void reloadBusinessConnections();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Could not save connection.',
                variant: 'destructive',
            });
        }
    }

    async function deleteBusinessConnection(id: string) {
        if (!projectId) return;
        const res = await deleteTelegramStoryBusinessConnectionAction(
            id,
            projectId,
        );
        if (res.success) {
            toast({ title: 'Removed', description: 'Connection deleted.' });
            void reloadBusinessConnections();
        } else {
            toast({
                title: 'Error',
                description: res.error ?? 'Could not remove.',
                variant: 'destructive',
            });
        }
    }

    const rows = React.useMemo(() => {
        const list = [...data.stories];
        list.sort((a, b) => {
            let cmp = 0;
            if (sortField === 'createdAt') {
                cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            } else if (sortField === 'activePeriodSeconds') {
                cmp = a.activePeriodSeconds - b.activePeriodSeconds;
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
        return list;
    }, [data.stories, sortField, sortDir]);

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
                        boxShadow: '0 10px 28px rgba(34, 158, 217, 0.28)',
                    }}
                >
                    <Clapperboard
                        className="h-6 w-6 text-white"
                        strokeWidth={1.75}
                    />
                </div>
                <div className="flex-1">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-zoru-ink-subtle">
                        Telegram
                    </p>
                    <h1 className="mt-0.5 text-[22px] leading-tight text-zoru-ink">
                        Telegram Stories
                    </h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                        Compose, schedule, and post 24-hour stories — on channels
                        where your bot has <code>can_post_stories</code>, or on
                        business accounts via a saved business connection.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBcOpen(true)}
                    >
                        <BookOpen className="h-3.5 w-3.5" />
                        Business connections
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={runExport}
                        disabled={!projectId}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Export CSV
                    </Button>
                    <Button
                        size="sm"
                        onClick={openCreate}
                        disabled={!projectId || bots.length === 0}
                    >
                        <Plus className="h-3.5 w-3.5" />
                        New story
                    </Button>
                </div>
            </div>

            {/* Project ID empty state handled by TelegramProjectGate */}

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <KpiCard
                    label="Total stories"
                    value={analytics ? data.total.toLocaleString() : '—'}
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="Scheduled"
                    value={
                        analytics
                            ? analytics.scheduled.toLocaleString()
                            : '—'
                    }
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="Posted today"
                    value={
                        analytics
                            ? analytics.postedToday.toLocaleString()
                            : '—'
                    }
                    loading={analyticsLoading}
                />
                <KpiCard
                    label="Active now"
                    value={analytics ? analytics.active.toLocaleString() : '—'}
                    loading={analyticsLoading}
                />
            </div>

            {/* Filter bar */}
            <Card className="p-3">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-[220px] flex-1">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zoru-ink-subtle" />
                        <Input
                            placeholder="Search captions or errors"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <div className="min-w-[160px]">
                        <Select
                            value={botFilter}
                            onValueChange={setBotFilter}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All bots" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All bots</ZoruSelectItem>
                                {bots.map((b) => (
                                    <ZoruSelectItem key={b._id} value={b._id}>
                                        {b.username || b.name || b._id}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[150px]">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) =>
                                setStatusFilter(v as StoryStatus | 'all')
                            }
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {STATUS_OPTIONS.map((o) => (
                                    <ZoruSelectItem
                                        key={o.value}
                                        value={o.value}
                                    >
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[170px]">
                        <Select
                            value={typeFilter}
                            onValueChange={(v) =>
                                setTypeFilter(v as StoryType | 'all')
                            }
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {TYPE_OPTIONS.map((o) => (
                                    <ZoruSelectItem
                                        key={o.value}
                                        value={o.value}
                                    >
                                        {o.label}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <div className="min-w-[150px] flex items-center gap-1 border border-zoru-line rounded-md px-2 h-9 bg-zoru-surface">
                        <select 
                            className="bg-transparent text-sm focus:outline-none flex-1" 
                            value={sortField} 
                            onChange={(e) => setSortField(e.target.value as 'createdAt' | 'activePeriodSeconds')}
                        >
                            <option value="createdAt">Created Date</option>
                            <option value="activePeriodSeconds">Duration</option>
                        </select>
                        <Button variant="ghost" size="icon-sm" className="h-6 w-6" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                            {sortDir === 'asc' ? '↑' : '↓'}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Story grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="overflow-hidden">
                            <Skeleton className="h-44 w-full rounded-none" />
                            <div className="p-3">
                                <Skeleton className="h-4 w-3/4 mb-2" />
                                <Skeleton className="h-3 w-1/2" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : error ? (
                <Card className="p-6 text-sm text-zoru-danger-ink">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </div>
                </Card>
            ) : rows.length === 0 ? (
                <Card className="overflow-hidden">
                    <EmptyState
                        title="No stories yet"
                        description="Compose a story to post on a channel where your bot is an admin with can_post_stories, or via a registered business connection."
                        icon={<Clapperboard className="h-5 w-5" />}
                        action={
                            <Button
                                size="sm"
                                onClick={openCreate}
                                disabled={!projectId || bots.length === 0}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New story
                            </Button>
                        }
                    />
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {rows.map((row) => (
                            <StoryCard
                                key={row._id}
                                row={row}
                                onOpen={() => setDetailRow(row)}
                                onEdit={() => openEdit(row)}
                                onCancel={() => confirmCancel(row)}
                                onPostNow={() => setPostRow(row)}
                                onDeleteLocal={() => setDeleteRow(row)}
                                onDeleteOnTelegram={() => setTgDeleteRow(row)}
                            />
                        ))}
                    </div>
                    {/* Pagination */}
                    {data.total > PAGE_SIZE ? (
                        <div className="flex items-center justify-between rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 text-[12px] text-zoru-ink-muted">
                            <span>
                                {(page - 1) * PAGE_SIZE + 1}–
                                {(page - 1) * PAGE_SIZE + rows.length} of{' '}
                                {data.total}
                            </span>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={page <= 1}
                                    onClick={() =>
                                        setPage((p) => Math.max(1, p - 1))
                                    }
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                    Prev
                                </Button>
                                <span className="px-2">
                                    Page {page} / {totalPages}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!data.hasMore}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    Next
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </>
            )}

            {/* New / edit drawer */}
            <StoryEditorDrawer
                open={editorOpen}
                onOpenChange={setEditorOpen}
                editorForm={editorForm}
                setEditorForm={setEditorForm}
                editorErr={editorErr}
                savingEditor={savingEditor}
                bots={bots}
                channels={channels}
                businessConnections={businessConnections}
                onSave={saveEditor}
                onCancel={() => setEditorOpen(false)}
            />

            {/* Detail drawer */}
            <ZoruDrawer
                open={!!detailRow}
                onOpenChange={(v) => !v && setDetailRow(null)}
            >
                <ZoruDrawerContent className="max-h-[92vh] overflow-y-auto">
                    {detailRow ? (
                        <StoryDetail
                            row={detailRow}
                            onClose={() => setDetailRow(null)}
                            onEdit={() => {
                                setDetailRow(null);
                                openEdit(detailRow);
                            }}
                            onPost={() => setPostRow(detailRow)}
                            onCancel={() => confirmCancel(detailRow)}
                            onDeleteLocal={() => setDeleteRow(detailRow)}
                            onDeleteOnTelegram={() => setTgDeleteRow(detailRow)}
                        />
                    ) : null}
                </ZoruDrawerContent>
            </ZoruDrawer>

            {/* Business connections side panel */}
            <ZoruDrawer open={bcOpen} onOpenChange={setBcOpen}>
                <ZoruDrawerContent className="max-h-[92vh] overflow-y-auto">
                    <ZoruDrawerHeader>
                        <ZoruDrawerTitle>Business connections</ZoruDrawerTitle>
                        <ZoruDrawerDescription>
                            Telegram delivers a <code>business_connection_id</code>
                            via webhook when a Premium user authorises your bot.
                            Register it here so you can post stories on their
                            behalf.
                        </ZoruDrawerDescription>
                    </ZoruDrawerHeader>
                    <div className="px-6 pb-6">
                        <div className="mb-3 flex justify-end">
                            <Button
                                size="sm"
                                onClick={() => setBcAddOpen(true)}
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Add connection
                            </Button>
                        </div>
                        {businessConnections.length === 0 ? (
                            <EmptyState
                                title="No connections yet"
                                description="Paste the business_connection_id Telegram delivered to your webhook."
                                icon={<BookOpen className="h-5 w-5" />}
                            />
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {businessConnections.map((c) => (
                                    <li
                                        key={c._id}
                                        className={`flex items-center justify-between rounded-md border p-3 ${
                                            selectedBcId === c._id
                                                ? 'border-zoru-ink bg-zoru-surface-2'
                                                : 'border-zoru-line'
                                        }`}
                                        onClick={() => setSelectedBcId(c._id)}
                                    >
                                        <div>
                                            <p className="font-mono text-[13px] text-zoru-ink">
                                                {c.connectionId}
                                            </p>
                                            <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                                                Bot {c.botId.slice(-6)}
                                                {c.userId
                                                    ? ` · user ${c.userId}`
                                                    : ''}
                                                {c.canReply ? ' · can reply' : ''}
                                                {c.isEnabled ? ' · enabled' : ' · disabled'}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {selectedBcId === c._id &&
                                            starBalance ? (
                                                <Badge variant="info">
                                                    <Sparkles className="h-3 w-3" />
                                                    {starBalance.amount} stars
                                                </Badge>
                                            ) : null}
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    void deleteBusinessConnection(
                                                        c._id,
                                                    );
                                                }}
                                                aria-label="Remove"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </ZoruDrawerContent>
            </ZoruDrawer>

            {/* Add business connection dialog */}
            <Dialog open={bcAddOpen} onOpenChange={setBcAddOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Add business connection</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Paste the <code>business_connection_id</code> from
                            the webhook update.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-3">
                        <Field label="Bot">
                            <Select
                                value={bcAddBot}
                                onValueChange={setBcAddBot}
                            >
                                <ZoruSelectTrigger>
                                    <ZoruSelectValue placeholder="Pick a bot" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {bots.map((b) => (
                                        <ZoruSelectItem
                                            key={b._id}
                                            value={b._id}
                                        >
                                            {b.username || b.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </Select>
                        </Field>
                        <Field label="Connection id">
                            <Input
                                value={bcAddConnectionId}
                                onChange={(e) =>
                                    setBcAddConnectionId(e.target.value)
                                }
                                placeholder="bcid_XXXX"
                            />
                        </Field>
                    </div>
                    <ZoruDialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setBcAddOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={saveBusinessConnection}
                            disabled={
                                bcSaving ||
                                !bcAddBot ||
                                !bcAddConnectionId.trim()
                            }
                        >
                            {bcSaving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Save
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Confirm: post now */}
            <Dialog
                open={!!postRow}
                onOpenChange={(v) => !v && setPostRow(null)}
            >
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Post story to Telegram?</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            This calls <code>postStory</code> immediately. The
                            story will be visible for{' '}
                            {postRow
                                ? Math.round(
                                      postRow.activePeriodSeconds / 3600,
                                  )
                                : ''}{' '}
                            hours.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPostRow(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={() =>
                                postRow && void confirmPostNow(postRow)
                            }
                        >
                            <Send className="h-3.5 w-3.5" />
                            Post now
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Confirm: delete local */}
            <Dialog
                open={!!deleteRow}
                onOpenChange={(v) => !v && setDeleteRow(null)}
            >
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Delete local record?</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            The Telegram story (if any) stays where it is —
                            this only removes the SabNode record.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteRow(null)}
                        >
                            Cancel
                        </Button>
                        <Button size="sm" onClick={confirmDeleteLocal}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete record
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>

            {/* Confirm: delete on Telegram */}
            <Dialog
                open={!!tgDeleteRow}
                onOpenChange={(v) => !v && setTgDeleteRow(null)}
            >
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Remove story from Telegram?</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            This calls <code>deleteStory</code>. Cannot be
                            undone — viewers will no longer see the story.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <ZoruDialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTgDeleteRow(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={confirmDeleteOnTelegram}
                        >
                            <XCircle className="h-3.5 w-3.5" />
                            Delete on Telegram
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Subcomponents
// ---------------------------------------------------------------------------

function Section({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="flex flex-col gap-3">
            <div>
                <h3 className="text-[14px] font-medium text-zoru-ink">
                    {title}
                </h3>
                {description ? (
                    <p className="mt-0.5 text-[12px] text-zoru-ink-muted">
                        {description}
                    </p>
                ) : null}
            </div>
            <div>{children}</div>
        </section>
    );
}

function Field({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                {label}
            </span>
            {children}
        </label>
    );
}

function KpiCard({
    label,
    value,
    loading,
}: {
    label: string;
    value: string;
    loading: boolean;
}) {
    return (
        <Card>
            <ZoruCardContent className="flex flex-col gap-1 pt-5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">
                    {label}
                </p>
                {loading ? (
                    <Skeleton className="h-7 w-24" />
                ) : (
                    <p className="text-2xl font-semibold tracking-tight text-zoru-ink">
                        {value}
                    </p>
                )}
            </ZoruCardContent>
        </Card>
    );
}

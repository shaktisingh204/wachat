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
} from '@/components/zoruui';
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

const PERIOD_OPTIONS: { value: StoryActivePeriodSeconds; label: string }[] = [
    { value: 21600, label: '6 hours' },
    { value: 43200, label: '12 hours' },
    { value: 86400, label: '24 hours' },
    { value: 172800, label: '48 hours' },
];

const STATUS_VARIANT: Record<
    StoryStatus,
    'success' | 'warning' | 'ghost' | 'info' | 'danger' | 'secondary'
> = {
    draft: 'ghost',
    scheduled: 'warning',
    posted: 'success',
    expired: 'secondary',
    failed: 'danger',
    deleted: 'danger',
};

function fmtDate(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function fmtRelative(iso?: string): string {
    if (!iso) return '';
    try {
        const ms = new Date(iso).getTime() - Date.now();
        const min = Math.round(ms / 60000);
        if (Math.abs(min) < 60) return min === 0 ? 'now' : `${min > 0 ? 'in' : ''} ${Math.abs(min)} min${min > 0 ? '' : ' ago'}`;
        const hours = Math.round(min / 60);
        if (Math.abs(hours) < 48) return `${hours > 0 ? 'in' : ''} ${Math.abs(hours)} h${hours > 0 ? '' : ' ago'}`;
        const days = Math.round(hours / 24);
        return `${days > 0 ? 'in' : ''} ${Math.abs(days)} d${days > 0 ? '' : ' ago'}`;
    } catch {
        return '';
    }
}

interface AreaDraft extends StoryArea {
    /** Local-only id so React can key the list. */
    _key: string;
}

interface FormState {
    storyId?: string;
    botId: string;
    type: StoryType;
    channelId: string;
    businessConnectionId: string;
    mediaKind: StoryMediaKind;
    mediaUrl: string;
    mediaSabFileId: string;
    caption: string;
    parseMode: string;
    areas: AreaDraft[];
    privacyKind: StoryPrivacyKind;
    userIdsRaw: string;
    activePeriod: StoryActivePeriodSeconds;
    postToChatPage: boolean;
    protectContent: boolean;
    scheduleMode: 'now' | 'later';
    scheduledDate?: Date;
    scheduledTime: string;
}

const EMPTY_FORM: FormState = {
    botId: '',
    type: 'channel',
    channelId: '',
    businessConnectionId: '',
    mediaKind: 'photo',
    mediaUrl: '',
    mediaSabFileId: '',
    caption: '',
    parseMode: '',
    areas: [],
    privacyKind: 'public',
    userIdsRaw: '',
    activePeriod: 86400,
    postToChatPage: false,
    protectContent: false,
    scheduleMode: 'now',
    scheduledDate: undefined,
    scheduledTime: '12:00',
};

function combineDateTime(date: Date | undefined, time: string): Date | null {
    if (!date) return null;
    const [hh, mm] = time.split(':').map((x) => Number(x));
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
}

function makeAreaKey(): string {
    return `area-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseUserIds(raw: string): number[] {
    return raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0);
}

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

    const reloadStories = React.useCallback(async () => {
        if (!projectId) {
            setData({ stories: [], total: 0, hasMore: false });
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
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
        if (res.error) setError(res.error);
        setLoading(false);
    }, [projectId, page, statusFilter, typeFilter, botFilter, searchDebounced]);

    const reloadAnalytics = React.useCallback(async () => {
        if (!projectId) {
            setAnalytics(null);
            setAnalyticsLoading(false);
            return;
        }
        setAnalyticsLoading(true);
        const res = await getTelegramStoriesAnalyticsAction({ projectId });
        setAnalytics(res);
        setAnalyticsLoading(false);
    }, [projectId]);

    const reloadBots = React.useCallback(async () => {
        if (!projectId) {
            setBots([]);
            return;
        }
        const res = await listTelegramBotsAction({
            projectId,
            pageSize: 100,
        });
        setBots(res.bots ?? []);
    }, [projectId]);

    const reloadChannels = React.useCallback(async () => {
        if (!projectId) {
            setChannels([]);
            return;
        }
        const res = await listChannels({ projectId, limit: 200 });
        setChannels(res.channels ?? []);
    }, [projectId]);

    const reloadBusinessConnections = React.useCallback(async () => {
        if (!projectId) {
            setBusinessConnections([]);
            return;
        }
        const res =
            await listTelegramStoryBusinessConnectionsAction(projectId);
        setBusinessConnections(res.connections ?? []);
    }, [projectId]);

    React.useEffect(() => {
        void reloadStories();
    }, [reloadStories]);
    React.useEffect(() => {
        void reloadAnalytics();
    }, [reloadAnalytics]);
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

    const rows = data.stories;

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

            {!projectId ? (
                <Card className="p-6">
                    <div className="flex items-center gap-2 text-zoru-ink-muted">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">
                            Select a project to manage Telegram stories.
                        </span>
                    </div>
                </Card>
            ) : null}

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
                </div>
            </Card>

            {/* Story grid */}
            {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i}>
                            <Skeleton className="h-44 w-full" />
                            <div className="p-3">
                                <Skeleton className="h-4 w-3/4" />
                                <Skeleton className="mt-2 h-3 w-1/2" />
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
            <ZoruDrawer open={editorOpen} onOpenChange={setEditorOpen}>
                <ZoruDrawerContent className="max-h-[92vh] overflow-y-auto">
                    <ZoruDrawerHeader>
                        <ZoruDrawerTitle>
                            {editorForm.storyId ? 'Edit story' : 'New story'}
                        </ZoruDrawerTitle>
                        <ZoruDrawerDescription>
                            Stories last 6–48 hours on Telegram. Use 24h unless
                            you have a reason to do otherwise.
                        </ZoruDrawerDescription>
                    </ZoruDrawerHeader>
                    <div className="grid gap-6 px-6 pb-2">
                        {/* 1. Basics */}
                        <Section
                            title="1. Basics"
                            description="Pick the bot and where this story should appear."
                        >
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label="Bot">
                                    <Select
                                        value={editorForm.botId}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                botId: v,
                                            }))
                                        }
                                        disabled={!!editorForm.storyId}
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue placeholder="Choose a bot" />
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
                                <Field label="Story type">
                                    <Select
                                        value={editorForm.type}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                type: v as StoryType,
                                            }))
                                        }
                                        disabled={!!editorForm.storyId}
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="channel">
                                                Channel
                                            </ZoruSelectItem>
                                            <ZoruSelectItem value="business">
                                                Business account
                                            </ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                                {editorForm.type === 'channel' ? (
                                    <div className="sm:col-span-2">
                                        <Field label="Channel">
                                            <Select
                                                value={editorForm.channelId}
                                                onValueChange={(v) =>
                                                    setEditorForm((f) => ({
                                                        ...f,
                                                        channelId: v,
                                                    }))
                                                }
                                                disabled={!!editorForm.storyId}
                                            >
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue placeholder="Pick a channel" />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    {channels.length === 0 ? (
                                                        <div className="px-3 py-2 text-[12px] text-zoru-ink-muted">
                                                            No channels —
                                                            connect a channel
                                                            first in
                                                            /dashboard/telegram/channels.
                                                        </div>
                                                    ) : (
                                                        channels
                                                            .filter(
                                                                (c) =>
                                                                    !editorForm.botId ||
                                                                    c.botId ===
                                                                        editorForm.botId,
                                                            )
                                                            .map((c) => (
                                                                <ZoruSelectItem
                                                                    key={c._id}
                                                                    value={c._id}
                                                                >
                                                                    {c.title} ({c.chatId})
                                                                </ZoruSelectItem>
                                                            ))
                                                    )}
                                                </ZoruSelectContent>
                                            </Select>
                                        </Field>
                                    </div>
                                ) : (
                                    <div className="sm:col-span-2">
                                        <Field label="Business connection">
                                            <Select
                                                value={
                                                    editorForm.businessConnectionId
                                                }
                                                onValueChange={(v) =>
                                                    setEditorForm((f) => ({
                                                        ...f,
                                                        businessConnectionId: v,
                                                    }))
                                                }
                                                disabled={!!editorForm.storyId}
                                            >
                                                <ZoruSelectTrigger>
                                                    <ZoruSelectValue placeholder="Pick a connection" />
                                                </ZoruSelectTrigger>
                                                <ZoruSelectContent>
                                                    {businessConnections
                                                        .filter(
                                                            (c) =>
                                                                !editorForm.botId ||
                                                                c.botId ===
                                                                    editorForm.botId,
                                                        )
                                                        .map((c) => (
                                                            <ZoruSelectItem
                                                                key={c._id}
                                                                value={
                                                                    c.connectionId
                                                                }
                                                            >
                                                                {c.connectionId}
                                                                {c.userId
                                                                    ? ` (user ${c.userId})`
                                                                    : ''}
                                                            </ZoruSelectItem>
                                                        ))}
                                                </ZoruSelectContent>
                                            </Select>
                                        </Field>
                                    </div>
                                )}
                            </div>
                        </Section>

                        <Separator />

                        {/* 2. Content */}
                        <Section
                            title="2. Content"
                            description="Media + caption. Media is picked from your SabFiles library."
                        >
                            <div className="grid gap-3">
                                <Field label="Media kind">
                                    <RadioGroup
                                        value={editorForm.mediaKind}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                mediaKind: v as StoryMediaKind,
                                                mediaUrl: '',
                                                mediaSabFileId: '',
                                            }))
                                        }
                                        className="flex gap-3"
                                    >
                                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zoru-line px-3 py-2 text-sm">
                                            <ZoruRadioGroupItem value="photo" />
                                            <ImageIcon className="h-3.5 w-3.5" />
                                            Photo
                                        </label>
                                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zoru-line px-3 py-2 text-sm">
                                            <ZoruRadioGroupItem value="video" />
                                            <VideoIcon className="h-3.5 w-3.5" />
                                            Video
                                        </label>
                                    </RadioGroup>
                                </Field>

                                <Field
                                    label={
                                        editorForm.mediaKind === 'photo'
                                            ? 'Photo from SabFiles'
                                            : 'Video from SabFiles'
                                    }
                                >
                                    <SabFileUrlInput
                                        value={editorForm.mediaUrl}
                                        onChange={(value, pick) => {
                                            setEditorForm((f) => ({
                                                ...f,
                                                mediaUrl: value,
                                                mediaSabFileId: pick?.id ?? f.mediaSabFileId,
                                            }));
                                        }}
                                        accept={
                                            editorForm.mediaKind === 'photo'
                                                ? 'image'
                                                : 'video'
                                        }
                                        pickerTitle="Pick story media"
                                    />
                                    {!editorForm.mediaSabFileId && (
                                        <span className="mt-1 text-[11.5px] text-zoru-ink-muted">
                                            Telegram fetches the file directly,
                                            so it must be in your library.
                                        </span>
                                    )}
                                </Field>

                                <Field label="Caption">
                                    <Textarea
                                        rows={3}
                                        value={editorForm.caption}
                                        onChange={(e) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                caption: e.target.value,
                                            }))
                                        }
                                        placeholder="Story caption — optional"
                                    />
                                </Field>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label="Parse mode">
                                        <Select
                                            value={editorForm.parseMode || 'none'}
                                            onValueChange={(v) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    parseMode:
                                                        v === 'none' ? '' : v,
                                                }))
                                            }
                                        >
                                            <ZoruSelectTrigger>
                                                <ZoruSelectValue />
                                            </ZoruSelectTrigger>
                                            <ZoruSelectContent>
                                                <ZoruSelectItem value="none">
                                                    None
                                                </ZoruSelectItem>
                                                <ZoruSelectItem value="HTML">
                                                    HTML
                                                </ZoruSelectItem>
                                                <ZoruSelectItem value="MarkdownV2">
                                                    MarkdownV2
                                                </ZoruSelectItem>
                                                <ZoruSelectItem value="Markdown">
                                                    Markdown (legacy)
                                                </ZoruSelectItem>
                                            </ZoruSelectContent>
                                        </Select>
                                    </Field>
                                </div>

                                {/* Areas builder */}
                                <div>
                                    <div className="mb-2 flex items-center justify-between">
                                        <Label className="text-[11.5px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                                            Interactive areas
                                        </Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    areas: [
                                                        ...f.areas,
                                                        {
                                                            _key: makeAreaKey(),
                                                            type:
                                                                'suggested_reaction',
                                                            position: {
                                                                x_percentage: 50,
                                                                y_percentage: 50,
                                                                width_percentage: 20,
                                                                height_percentage: 20,
                                                                rotation_angle: 0,
                                                            },
                                                            payload: {},
                                                        },
                                                    ],
                                                }))
                                            }
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add area
                                        </Button>
                                    </div>
                                    {editorForm.areas.length === 0 ? (
                                        <p className="text-[12px] text-zoru-ink-muted">
                                            None. Areas can layer
                                            reactions, locations, links, or
                                            unique gifts on top of the media.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {editorForm.areas.map((a, idx) => (
                                                <AreaEditor
                                                    key={a._key}
                                                    area={a}
                                                    onChange={(next) =>
                                                        setEditorForm((f) => {
                                                            const areas = [
                                                                ...f.areas,
                                                            ];
                                                            areas[idx] = next;
                                                            return {
                                                                ...f,
                                                                areas,
                                                            };
                                                        })
                                                    }
                                                    onRemove={() =>
                                                        setEditorForm((f) => ({
                                                            ...f,
                                                            areas: f.areas.filter(
                                                                (_, i) =>
                                                                    i !== idx,
                                                            ),
                                                        }))
                                                    }
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Section>

                        <Separator />

                        {/* 3. Privacy */}
                        <Section
                            title="3. Privacy"
                            description="Who can see this story."
                        >
                            <div className="grid gap-3">
                                <Field label="Audience">
                                    <Select
                                        value={editorForm.privacyKind}
                                        onValueChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                privacyKind:
                                                    v as StoryPrivacyKind,
                                            }))
                                        }
                                    >
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {PRIVACY_OPTIONS.map((o) => (
                                                <ZoruSelectItem
                                                    key={o.value}
                                                    value={o.value}
                                                >
                                                    {o.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </Select>
                                </Field>
                                {editorForm.privacyKind === 'selected' ? (
                                    <Field label="User ids (max 200)">
                                        <Textarea
                                            rows={3}
                                            value={editorForm.userIdsRaw}
                                            onChange={(e) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    userIdsRaw: e.target.value,
                                                }))
                                            }
                                            placeholder="1234567, 9876543"
                                        />
                                        <span className="mt-1 text-[11.5px] text-zoru-ink-muted">
                                            Comma- or whitespace-separated
                                            numeric Telegram user ids.
                                        </span>
                                    </Field>
                                ) : null}
                            </div>
                        </Section>

                        <Separator />

                        {/* 4. Options */}
                        <Section
                            title="4. Options"
                            description="How long the story stays live and whether to pin it to the chat page."
                        >
                            <div className="grid gap-3">
                                <Field label="Active period">
                                    <div className="flex flex-wrap gap-2">
                                        {PERIOD_OPTIONS.map((p) => {
                                            const active =
                                                editorForm.activePeriod ===
                                                p.value;
                                            return (
                                                <button
                                                    type="button"
                                                    key={p.value}
                                                    onClick={() =>
                                                        setEditorForm((f) => ({
                                                            ...f,
                                                            activePeriod: p.value,
                                                        }))
                                                    }
                                                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                                                        active
                                                            ? 'border-zoru-ink bg-zoru-ink text-zoru-on-primary'
                                                            : 'border-zoru-line text-zoru-ink-muted hover:text-zoru-ink'
                                                    }`}
                                                >
                                                    {p.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </Field>
                                <div className="flex items-center justify-between rounded-md border border-zoru-line p-3">
                                    <div>
                                        <p className="text-sm text-zoru-ink">
                                            Pin to chat page
                                        </p>
                                        <p className="text-[12px] text-zoru-ink-muted">
                                            Story stays on the chat page after
                                            it expires from the story feed.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={editorForm.postToChatPage}
                                        onCheckedChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                postToChatPage: v,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="flex items-center justify-between rounded-md border border-zoru-line p-3">
                                    <div>
                                        <p className="text-sm text-zoru-ink">
                                            Protect content
                                        </p>
                                        <p className="text-[12px] text-zoru-ink-muted">
                                            Disable forwarding and saving.
                                        </p>
                                    </div>
                                    <Switch
                                        checked={editorForm.protectContent}
                                        onCheckedChange={(v) =>
                                            setEditorForm((f) => ({
                                                ...f,
                                                protectContent: v,
                                            }))
                                        }
                                    />
                                </div>
                            </div>
                        </Section>

                        <Separator />

                        {/* 5. Schedule */}
                        <Section
                            title="5. Schedule"
                            description="Post immediately on save, or pick a future time."
                        >
                            <RadioGroup
                                value={editorForm.scheduleMode}
                                onValueChange={(v) =>
                                    setEditorForm((f) => ({
                                        ...f,
                                        scheduleMode: v as 'now' | 'later',
                                    }))
                                }
                                className="flex gap-3"
                            >
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zoru-line px-3 py-2 text-sm">
                                    <ZoruRadioGroupItem value="now" />
                                    Save as draft / Post now
                                </label>
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-zoru-line px-3 py-2 text-sm">
                                    <ZoruRadioGroupItem value="later" />
                                    Schedule for later
                                </label>
                            </RadioGroup>
                            {editorForm.scheduleMode === 'later' ? (
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <Field label="Date">
                                        <DatePicker
                                            value={editorForm.scheduledDate}
                                            onChange={(d) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    scheduledDate: d,
                                                }))
                                            }
                                        />
                                    </Field>
                                    <Field label="Time (24h)">
                                        <Input
                                            type="time"
                                            value={editorForm.scheduledTime}
                                            onChange={(e) =>
                                                setEditorForm((f) => ({
                                                    ...f,
                                                    scheduledTime: e.target.value,
                                                }))
                                            }
                                        />
                                    </Field>
                                </div>
                            ) : null}
                        </Section>

                        {editorErr ? (
                            <p className="rounded-md border border-zoru-danger-line/50 bg-zoru-danger-surface px-3 py-2 text-[12.5px] text-zoru-danger-ink">
                                {editorErr}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex justify-end gap-2 px-6 pb-6 pt-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditorOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={saveEditor}
                            disabled={savingEditor}
                        >
                            {savingEditor ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {editorForm.storyId ? 'Save changes' : 'Create'}
                        </Button>
                    </div>
                </ZoruDrawerContent>
            </ZoruDrawer>

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

function StoryCard({
    row,
    onOpen,
    onEdit,
    onCancel,
    onPostNow,
    onDeleteLocal,
    onDeleteOnTelegram,
}: {
    row: StoryRow;
    onOpen: () => void;
    onEdit: () => void;
    onCancel: () => void;
    onPostNow: () => void;
    onDeleteLocal: () => void;
    onDeleteOnTelegram: () => void;
}) {
    const isPhoto = row.content.mediaKind === 'photo';
    const isPosted = row.status === 'posted';
    const isFinal = isPosted || row.status === 'expired' || row.status === 'deleted';
    const timestamp = isPosted
        ? `Posted ${fmtRelative(row.postedAt)}`
        : row.status === 'scheduled'
            ? `Scheduled ${fmtRelative(row.scheduledAt)}`
            : `Created ${fmtRelative(row.createdAt)}`;

    return (
        <Card className="overflow-hidden">
            <div
                className="relative flex h-44 w-full cursor-pointer items-center justify-center bg-zoru-surface-2"
                onClick={onOpen}
            >
                {isPhoto ? (
                    <ImageIcon className="h-8 w-8 text-zoru-ink-subtle" />
                ) : (
                    <VideoIcon className="h-8 w-8 text-zoru-ink-subtle" />
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                        {row.status}
                    </Badge>
                    <Badge variant="ghost">{row.type}</Badge>
                </div>
                <div className="absolute right-2 top-2">
                    <DropdownMenu>
                        <ZoruDropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Actions"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </ZoruDropdownMenuTrigger>
                        <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem onClick={onOpen}>
                                Open
                            </ZoruDropdownMenuItem>
                            {!isPosted && row.status !== 'deleted' ? (
                                <>
                                    <ZoruDropdownMenuItem onClick={onEdit}>
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                    </ZoruDropdownMenuItem>
                                    <ZoruDropdownMenuItem onClick={onPostNow}>
                                        <Send className="h-3.5 w-3.5" /> Post now
                                    </ZoruDropdownMenuItem>
                                </>
                            ) : null}
                            {row.status === 'scheduled' ? (
                                <ZoruDropdownMenuItem onClick={onCancel}>
                                    <X className="h-3.5 w-3.5" /> Cancel
                                </ZoruDropdownMenuItem>
                            ) : null}
                            {isPosted ? (
                                <ZoruDropdownMenuItem
                                    onClick={onDeleteOnTelegram}
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Delete on Telegram
                                </ZoruDropdownMenuItem>
                            ) : null}
                            <ZoruDropdownMenuSeparator />
                            <ZoruDropdownMenuItem onClick={onDeleteLocal}>
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete local
                            </ZoruDropdownMenuItem>
                        </ZoruDropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3">
                <p className="line-clamp-2 text-[13px] text-zoru-ink">
                    {row.content.caption || (
                        <span className="italic text-zoru-ink-muted">
                            No caption
                        </span>
                    )}
                </p>
                <p className="text-[11.5px] text-zoru-ink-muted">{timestamp}</p>
                {isFinal && row.errorMessage ? (
                    <p className="line-clamp-2 text-[11.5px] text-zoru-danger-ink">
                        {row.errorMessage}
                    </p>
                ) : null}
            </div>
        </Card>
    );
}

function StoryDetail({
    row,
    onClose,
    onEdit,
    onPost,
    onCancel,
    onDeleteLocal,
    onDeleteOnTelegram,
}: {
    row: StoryRow;
    onClose: () => void;
    onEdit: () => void;
    onPost: () => void;
    onCancel: () => void;
    onDeleteLocal: () => void;
    onDeleteOnTelegram: () => void;
}) {
    const isPosted = row.status === 'posted';
    return (
        <>
            <ZoruDrawerHeader>
                <ZoruDrawerTitle>Story · {row.type}</ZoruDrawerTitle>
                <ZoruDrawerDescription>
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                        {row.status}
                    </Badge>{' '}
                    {isPosted ? (
                        <>
                            posted {fmtRelative(row.postedAt)}, expires{' '}
                            {fmtRelative(row.expiresAt)}.
                        </>
                    ) : row.status === 'scheduled' ? (
                        <>
                            scheduled for {fmtDate(row.scheduledAt)} (
                            {fmtRelative(row.scheduledAt)}).
                        </>
                    ) : (
                        <>created {fmtRelative(row.createdAt)}.</>
                    )}
                </ZoruDrawerDescription>
            </ZoruDrawerHeader>
            <div className="grid gap-4 px-6 pb-6">
                <div className="flex h-56 w-full items-center justify-center rounded-md border border-zoru-line bg-zoru-surface-2">
                    {row.content.mediaKind === 'photo' ? (
                        <ImageIcon className="h-10 w-10 text-zoru-ink-subtle" />
                    ) : (
                        <VideoIcon className="h-10 w-10 text-zoru-ink-subtle" />
                    )}
                </div>
                <div className="grid gap-2 text-sm">
                    <Row label="Caption">
                        {row.content.caption || '—'}
                    </Row>
                    <Row label="Parse mode">
                        {row.content.parseMode || '—'}
                    </Row>
                    <Row label="Active period">
                        {Math.round(row.activePeriodSeconds / 3600)} h
                    </Row>
                    <Row label="Privacy">{row.privacy.kind}</Row>
                    {row.privacy.kind === 'selected' ? (
                        <Row label="User ids">
                            {(row.privacy.userIds ?? []).join(', ')}
                        </Row>
                    ) : null}
                    <Row label="Areas">
                        {row.content.areas?.length ?? 0}
                    </Row>
                    <Row label="Pin to chat page">
                        {row.postToChatPage ? 'Yes' : 'No'}
                    </Row>
                    <Row label="Protect content">
                        {row.protectContent ? 'Yes' : 'No'}
                    </Row>
                    <Row label="Telegram story id">
                        {row.telegramStoryId ?? '—'}
                    </Row>
                    <Row label="Target">
                        {row.type === 'channel'
                            ? row.channelId
                            : row.businessConnectionId}
                    </Row>
                    {row.errorMessage ? (
                        <Row label="Last error">
                            <span className="text-zoru-danger-ink">
                                {row.errorMessage}
                            </span>
                        </Row>
                    ) : null}
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Close
                    </Button>
                    {!isPosted && row.status !== 'deleted' ? (
                        <>
                            <Button size="sm" variant="outline" onClick={onEdit}>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                            </Button>
                            <Button size="sm" onClick={onPost}>
                                <Send className="h-3.5 w-3.5" />
                                Post now
                            </Button>
                        </>
                    ) : null}
                    {row.status === 'scheduled' ? (
                        <Button size="sm" variant="outline" onClick={onCancel}>
                            <X className="h-3.5 w-3.5" />
                            Cancel
                        </Button>
                    ) : null}
                    {isPosted ? (
                        <>
                            <Button size="sm" variant="outline" onClick={onEdit}>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit on Telegram
                            </Button>
                            <Button size="sm" onClick={onDeleteOnTelegram}>
                                <XCircle className="h-3.5 w-3.5" />
                                Delete on Telegram
                            </Button>
                        </>
                    ) : null}
                    <Button size="sm" variant="ghost" onClick={onDeleteLocal}>
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete record
                    </Button>
                </div>
            </div>
        </>
    );
}

function Row({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid grid-cols-[180px_1fr] gap-3 border-b border-zoru-line/40 py-1.5 last:border-b-0">
            <span className="text-[12px] uppercase tracking-[0.08em] text-zoru-ink-muted">
                {label}
            </span>
            <span className="text-zoru-ink">{children}</span>
        </div>
    );
}

function AreaEditor({
    area,
    onChange,
    onRemove,
}: {
    area: AreaDraft;
    onChange: (next: AreaDraft) => void;
    onRemove: () => void;
}) {
    const pos = (area.position ?? {}) as Record<string, number>;
    function patchPos(patch: Partial<Record<string, number>>) {
        onChange({
            ...area,
            position: { ...pos, ...patch },
        });
    }
    return (
        <div className="rounded-md border border-zoru-line p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <Select
                    value={area.type || 'suggested_reaction'}
                    onValueChange={(v) => onChange({ ...area, type: v })}
                >
                    <ZoruSelectTrigger className="w-[200px]">
                        <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="suggested_reaction">
                            Reaction
                        </ZoruSelectItem>
                        <ZoruSelectItem value="location">Location</ZoruSelectItem>
                        <ZoruSelectItem value="link">Link</ZoruSelectItem>
                        <ZoruSelectItem value="weather">Weather</ZoruSelectItem>
                        <ZoruSelectItem value="unique_gift">
                            Unique gift
                        </ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRemove}
                    aria-label="Remove area"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <NumField
                    label="x%"
                    value={pos.x_percentage}
                    onChange={(v) => patchPos({ x_percentage: v })}
                />
                <NumField
                    label="y%"
                    value={pos.y_percentage}
                    onChange={(v) => patchPos({ y_percentage: v })}
                />
                <NumField
                    label="w%"
                    value={pos.width_percentage}
                    onChange={(v) => patchPos({ width_percentage: v })}
                />
                <NumField
                    label="h%"
                    value={pos.height_percentage}
                    onChange={(v) => patchPos({ height_percentage: v })}
                />
                <NumField
                    label="rot°"
                    value={pos.rotation_angle}
                    onChange={(v) => patchPos({ rotation_angle: v })}
                />
            </div>
        </div>
    );
}

function NumField({
    label,
    value,
    onChange,
}: {
    label: string;
    value?: number;
    onChange: (v: number) => void;
}) {
    return (
        <label className="flex flex-col gap-0.5">
            <TelegramProjectGate />
            <span className="text-[10px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                {label}
            </span>
            <Input
                type="number"
                value={value ?? 0}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}

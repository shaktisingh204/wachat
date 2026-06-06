'use client';

import {
    Badge,
    Button,
    Card,
    CardBody,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    EmptyState,
    Field,
    Input,
    Label,
    PageHeader,
    PageEyebrow,
    PageHeading,
    PageTitle,
    PageDescription,
    PageActions,
    RadioGroup,
    RadioGroupItem,
    SegmentedControl,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Separator,
    Skeleton,
    StatCard,
    Table,
    TBody,
    Td,
    Th,
    THead,
    Tr,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
  XCircle,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Music,
  ChevronUp,
  ChevronDown,
  } from 'lucide-react';

/**
 * Telegram Broadcasts - multi-tenant broadcast composer + dispatcher.
 *
 * Mirrors the layout of `/dashboard/telegram/ads` (KPI cards, filter bar,
 * paginated table, bulk select, side drawer composer). The composer is a
 * single drawer with five logical sections (Basics, Message, Inline
 * Keyboard, Schedule, Preview) rather than a wizard route, per the
 * project rule.
 *
 * Media inputs go through `<SabFilePickerButton>` (per the SabFiles
 * policy, every file lives in SabFiles, no free-text URL paste).
 */

import * as React from 'react';

import { SabFilePickerButton } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import { listTelegramBots } from '@/app/actions/telegram.actions';
import type { BotRow as TelegramBotRow } from '@/lib/rust-client/telegram-bots';
import {
    analyticsAction,
    cancelBroadcastAction,
    createBroadcastAction,
    deleteBroadcastAction,
    duplicateBroadcastAction,
    exportDeliveriesCsvAction,
    getBroadcastAction,
    listBroadcastsAction,
    listDeliveriesAction,
    scheduleBroadcastAction,
    sendBroadcastNowAction,
    testBroadcastAction,
    updateBroadcastAction,
} from '@/app/actions/telegram-broadcasts.actions';
import type {
    AnalyticsResp,
    BroadcastInlineButton,
    BroadcastInlineKeyboard,
    BroadcastMediaItem,
    BroadcastMediaKind,
    BroadcastRow,
    BroadcastStatus,
    DeliveryRow,
} from '@/lib/rust-client/telegram-broadcasts';

// ---------------------------------------------------------------------------
//  Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

const STATUS_OPTIONS: { value: 'all' | BroadcastStatus; label: string }[] = [
    { value: 'all', label: 'All statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'sending', label: 'Sending' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_VARIANT: Record<
    BroadcastStatus,
    'success' | 'warning' | 'info' | 'secondary' | 'destructive' | 'default'
> = {
    draft: 'secondary',
    scheduled: 'info',
    sending: 'warning',
    completed: 'success',
    failed: 'destructive',
    cancelled: 'default',
};

const AUDIENCE_KINDS = [
    { value: 'all', label: 'All subscribers' },
    { value: 'segment', label: 'Saved segment' },
    { value: 'contactIds', label: 'Specific contacts' },
    { value: 'filter', label: 'Filter (tags / language / activity)' },
] as const;

type AudienceKind = (typeof AUDIENCE_KINDS)[number]['value'];

const MEDIA_KIND_LABEL: Record<BroadcastMediaKind, string> = {
    photo: 'Photo',
    video: 'Video',
    document: 'Document',
    audio: 'Audio',
};

const MEDIA_KIND_ICON: Record<BroadcastMediaKind, React.ComponentType<{ className?: string }>> = {
    photo: ImageIcon,
    video: VideoIcon,
    document: FileText,
    audio: Music,
};

const MEDIA_KIND_ACCEPT: Record<BroadcastMediaKind, 'image' | 'video' | 'document' | 'audio'> = {
    photo: 'image',
    video: 'video',
    document: 'document',
    audio: 'audio',
};

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function fmtNumber(n: number | undefined | null): string {
    if (n == null) return '0';
    return n.toLocaleString();
}

function fmtDateTime(iso?: string): string {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return iso;
    }
}

function fmtRelative(iso?: string): string {
    if (!iso) return '-';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function pct(num: number): string {
    return `${(num * 100).toFixed(1)}%`;
}

function audienceLabel(a: BroadcastRow['audience']): string {
    const kind = (a as any)?.kind ?? 'all';
    switch (kind) {
        case 'all':
            return 'All subscribers';
        case 'segment':
            return `Segment, ${(a as any)?.segmentId ?? ''}`;
        case 'contactIds': {
            const ids = (a as any)?.ids ?? [];
            return `${Array.isArray(ids) ? ids.length : 0} contact${
                ids.length === 1 ? '' : 's'
            }`;
        }
        case 'filter': {
            const f = (a as any)?.filter ?? {};
            const bits: string[] = [];
            if (Array.isArray(f.tags) && f.tags.length) bits.push(`tags:${f.tags.length}`);
            if (f.lang) bits.push(`lang:${f.lang}`);
            if (f.lastSeenAfter) bits.push(`active`);
            return bits.length ? `Filter, ${bits.join(', ')}` : 'Filter';
        }
        default:
            return String(kind);
    }
}

interface ComposerState {
    broadcastId?: string;
    name: string;
    botId: string;
    audienceKind: AudienceKind;
    segmentId: string;
    contactIds: string;
    filterTags: string;
    filterLang: string;
    text: string;
    parseMode: 'plain' | 'Markdown' | 'HTML';
    disableWebPagePreview: boolean;
    media: BroadcastMediaItem[];
    inlineKeyboard: BroadcastInlineKeyboard;
    sendChoice: 'now' | 'schedule';
    scheduledLocal: string;
}

function emptyComposer(): ComposerState {
    return {
        name: '',
        botId: '',
        audienceKind: 'all',
        segmentId: '',
        contactIds: '',
        filterTags: '',
        filterLang: '',
        text: '',
        parseMode: 'plain',
        disableWebPagePreview: false,
        media: [],
        inlineKeyboard: [],
        sendChoice: 'now',
        scheduledLocal: '',
    };
}

function composerFromRow(row: BroadcastRow): ComposerState {
    const audience = row.audience as any;
    const message = row.message as any;
    return {
        broadcastId: row._id,
        name: row.name,
        botId: row.botId,
        audienceKind: (audience?.kind ?? 'all') as AudienceKind,
        segmentId: audience?.segmentId ?? '',
        contactIds: Array.isArray(audience?.ids) ? audience.ids.join(', ') : '',
        filterTags: Array.isArray(audience?.filter?.tags)
            ? audience.filter.tags.join(', ')
            : '',
        filterLang: audience?.filter?.lang ?? '',
        text: message?.text ?? '',
        parseMode: (message?.parseMode ?? 'plain') as ComposerState['parseMode'],
        disableWebPagePreview: Boolean(message?.disableWebPagePreview),
        media: Array.isArray(row.media) ? (row.media as BroadcastMediaItem[]) : [],
        inlineKeyboard: Array.isArray(row.inlineKeyboard)
            ? (row.inlineKeyboard as BroadcastInlineKeyboard)
            : [],
        sendChoice: row.scheduledAt ? 'schedule' : 'now',
        scheduledLocal: row.scheduledAt ? toLocalDateTimeInput(row.scheduledAt) : '',
    };
}

function toLocalDateTimeInput(iso: string): string {
    try {
        const d = new Date(iso);
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
            d.getHours(),
        )}:${pad(d.getMinutes())}`;
    } catch {
        return '';
    }
}

function localDateTimeToIso(local: string): string | null {
    if (!local) return null;
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function buildAudience(c: ComposerState): Record<string, unknown> {
    switch (c.audienceKind) {
        case 'all':
            return { kind: 'all' };
        case 'segment':
            return { kind: 'segment', segmentId: c.segmentId.trim() };
        case 'contactIds':
            return {
                kind: 'contactIds',
                ids: c.contactIds
                    .split(/[\s,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean),
            };
        case 'filter':
            return {
                kind: 'filter',
                filter: {
                    tags: c.filterTags
                        ? c.filterTags
                              .split(/[\s,]+/)
                              .map((s) => s.trim())
                              .filter(Boolean)
                        : undefined,
                    lang: c.filterLang.trim() || undefined,
                },
            };
    }
}

function buildMessage(c: ComposerState) {
    return {
        text: c.text,
        parseMode: c.parseMode === 'plain' ? undefined : c.parseMode,
        disableWebPagePreview: c.disableWebPagePreview || undefined,
    };
}

// ---------------------------------------------------------------------------
//  Page
// ---------------------------------------------------------------------------

export default function TelegramBroadcastsPage() {
    const { activeProject } = useProject();
    const projectId = activeProject?._id?.toString() ?? '';
    const { toast } = useToast();

    // ── Data state ────────────────────────────────────────────────
    const [rows, setRows] = React.useState<BroadcastRow[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [cursors, setCursors] = React.useState<(string | undefined)[]>([undefined]);
    const [pageIdx, setPageIdx] = React.useState(0);
    const [nextCursor, setNextCursor] = React.useState<string | undefined>();

    const [bots, setBots] = React.useState<TelegramBotRow[]>([]);
    const [analytics, setAnalytics] = React.useState<AnalyticsResp | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = React.useState(true);

    // ── Filter state ──────────────────────────────────────────────
    const [search, setSearch] = React.useState('');
    const [debouncedSearch, setDebouncedSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'all' | BroadcastStatus>('all');
    const [botFilter, setBotFilter] = React.useState<'all' | string>('all');

    // ── Selection ─────────────────────────────────────────────────
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // ── Composer state ────────────────────────────────────────────
    const [composerOpen, setComposerOpen] = React.useState(false);
    const [composer, setComposer] = React.useState<ComposerState>(emptyComposer);
    const [composerErr, setComposerErr] = React.useState<string | null>(null);
    const [composerSaving, setComposerSaving] = React.useState(false);

    // ── Test send dialog ──────────────────────────────────────────
    const [testOpen, setTestOpen] = React.useState(false);
    const [testChatId, setTestChatId] = React.useState('');
    const [testSending, setTestSending] = React.useState(false);

    // ── Detail drawer ─────────────────────────────────────────────
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [detailRow, setDetailRow] = React.useState<BroadcastRow | null>(null);
    const [deliveries, setDeliveries] = React.useState<DeliveryRow[]>([]);
    const [deliveriesLoading, setDeliveriesLoading] = React.useState(false);
    const [deliveriesCursor, setDeliveriesCursor] = React.useState<string | undefined>();

    // ── Confirm dialogs ───────────────────────────────────────────
    const [deleteRow, setDeleteRow] = React.useState<BroadcastRow | null>(null);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    // Search debounce.
    React.useEffect(() => {
        const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(id);
    }, [search]);

    // Reset pagination when filters change.
    React.useEffect(() => {
        setCursors([undefined]);
        setPageIdx(0);
    }, [debouncedSearch, statusFilter, botFilter, projectId]);

    // ── Fetch list ────────────────────────────────────────────────
    const fetchList = React.useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        const res = await listBroadcastsAction({
            projectId,
            botId: botFilter === 'all' ? undefined : botFilter,
            status: statusFilter === 'all' ? undefined : statusFilter,
            search: debouncedSearch || undefined,
            limit: PAGE_SIZE,
            cursor: cursors[pageIdx],
        });
        setLoading(false);
        if (res.error) {
            setError(res.error);
            setRows([]);
            setNextCursor(undefined);
            return;
        }
        setError(null);
        setRows(res.broadcasts);
        setNextCursor(res.nextCursor);
    }, [projectId, botFilter, statusFilter, debouncedSearch, cursors, pageIdx]);

    React.useEffect(() => {
        void fetchList();
    }, [fetchList]);

    // Poll while any broadcast is in `sending` state so counters live-update.
    React.useEffect(() => {
        if (!rows.some((r) => r.status === 'sending')) return;
        const id = setInterval(fetchList, 3000);
        return () => clearInterval(id);
    }, [rows, fetchList]);

    // ── Fetch analytics ───────────────────────────────────────────
    const fetchAnalytics = React.useCallback(async () => {
        if (!projectId) return;
        setAnalyticsLoading(true);
        const res = await analyticsAction(projectId);
        setAnalyticsLoading(false);
        setAnalytics(res);
    }, [projectId]);
    React.useEffect(() => {
        void fetchAnalytics();
    }, [fetchAnalytics]);

    // ── Fetch bots ────────────────────────────────────────────────
    React.useEffect(() => {
        if (!projectId) return;
        void listTelegramBots(projectId).then((b) => setBots(b ?? []));
    }, [projectId]);

    // ── KPIs (derived) ────────────────────────────────────────────
    const kpis = React.useMemo(() => {
        const scheduledCount = rows.filter((r) => r.status === 'scheduled').length;
        const sendingCount = rows.filter((r) => r.status === 'sending').length;
        return {
            total: analytics?.totalBroadcasts ?? 0,
            scheduled: scheduledCount,
            sending: sendingCount,
            successRate: analytics?.successRate ?? 0,
        };
    }, [analytics, rows]);

    // ── Composer save ─────────────────────────────────────────────
    const openNewComposer = () => {
        setComposer({
            ...emptyComposer(),
            botId: bots[0]?._id ?? '',
        });
        setComposerErr(null);
        setComposerOpen(true);
    };
    const openEditComposer = async (row: BroadcastRow) => {
        setComposer(composerFromRow(row));
        setComposerErr(null);
        setComposerOpen(true);
    };

    const validateComposer = (): string | null => {
        if (!composer.name.trim()) return 'Name is required.';
        if (!composer.botId) return 'Pick a bot to send from.';
        if (!composer.text.trim()) return 'Message text is required.';
        if (composer.audienceKind === 'segment' && !composer.segmentId.trim()) {
            return 'Segment id is required.';
        }
        if (composer.audienceKind === 'contactIds' && !composer.contactIds.trim()) {
            return 'Add at least one chat id.';
        }
        if (composer.sendChoice === 'schedule' && !composer.scheduledLocal) {
            return 'Pick a date and time.';
        }
        return null;
    };

    const saveComposer = async (mode: 'save' | 'send' | 'schedule') => {
        const v = validateComposer();
        if (v) {
            setComposerErr(v);
            return;
        }
        setComposerErr(null);
        setComposerSaving(true);

        const body = {
            projectId,
            botId: composer.botId,
            name: composer.name.trim(),
            audience: buildAudience(composer),
            message: buildMessage(composer),
            media: composer.media.length ? composer.media : undefined,
            inlineKeyboard:
                composer.inlineKeyboard.length ? composer.inlineKeyboard : undefined,
        };

        // First, upsert the draft.
        let id = composer.broadcastId;
        if (id) {
            const res = await updateBroadcastAction(id, body);
            if (!res.success) {
                setComposerSaving(false);
                setComposerErr(res.error);
                return;
            }
        } else {
            const res = await createBroadcastAction(body);
            if (!res.success) {
                setComposerSaving(false);
                setComposerErr(res.error);
                return;
            }
            id = res.broadcastId;
        }

        if (!id) {
            setComposerSaving(false);
            setComposerErr('Could not resolve the new broadcast id.');
            return;
        }

        // Then, if the user asked for it, fire the dispatch / schedule.
        // `save` always stops at "draft saved", the user must explicitly
        // press "send" or "schedule" to leave the draft state.
        if (mode === 'send') {
            const res = await sendBroadcastNowAction(id, projectId);
            setComposerSaving(false);
            if (!res.success) {
                setComposerErr(res.error);
                return;
            }
            toast({ title: 'Broadcast queued', description: res.message });
        } else if (mode === 'schedule') {
            const iso = localDateTimeToIso(composer.scheduledLocal);
            if (!iso) {
                setComposerSaving(false);
                setComposerErr('Invalid schedule date.');
                return;
            }
            const res = await scheduleBroadcastAction(id, projectId, iso);
            setComposerSaving(false);
            if (!res.success) {
                setComposerErr(res.error);
                return;
            }
            toast({ title: 'Broadcast scheduled', description: res.message });
        } else {
            setComposerSaving(false);
            toast({ title: 'Saved', description: 'Draft saved.' });
        }

        setComposerOpen(false);
        await fetchList();
        await fetchAnalytics();
    };

    // ── Test send ─────────────────────────────────────────────────
    const runTestSend = async () => {
        if (!composer.broadcastId) {
            setComposerErr('Save the draft before sending a preview.');
            return;
        }
        const n = Number(testChatId);
        if (!Number.isFinite(n) || !Number.isInteger(n)) {
            toast({
                title: 'Invalid chat id',
                description: 'Chat id must be an integer.',
                variant: 'destructive',
            });
            return;
        }
        setTestSending(true);
        const res = await testBroadcastAction(composer.broadcastId, projectId, n);
        setTestSending(false);
        if (!res.success) {
            toast({
                title: 'Test failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        setTestOpen(false);
        toast({ title: 'Test sent', description: res.message });
    };

    // ── Row actions ───────────────────────────────────────────────
    const doDuplicate = async (row: BroadcastRow) => {
        const res = await duplicateBroadcastAction(row._id, projectId);
        if (!res.success) {
            toast({ title: 'Duplicate failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Duplicated', description: res.message });
        await fetchList();
    };

    const doCancel = async (row: BroadcastRow) => {
        const res = await cancelBroadcastAction(row._id, projectId);
        if (!res.success) {
            toast({ title: 'Cancel failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Cancelled', description: res.message });
        await fetchList();
    };

    const doSendNow = async (row: BroadcastRow) => {
        const res = await sendBroadcastNowAction(row._id, projectId);
        if (!res.success) {
            toast({ title: 'Send failed', description: res.error, variant: 'destructive' });
            return;
        }
        toast({ title: 'Sending', description: res.message });
        await fetchList();
    };

    const doDelete = async () => {
        if (!deleteRow) return;
        const res = await deleteBroadcastAction(deleteRow._id, projectId);
        if (!res.success) {
            toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
            setDeleteRow(null);
            return;
        }
        toast({ title: 'Deleted', description: res.message });
        setDeleteRow(null);
        setSelected((s) => {
            const next = new Set(s);
            next.delete(deleteRow._id);
            return next;
        });
        await fetchList();
        await fetchAnalytics();
    };

    const doBulkDelete = async () => {
        const ids = Array.from(selected);
        let okCount = 0;
        let failCount = 0;
        for (const id of ids) {
            const res = await deleteBroadcastAction(id, projectId);
            if (res.success) okCount += 1;
            else failCount += 1;
        }
        setBulkDeleteOpen(false);
        setSelected(new Set());
        toast({
            title: 'Bulk delete complete',
            description: `${okCount} deleted${failCount ? `, ${failCount} failed` : ''}`,
            variant: failCount ? 'destructive' : 'default',
        });
        await fetchList();
        await fetchAnalytics();
    };

    // ── Detail drawer ─────────────────────────────────────────────
    const openDetail = async (row: BroadcastRow) => {
        setDetailRow(row);
        setDetailOpen(true);
        setDeliveriesCursor(undefined);
        setDeliveries([]);
        await fetchDeliveries(row._id, undefined, true);
    };
    const fetchDeliveries = async (
        bid: string,
        cursor: string | undefined,
        reset: boolean,
    ) => {
        setDeliveriesLoading(true);
        const res = await listDeliveriesAction(bid, { projectId, cursor, limit: 100 });
        setDeliveriesLoading(false);
        if (res.error) {
            toast({
                title: 'Deliveries failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        setDeliveries((prev) => (reset ? res.deliveries : [...prev, ...res.deliveries]));
        setDeliveriesCursor(res.nextCursor);
    };

    // Poll detail row while sending.
    React.useEffect(() => {
        if (!detailRow || detailRow.status !== 'sending') return;
        const id = setInterval(async () => {
            const res = await getBroadcastAction(detailRow._id, projectId);
            if (res.broadcast) {
                setDetailRow(res.broadcast);
                if (res.broadcast.status !== 'sending') {
                    void fetchList();
                }
            }
        }, 3000);
        return () => clearInterval(id);
    }, [detailRow, projectId, fetchList]);

    // ── Media handlers ────────────────────────────────────────────
    const addMedia = (kind: BroadcastMediaKind, item: { id: string; url: string }) => {
        setComposer((c) => ({
            ...c,
            media: [
                ...c.media,
                {
                    type: kind,
                    sabFileId: item.id,
                    url: item.url,
                },
            ],
        }));
    };
    const removeMedia = (idx: number) => {
        setComposer((c) => ({ ...c, media: c.media.filter((_, i) => i !== idx) }));
    };
    const moveMedia = (idx: number, dir: -1 | 1) => {
        setComposer((c) => {
            const next = [...c.media];
            const j = idx + dir;
            if (j < 0 || j >= next.length) return c;
            [next[idx], next[j]] = [next[j], next[idx]];
            return { ...c, media: next };
        });
    };
    const setMediaCaption = (idx: number, caption: string) => {
        setComposer((c) => ({
            ...c,
            media: c.media.map((m, i) => (i === idx ? { ...m, caption } : m)),
        }));
    };

    // ── Inline keyboard handlers ──────────────────────────────────
    const addKeyboardRow = () => {
        setComposer((c) => ({ ...c, inlineKeyboard: [...c.inlineKeyboard, []] }));
    };
    const removeKeyboardRow = (rowIdx: number) => {
        setComposer((c) => ({
            ...c,
            inlineKeyboard: c.inlineKeyboard.filter((_, i) => i !== rowIdx),
        }));
    };
    const addKeyboardButton = (rowIdx: number) => {
        setComposer((c) => {
            const next = c.inlineKeyboard.map((r, i) =>
                i === rowIdx
                    ? [...r, { text: 'Button' } as BroadcastInlineButton]
                    : r,
            );
            return { ...c, inlineKeyboard: next };
        });
    };
    const updateKeyboardButton = (
        rowIdx: number,
        colIdx: number,
        patch: Partial<BroadcastInlineButton>,
    ) => {
        setComposer((c) => {
            const next = c.inlineKeyboard.map((r, i) =>
                i === rowIdx
                    ? r.map((b, j) => (j === colIdx ? { ...b, ...patch } : b))
                    : r,
            );
            return { ...c, inlineKeyboard: next };
        });
    };
    const removeKeyboardButton = (rowIdx: number, colIdx: number) => {
        setComposer((c) => {
            const next = c.inlineKeyboard.map((r, i) =>
                i === rowIdx ? r.filter((_, j) => j !== colIdx) : r,
            );
            return { ...c, inlineKeyboard: next };
        });
    };

    // ── Bulk selection ────────────────────────────────────────────
    const allSelected = rows.length > 0 && rows.every((r) => selected.has(r._id));
    const someSelected = rows.some((r) => selected.has(r._id));
    const toggleAll = (v: boolean) => {
        setSelected((s) => {
            const next = new Set(s);
            for (const r of rows) {
                if (v) next.add(r._id);
                else next.delete(r._id);
            }
            return next;
        });
    };
    const toggleOne = (id: string, v: boolean) => {
        setSelected((s) => {
            const next = new Set(s);
            if (v) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    // ── Pagination ────────────────────────────────────────────────
    const goNextPage = () => {
        if (!nextCursor) return;
        setCursors((c) => {
            const next = [...c];
            next[pageIdx + 1] = nextCursor;
            return next;
        });
        setPageIdx((i) => i + 1);
    };
    const goPrevPage = () => {
        if (pageIdx === 0) return;
        setPageIdx((i) => i - 1);
    };

    const botName = React.useCallback(
        (botId: string): string => {
            const b = bots.find((x) => x._id === botId);
            return b ? `@${b.username || b.name}` : '-';
        },
        [bots],
    );

    // ── Render ────────────────────────────────────────────────────
    if (!projectId) {
        return (
            <div className="p-6">
                <EmptyState
                    title="No project selected"
                    description="Pick a project from the header to manage Telegram broadcasts."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-4 md:p-6">
            <PageHeader>
                <PageHeading>
                    <PageEyebrow>Telegram</PageEyebrow>
                    <PageTitle className="flex items-center gap-2">
                        <Megaphone className="size-5" aria-hidden="true" />
                        Telegram Broadcasts
                    </PageTitle>
                    <PageDescription>
                        Compose, schedule, and ship one-to-many Telegram messages.
                        Counters update live while a broadcast is sending.
                    </PageDescription>
                </PageHeading>
                <PageActions>
                    <Button type="button" variant="primary" onClick={openNewComposer} iconLeft={Plus}>
                        New broadcast
                    </Button>
                </PageActions>
            </PageHeader>

            {/* KPI cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total broadcasts"
                    value={analyticsLoading ? '-' : fmtNumber(kpis.total)}
                    icon={Megaphone}
                />
                <StatCard
                    label="Scheduled (page)"
                    value={fmtNumber(kpis.scheduled)}
                    icon={CalendarIcon}
                />
                <StatCard
                    label="Sending now"
                    value={fmtNumber(kpis.sending)}
                    icon={Send}
                />
                <StatCard
                    label="Avg success rate"
                    value={analyticsLoading ? '-' : pct(kpis.successRate)}
                    icon={Check}
                />
            </div>

            {/* Filter bar */}
            <Card>
                <CardBody className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:p-4">
                    <div className="relative flex-1">
                        <Search
                            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--st-text-tertiary)]"
                            aria-hidden="true"
                        />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name"
                            aria-label="Search broadcasts by name"
                            className="pl-9"
                        />
                    </div>
                    <Select
                        value={botFilter}
                        onValueChange={(v) => setBotFilter(v as 'all' | string)}
                    >
                        <SelectTrigger className="md:w-48" aria-label="Filter by bot">
                            <SelectValue placeholder="Bot" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All bots</SelectItem>
                            {bots.map((b) => (
                                <SelectItem key={b._id} value={b._id}>
                                    @{b.username || b.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v as 'all' | BroadcastStatus)}
                    >
                        <SelectTrigger className="md:w-44" aria-label="Filter by status">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {selected.size > 0 ? (
                        <Button
                            type="button"
                            variant="danger"
                            onClick={() => setBulkDeleteOpen(true)}
                            iconLeft={Trash2}
                        >
                            Delete {selected.size}
                        </Button>
                    ) : null}
                </CardBody>
            </Card>

            {/* Table */}
            <Card>
                <CardBody className="p-0">
                    {error ? (
                        <div className="flex items-center gap-2 p-6 text-sm text-[var(--st-danger)]">
                            <AlertCircle className="size-4" aria-hidden="true" /> {error}
                        </div>
                    ) : null}
                    <div className="overflow-x-auto">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th className="w-10">
                                        <Checkbox
                                            checked={allSelected}
                                            indeterminate={someSelected && !allSelected}
                                            onChange={(e) => toggleAll(e.target.checked)}
                                            aria-label="Select all"
                                        />
                                    </Th>
                                    <Th>Name</Th>
                                    <Th>Bot</Th>
                                    <Th>Audience</Th>
                                    <Th>Status</Th>
                                    <Th>Scheduled</Th>
                                    <Th>Sent / Failed</Th>
                                    <Th>Created</Th>
                                    <Th align="right" className="w-32">
                                        Actions
                                    </Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {loading ? (
                                    Array.from({ length: 4 }).map((_, i) => (
                                        <Tr key={`s${i}`}>
                                            <Td colSpan={9}>
                                                <Skeleton height={24} className="w-full" />
                                            </Td>
                                        </Tr>
                                    ))
                                ) : rows.length === 0 ? (
                                    <Tr>
                                        <Td colSpan={9} className="py-10">
                                            <EmptyState
                                                icon={Megaphone}
                                                title="No broadcasts yet"
                                                description="Compose your first broadcast to fan out a message to your subscribers."
                                                action={
                                                    <Button
                                                        type="button"
                                                        variant="primary"
                                                        onClick={openNewComposer}
                                                        iconLeft={Plus}
                                                    >
                                                        New broadcast
                                                    </Button>
                                                }
                                            />
                                        </Td>
                                    </Tr>
                                ) : (
                                    rows.map((row) => {
                                        const counters = row.counters ?? {};
                                        const sent =
                                            counters.sent ?? row.stats?.sent ?? 0;
                                        const failed =
                                            counters.failed ?? row.stats?.failed ?? 0;
                                        return (
                                            <Tr key={row._id}>
                                                <Td>
                                                    <Checkbox
                                                        checked={selected.has(row._id)}
                                                        onChange={(e) =>
                                                            toggleOne(row._id, e.target.checked)
                                                        }
                                                        aria-label={`Select ${row.name || 'broadcast'}`}
                                                    />
                                                </Td>
                                                <Td>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="px-0 font-medium hover:underline"
                                                        onClick={() => openDetail(row)}
                                                    >
                                                        {row.name || 'Untitled broadcast'}
                                                    </Button>
                                                </Td>
                                                <Td className="text-[var(--st-text-secondary)]">
                                                    {botName(row.botId)}
                                                </Td>
                                                <Td className="text-[var(--st-text-secondary)]">
                                                    {audienceLabel(row.audience)}
                                                </Td>
                                                <Td>
                                                    <Badge variant={STATUS_VARIANT[row.status]}>
                                                        {row.status}
                                                    </Badge>
                                                </Td>
                                                <Td className="text-[var(--st-text-secondary)]">
                                                    {fmtDateTime(row.scheduledAt)}
                                                </Td>
                                                <Td className="text-[var(--st-text-secondary)]">
                                                    {fmtNumber(sent)} / {fmtNumber(failed)}
                                                </Td>
                                                <Td className="text-[var(--st-text-secondary)]">
                                                    {fmtDateTime(row.createdAt)}
                                                </Td>
                                                <Td align="right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                row.status === 'draft'
                                                                    ? openEditComposer(row)
                                                                    : openDetail(row)
                                                            }
                                                            aria-label="Open broadcast"
                                                            iconLeft={Pencil}
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => doDuplicate(row)}
                                                            aria-label="Duplicate broadcast"
                                                            iconLeft={Copy}
                                                        />
                                                        {(row.status === 'scheduled' ||
                                                            row.status === 'sending') && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => doCancel(row)}
                                                                aria-label="Cancel broadcast"
                                                                iconLeft={XCircle}
                                                            />
                                                        )}
                                                        {row.status === 'draft' && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => doSendNow(row)}
                                                                aria-label="Send now"
                                                                iconLeft={Send}
                                                            />
                                                        )}
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setDeleteRow(row)}
                                                            aria-label="Delete broadcast"
                                                            iconLeft={Trash2}
                                                        />
                                                    </div>
                                                </Td>
                                            </Tr>
                                        );
                                    })
                                )}
                            </TBody>
                        </Table>
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-between border-t border-[var(--st-border)] p-3">
                        <span className="text-xs text-[var(--st-text-secondary)]">
                            Page {pageIdx + 1}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={goPrevPage}
                                disabled={pageIdx === 0}
                                iconLeft={ChevronLeft}
                            >
                                Prev
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={goNextPage}
                                disabled={!nextCursor}
                                iconRight={ChevronRight}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Composer drawer */}
            <Composer
                open={composerOpen}
                onOpenChange={setComposerOpen}
                composer={composer}
                onComposerChange={setComposer}
                bots={bots}
                error={composerErr}
                saving={composerSaving}
                onSaveDraft={() => saveComposer('save')}
                onSendNow={() => saveComposer('send')}
                onSchedule={() => saveComposer('schedule')}
                onOpenTest={() => {
                    setTestChatId('');
                    setTestOpen(true);
                }}
                onAddMedia={addMedia}
                onRemoveMedia={removeMedia}
                onMoveMedia={moveMedia}
                onSetMediaCaption={setMediaCaption}
                onAddKeyboardRow={addKeyboardRow}
                onRemoveKeyboardRow={removeKeyboardRow}
                onAddKeyboardButton={addKeyboardButton}
                onUpdateKeyboardButton={updateKeyboardButton}
                onRemoveKeyboardButton={removeKeyboardButton}
            />

            {/* Test-send dialog */}
            <Dialog open={testOpen} onOpenChange={setTestOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Send a test</DialogTitle>
                        <DialogDescription>
                            Sends a single copy of this broadcast to one chat id, no
                            counters touched.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Field label="Chat id">
                            <Input
                                value={testChatId}
                                onChange={(e) => setTestChatId(e.target.value)}
                                placeholder="e.g. 1234567890"
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setTestOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={runTestSend}
                            loading={testSending}
                            iconLeft={testSending ? undefined : Send}
                        >
                            Send test
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm */}
            <Dialog open={deleteRow !== null} onOpenChange={(o) => !o && setDeleteRow(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete this broadcast?</DialogTitle>
                        <DialogDescription>
                            This deletes the broadcast and its delivery log. The Telegram
                            messages already sent are not affected.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeleteRow(null)}
                        >
                            Cancel
                        </Button>
                        <Button type="button" variant="danger" onClick={doDelete} iconLeft={Trash2}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk delete confirm */}
            <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Delete {selected.size} broadcast{selected.size === 1 ? '' : 's'}?
                        </DialogTitle>
                        <DialogDescription>
                            This permanently removes the selected broadcasts and their
                            delivery logs.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setBulkDeleteOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="button" variant="danger" onClick={doBulkDelete} iconLeft={Trash2}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail drawer */}
            <DetailDrawer
                open={detailOpen}
                onOpenChange={setDetailOpen}
                row={detailRow}
                deliveries={deliveries}
                deliveriesLoading={deliveriesLoading}
                deliveriesCursor={deliveriesCursor}
                botName={detailRow ? botName(detailRow.botId) : '-'}
                projectId={projectId}
                onLoadMore={() =>
                    detailRow && fetchDeliveries(detailRow._id, deliveriesCursor, false)
                }
                onCancel={async () => {
                    if (!detailRow) return;
                    await doCancel(detailRow);
                }}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Composer drawer - isolated for readability
// ---------------------------------------------------------------------------

interface ComposerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    composer: ComposerState;
    onComposerChange: React.Dispatch<React.SetStateAction<ComposerState>>;
    bots: TelegramBotRow[];
    error: string | null;
    saving: boolean;
    onSaveDraft: () => void;
    onSendNow: () => void;
    onSchedule: () => void;
    onOpenTest: () => void;
    onAddMedia: (kind: BroadcastMediaKind, item: { id: string; url: string }) => void;
    onRemoveMedia: (idx: number) => void;
    onMoveMedia: (idx: number, dir: -1 | 1) => void;
    onSetMediaCaption: (idx: number, caption: string) => void;
    onAddKeyboardRow: () => void;
    onRemoveKeyboardRow: (rowIdx: number) => void;
    onAddKeyboardButton: (rowIdx: number) => void;
    onUpdateKeyboardButton: (
        rowIdx: number,
        colIdx: number,
        patch: Partial<BroadcastInlineButton>,
    ) => void;
    onRemoveKeyboardButton: (rowIdx: number, colIdx: number) => void;
}

function Composer(props: ComposerProps) {
    const {
        open,
        onOpenChange,
        composer,
        onComposerChange,
        bots,
        error,
        saving,
        onSaveDraft,
        onSendNow,
        onSchedule,
        onOpenTest,
        onAddMedia,
        onRemoveMedia,
        onMoveMedia,
        onSetMediaCaption,
        onAddKeyboardRow,
        onRemoveKeyboardRow,
        onAddKeyboardButton,
        onUpdateKeyboardButton,
        onRemoveKeyboardButton,
    } = props;

    const update = <K extends keyof ComposerState>(
        key: K,
        value: ComposerState[K],
    ) => {
        onComposerChange((c) => ({ ...c, [key]: value }));
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent className="max-h-[92vh]">
                <DrawerHeader>
                    <DrawerTitle>
                        {composer.broadcastId ? 'Edit broadcast' : 'New broadcast'}
                    </DrawerTitle>
                    <DrawerDescription>
                        Configure the basics, message, inline keyboard, and schedule. A
                        draft is saved before any send.
                    </DrawerDescription>
                </DrawerHeader>

                <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4 md:px-6">
                    {error ? (
                        <div className="flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-danger)]">
                            <AlertCircle className="size-4" aria-hidden="true" /> {error}
                        </div>
                    ) : null}

                    {/* ── 1. Basics ─────────────────────────────────── */}
                    <Section title="1 · Basics">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <Field label="Name">
                                <Input
                                    value={composer.name}
                                    onChange={(e) => update('name', e.target.value)}
                                    placeholder="Weekly drop, subscribers"
                                />
                            </Field>
                            <Field label="Bot">
                                <Select
                                    value={composer.botId}
                                    onValueChange={(v) => update('botId', v)}
                                >
                                    <SelectTrigger aria-label="Bot">
                                        <SelectValue placeholder="Pick a bot" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {bots.length === 0 ? (
                                            <div className="px-2 py-1.5 text-sm text-[var(--st-text-secondary)]">
                                                No bots yet, connect one from
                                                /dashboard/telegram/bots
                                            </div>
                                        ) : (
                                            bots.map((b) => (
                                                <SelectItem key={b._id} value={b._id}>
                                                    @{b.username || b.name}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>

                        <Separator className="my-2" />

                        <Label>Audience</Label>
                        <SegmentedControl
                            aria-label="Audience"
                            value={composer.audienceKind}
                            onChange={(v) => update('audienceKind', v as AudienceKind)}
                            items={AUDIENCE_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                        />

                        {composer.audienceKind === 'segment' ? (
                            <Field label="Segment id">
                                <Input
                                    value={composer.segmentId}
                                    onChange={(e) => update('segmentId', e.target.value)}
                                    placeholder="seg_"
                                />
                            </Field>
                        ) : null}

                        {composer.audienceKind === 'contactIds' ? (
                            <Field
                                label="Chat ids"
                                help="Comma or whitespace separated. The bot must already have a chat opened with each id."
                            >
                                <Textarea
                                    value={composer.contactIds}
                                    onChange={(e) => update('contactIds', e.target.value)}
                                    placeholder="1234567890, 9876543210"
                                    rows={3}
                                />
                            </Field>
                        ) : null}

                        {composer.audienceKind === 'filter' ? (
                            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <Field label="Tags">
                                    <Input
                                        value={composer.filterTags}
                                        onChange={(e) =>
                                            update('filterTags', e.target.value)
                                        }
                                        placeholder="vip, beta-tester"
                                    />
                                </Field>
                                <Field label="Language">
                                    <Input
                                        value={composer.filterLang}
                                        onChange={(e) =>
                                            update('filterLang', e.target.value)
                                        }
                                        placeholder="en"
                                    />
                                </Field>
                            </div>
                        ) : null}
                    </Section>

                    {/* ── 2. Message ────────────────────────────────── */}
                    <Section title="2 · Message">
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-[var(--st-text-secondary)]">Format:</span>
                            <RadioGroup
                                aria-label="Message format"
                                orientation="horizontal"
                                value={composer.parseMode}
                                onValueChange={(v) =>
                                    update('parseMode', v as ComposerState['parseMode'])
                                }
                            >
                                {(['plain', 'Markdown', 'HTML'] as const).map((m) => (
                                    <RadioGroupItem key={m} value={m} label={m} />
                                ))}
                            </RadioGroup>
                        </div>
                        <Textarea
                            aria-label="Message text"
                            value={composer.text}
                            onChange={(e) => update('text', e.target.value)}
                            placeholder="Hello {{first_name}}, ..."
                            rows={6}
                        />
                        <Checkbox
                            checked={composer.disableWebPagePreview}
                            onChange={(e) =>
                                update('disableWebPagePreview', e.target.checked)
                            }
                            label="Disable link previews"
                        />

                        <Separator className="my-2" />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Label>Media (optional)</Label>
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(MEDIA_KIND_LABEL) as BroadcastMediaKind[]).map(
                                    (kind) => {
                                        const Icon = MEDIA_KIND_ICON[kind];
                                        return (
                                            <SabFilePickerButton
                                                key={kind}
                                                accept={MEDIA_KIND_ACCEPT[kind]}
                                                title={`Add ${MEDIA_KIND_LABEL[kind]}`}
                                                variant="outline"
                                                onPick={(p) =>
                                                    onAddMedia(kind, {
                                                        id: p.id,
                                                        url: p.url,
                                                    })
                                                }
                                            >
                                                <Icon className="size-4" aria-hidden="true" />{' '}
                                                {MEDIA_KIND_LABEL[kind]}
                                            </SabFilePickerButton>
                                        );
                                    },
                                )}
                            </div>
                        </div>

                        {composer.media.length === 0 ? (
                            <p className="text-xs text-[var(--st-text-secondary)]">
                                No media attached. All files come from your SabFiles
                                library.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {composer.media.map((m, idx) => {
                                    const Icon = MEDIA_KIND_ICON[m.type];
                                    return (
                                        <li
                                            key={`${m.sabFileId}-${idx}`}
                                            className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex min-w-0 items-center gap-2">
                                                    <Icon className="size-4 shrink-0" aria-hidden="true" />
                                                    <span className="truncate text-sm">
                                                        {MEDIA_KIND_LABEL[m.type]}, {m.sabFileId}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onMoveMedia(idx, -1)}
                                                        aria-label="Move up"
                                                        iconLeft={ChevronUp}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onMoveMedia(idx, 1)}
                                                        aria-label="Move down"
                                                        iconLeft={ChevronDown}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => onRemoveMedia(idx)}
                                                        aria-label="Remove media"
                                                        iconLeft={X}
                                                    />
                                                </div>
                                            </div>
                                            <Input
                                                aria-label="Media caption"
                                                value={m.caption ?? ''}
                                                onChange={(e) =>
                                                    onSetMediaCaption(idx, e.target.value)
                                                }
                                                placeholder="Caption (optional)"
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Section>

                    {/* ── 3. Inline keyboard ────────────────────────── */}
                    <Section title="3 · Inline keyboard">
                        {composer.inlineKeyboard.length === 0 ? (
                            <p className="text-xs text-[var(--st-text-secondary)]">
                                No inline buttons. Add a row to start.
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-3">
                                {composer.inlineKeyboard.map((row, rowIdx) => (
                                    <li
                                        key={`row-${rowIdx}`}
                                        className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2"
                                    >
                                        <div className="flex items-center justify-between pb-2">
                                            <span className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                                                Row {rowIdx + 1}
                                            </span>
                                            <div className="flex gap-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        onAddKeyboardButton(rowIdx)
                                                    }
                                                    iconLeft={Plus}
                                                >
                                                    Button
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() =>
                                                        onRemoveKeyboardRow(rowIdx)
                                                    }
                                                    aria-label="Remove row"
                                                    iconLeft={Trash2}
                                                />
                                            </div>
                                        </div>
                                        <ul className="flex flex-col gap-2">
                                            {row.map((btn, colIdx) => (
                                                <li
                                                    key={`btn-${rowIdx}-${colIdx}`}
                                                    className="grid grid-cols-1 gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 md:grid-cols-[1fr_1fr_1fr_auto]"
                                                >
                                                    <Input
                                                        aria-label="Button label"
                                                        value={btn.text}
                                                        onChange={(e) =>
                                                            onUpdateKeyboardButton(
                                                                rowIdx,
                                                                colIdx,
                                                                { text: e.target.value },
                                                            )
                                                        }
                                                        placeholder="Button label"
                                                    />
                                                    <Input
                                                        aria-label="Button URL"
                                                        value={btn.url ?? ''}
                                                        onChange={(e) =>
                                                            onUpdateKeyboardButton(
                                                                rowIdx,
                                                                colIdx,
                                                                {
                                                                    url: e.target.value ||
                                                                        undefined,
                                                                },
                                                            )
                                                        }
                                                        placeholder="https://... (optional)"
                                                    />
                                                    <Input
                                                        aria-label="Button callback data"
                                                        value={btn.callbackData ?? ''}
                                                        onChange={(e) =>
                                                            onUpdateKeyboardButton(
                                                                rowIdx,
                                                                colIdx,
                                                                {
                                                                    callbackData:
                                                                        e.target.value ||
                                                                        undefined,
                                                                },
                                                            )
                                                        }
                                                        placeholder="callback_data (optional)"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() =>
                                                            onRemoveKeyboardButton(
                                                                rowIdx,
                                                                colIdx,
                                                            )
                                                        }
                                                        aria-label="Remove button"
                                                        iconLeft={X}
                                                    />
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onAddKeyboardRow}
                            iconLeft={Plus}
                        >
                            Add row
                        </Button>
                    </Section>

                    {/* ── 4. Schedule ───────────────────────────────── */}
                    <Section title="4 · Schedule">
                        <RadioGroup
                            aria-label="Send timing"
                            value={composer.sendChoice}
                            onValueChange={(v) =>
                                update('sendChoice', v as 'now' | 'schedule')
                            }
                        >
                            <RadioGroupItem value="now" label="Send now" />
                            <RadioGroupItem value="schedule" label="Schedule for later" />
                        </RadioGroup>
                        {composer.sendChoice === 'schedule' ? (
                            <Field label="Send at">
                                <Input
                                    type="datetime-local"
                                    value={composer.scheduledLocal}
                                    onChange={(e) =>
                                        update('scheduledLocal', e.target.value)
                                    }
                                />
                            </Field>
                        ) : null}
                    </Section>

                    {/* ── 5. Preview ───────────────────────────────── */}
                    <Section title="5 · Preview">
                        <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                            <div className="text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
                                Preview, {composer.parseMode}
                            </div>
                            <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--st-text)]">
                                {composer.text || '(empty)'}
                            </pre>
                            {composer.media.length > 0 ? (
                                <p className="mt-2 text-xs text-[var(--st-text-secondary)]">
                                    + {composer.media.length} media attachment
                                    {composer.media.length === 1 ? '' : 's'}
                                </p>
                            ) : null}
                            {composer.inlineKeyboard.length > 0 ? (
                                <div className="mt-2 flex flex-col gap-1">
                                    {composer.inlineKeyboard.map((r, i) => (
                                        <div
                                            key={`pkr-${i}`}
                                            className="flex flex-wrap gap-1"
                                        >
                                            {r.map((b, j) => (
                                                <span
                                                    key={`pkb-${i}-${j}`}
                                                    className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-2 py-1 text-xs text-[var(--st-text)]"
                                                >
                                                    {b.text}
                                                </span>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onOpenTest}
                                disabled={!composer.broadcastId}
                                iconLeft={Send}
                            >
                                Send test
                            </Button>
                        </div>
                        {!composer.broadcastId ? (
                            <p className="text-right text-xs text-[var(--st-text-secondary)]">
                                Save the draft first to enable test sends.
                            </p>
                        ) : null}
                    </Section>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--st-border)] p-3">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onSaveDraft}
                        loading={saving}
                    >
                        Save draft
                    </Button>
                    {composer.sendChoice === 'schedule' ? (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={onSchedule}
                            loading={saving}
                            iconLeft={saving ? undefined : CalendarIcon}
                        >
                            Save & schedule
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={onSendNow}
                            loading={saving}
                            iconLeft={saving ? undefined : Send}
                        >
                            Save & send now
                        </Button>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3 md:p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                {title}
            </h3>
            {children}
        </section>
    );
}

// ---------------------------------------------------------------------------
//  Detail drawer
// ---------------------------------------------------------------------------

interface DetailDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    row: BroadcastRow | null;
    deliveries: DeliveryRow[];
    deliveriesLoading: boolean;
    deliveriesCursor?: string;
    botName: string;
    projectId: string;
    onLoadMore: () => void;
    onCancel: () => void;
}

function DetailDrawer(props: DetailDrawerProps) {
    const {
        open,
        onOpenChange,
        row,
        deliveries,
        deliveriesLoading,
        deliveriesCursor,
        botName,
        projectId,
        onLoadMore,
        onCancel,
    } = props;
    const [exporting, setExporting] = React.useState(false);
    const { toast } = useToast();
    const onExportCsv = async () => {
        if (!row) return;
        setExporting(true);
        const res = await exportDeliveriesCsvAction(row._id, projectId);
        setExporting(false);
        if (res.error) {
            toast({
                title: 'CSV export failed',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `broadcast-${row._id}-deliveries.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };
    if (!row) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent />
            </Drawer>
        );
    }
    const counters = row.counters ?? {};
    const sent = counters.sent ?? row.stats?.sent ?? 0;
    const failed = counters.failed ?? row.stats?.failed ?? 0;
    const queued = counters.queued ?? row.stats?.total ?? 0;
    const skipped = counters.skipped ?? 0;

    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <TelegramProjectGate />
            <DrawerContent className="max-h-[92vh]">
                <DrawerHeader>
                    <DrawerTitle className="flex items-center gap-2">
                        <Megaphone className="size-5" aria-hidden="true" />
                        {row.name}
                    </DrawerTitle>
                    <DrawerDescription>
                        {botName}, created {fmtRelative(row.createdAt)}
                    </DrawerDescription>
                </DrawerHeader>

                <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4 md:px-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[row.status]}>{row.status}</Badge>
                        {row.scheduledAt ? (
                            <span className="text-xs text-[var(--st-text-secondary)]">
                                Scheduled: {fmtDateTime(row.scheduledAt)}
                            </span>
                        ) : null}
                        {row.startedAt ? (
                            <span className="text-xs text-[var(--st-text-secondary)]">
                                Started: {fmtDateTime(row.startedAt)}
                            </span>
                        ) : null}
                        {row.completedAt ? (
                            <span className="text-xs text-[var(--st-text-secondary)]">
                                Completed: {fmtDateTime(row.completedAt)}
                            </span>
                        ) : null}
                    </div>

                    {/* Counters */}
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        <StatCard label="Queued" value={fmtNumber(queued)} />
                        <StatCard label="Sent" value={fmtNumber(sent)} />
                        <StatCard label="Failed" value={fmtNumber(failed)} />
                        <StatCard label="Skipped" value={fmtNumber(skipped)} />
                    </div>

                    {row.errorSummary ? (
                        <div className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 text-sm text-[var(--st-danger)]">
                            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
                            <div>
                                <div className="font-medium">Error</div>
                                <div className="break-words">
                                    {row.errorSummary.message ?? JSON.stringify(row.errorSummary)}
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {/* Deliveries */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                            Deliveries
                        </h3>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={onExportCsv}
                            loading={exporting}
                            iconLeft={exporting ? undefined : Download}
                        >
                            CSV
                        </Button>
                    </div>

                    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>Chat id</Th>
                                    <Th>Status</Th>
                                    <Th>Error</Th>
                                    <Th>Sent at</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {deliveries.length === 0 ? (
                                    <Tr>
                                        <Td
                                            colSpan={4}
                                            align="center"
                                            className="py-6 text-sm text-[var(--st-text-secondary)]"
                                        >
                                            {deliveriesLoading
                                                ? 'Loading...'
                                                : 'No deliveries yet.'}
                                        </Td>
                                    </Tr>
                                ) : (
                                    deliveries.map((d) => (
                                        <Tr key={d._id}>
                                            <Td className="font-mono text-xs">
                                                {d.chatId}
                                            </Td>
                                            <Td>
                                                <Badge
                                                    variant={
                                                        d.status === 'sent'
                                                            ? 'success'
                                                            : d.status === 'failed'
                                                              ? 'destructive'
                                                              : 'secondary'
                                                    }
                                                >
                                                    {d.status}
                                                </Badge>
                                            </Td>
                                            <Td className="text-xs text-[var(--st-text-secondary)]">
                                                {d.errorMessage ?? ''}
                                            </Td>
                                            <Td className="text-xs text-[var(--st-text-secondary)]">
                                                {fmtDateTime(d.sentAt)}
                                            </Td>
                                        </Tr>
                                    ))
                                )}
                            </TBody>
                        </Table>
                    </div>
                    {deliveriesCursor ? (
                        <div className="flex justify-center">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={onLoadMore}
                                loading={deliveriesLoading}
                            >
                                Load more
                            </Button>
                        </div>
                    ) : null}
                </div>

                <div className="flex justify-end gap-2 border-t border-[var(--st-border)] p-3">
                    {(row.status === 'scheduled' || row.status === 'sending') && (
                        <Button type="button" variant="danger" onClick={onCancel} iconLeft={XCircle}>
                            Cancel
                        </Button>
                    )}
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

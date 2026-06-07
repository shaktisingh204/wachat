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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    EmptyState,
    Field,
    IconButton,
    Input,
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
    Skeleton,
    StatCard,
    cn,
    useToast,
} from '@/components/sabcrm/20ui';
import {
    Hash,
    Loader2,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    ExternalLink,
    Crown,
    AlertCircle,
    Calendar,
    Users,
    MoreHorizontal,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';
import { listTelegramBots } from '@/app/actions/telegram.actions';
import type { BotRow as TelegramBotRow } from '@/lib/rust-client/telegram-bots';
import {
    discoverChannel,
    getChannel,
    listChannels,
    removeChannel,
    type ChannelRow,
} from '@/app/actions/telegram-channels.actions';

type Filters = {
    search: string;
    type: 'all' | 'channel' | 'supergroup';
    botId: string;
};

type DiscoverState = {
    open: boolean;
    botId: string;
    input: string;
    busy: boolean;
};

function ChannelCard({
    channel,
    onRefresh,
    onRemove,
    onOpen,
}: {
    channel: ChannelRow;
    onRefresh: (id: string) => void;
    onRemove: (id: string) => void;
    onOpen: (id: string) => void;
}) {
    const tgUrl = channel.username
        ? `https://t.me/${channel.username}`
        : undefined;
    return (
        <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3
                            className="truncate text-[15px] font-medium text-[var(--st-text)]"
                            title={channel.title}
                        >
                            {channel.title}
                        </h3>
                        {channel.isVerified ? (
                            <Badge variant="secondary">verified</Badge>
                        ) : null}
                    </div>
                    {channel.username ? (
                        <a
                            href={tgUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 truncate text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                        >
                            @{channel.username}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                    ) : (
                        <div className="mt-0.5 truncate text-xs text-[var(--st-text-secondary)]">
                            {channel.chatId}
                        </div>
                    )}
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <IconButton
                            label="Channel actions"
                            icon={MoreHorizontal}
                            variant="ghost"
                            size="sm"
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onOpen(channel._id)}>
                            Open channel
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onRefresh(channel._id)}>
                            Refresh from Telegram
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            variant="danger"
                            onSelect={() => onRemove(channel._id)}
                        >
                            Remove channel
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                <Badge variant="outline">{channel.type}</Badge>
                {channel.isAdmin ? (
                    <Badge variant="secondary">
                        <Crown className="mr-1 h-3 w-3" aria-hidden="true" /> Admin
                    </Badge>
                ) : (
                    <Badge variant="destructive">
                        <AlertCircle className="mr-1 h-3 w-3" aria-hidden="true" /> Not
                        admin
                    </Badge>
                )}
                <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {channel.memberCount ?? 'n/a'} members
                </span>
                <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" aria-hidden="true" />
                    Synced{' '}
                    {new Date(channel.lastSyncedAt).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                    })}
                </span>
            </div>

            <div className="mt-auto flex items-center gap-2">
                <Link
                    href={`/dashboard/telegram/channels/${channel._id}`}
                    className="flex-1"
                >
                    <Button variant="outline" block>
                        Open
                    </Button>
                </Link>
                <IconButton
                    label="Refresh channel"
                    icon={RefreshCw}
                    variant="ghost"
                    onClick={() => onRefresh(channel._id)}
                />
            </div>
        </Card>
    );
}

function DiscoverDialog({
    state,
    bots,
    onChange,
    onSubmit,
    onClose,
}: {
    state: DiscoverState;
    bots: TelegramBotRow[];
    onChange: (s: DiscoverState) => void;
    onSubmit: () => void;
    onClose: () => void;
}) {
    return (
        <Dialog open={state.open} onOpenChange={(o) => (o ? null : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Discover channel</DialogTitle>
                    <DialogDescription>
                        Add the bot as an admin of the channel first, then point us at
                        the channel by its public @username or numeric chat id.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    <Field label="Bot">
                        <Select
                            value={state.botId}
                            onValueChange={(v) => onChange({ ...state, botId: v })}
                        >
                            <SelectTrigger aria-label="Bot">
                                <SelectValue placeholder="Pick a bot" />
                            </SelectTrigger>
                            <SelectContent>
                                {bots.map((b) => (
                                    <SelectItem key={b._id} value={b._id}>
                                        @{b.username}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <Field
                        label="Channel"
                        help={
                            <>
                                We will call <code>getChat</code> and verify the bot is an
                                administrator before saving.
                            </>
                        }
                    >
                        <Input
                            value={state.input}
                            onChange={(e) =>
                                onChange({ ...state, input: e.target.value })
                            }
                            placeholder="@channel_username or -1001234567890"
                            iconLeft={Hash}
                        />
                    </Field>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={state.busy}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onSubmit}
                        loading={state.busy}
                        disabled={state.busy || !state.botId || !state.input.trim()}
                        iconLeft={state.busy ? undefined : Plus}
                    >
                        {state.busy ? 'Adding' : 'Add'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function buildDiscoverBody(input: string): { chatId?: string; username?: string } {
    const trimmed = input.trim().replace(/^@/, '');
    if (!trimmed) return {};
    // Telegram numeric channel ids are negative integers like
    // -1001234567890. Anything else we treat as a username.
    if (/^-?\d+$/.test(trimmed)) return { chatId: trimmed };
    return { username: trimmed };
}

export default function TelegramChannelsPage() {
    const { activeProjectId, isLoadingProject } = useProject();
    const { toast } = useToast();

    const [bots, setBots] = React.useState<TelegramBotRow[]>([]);
    const [channels, setChannels] = React.useState<ChannelRow[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [refreshing, setRefreshing] = React.useState<string | null>(null);
    const [pendingRemove, setPendingRemove] = React.useState<ChannelRow | null>(
        null,
    );
    const [filters, setFilters] = React.useState<Filters>({
        search: '',
        type: 'all',
        botId: 'all',
    });
    const [discover, setDiscover] = React.useState<DiscoverState>({
        open: false,
        botId: '',
        input: '',
        busy: false,
    });

    const projectId = activeProjectId ?? '';

    const load = React.useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            const res = await listChannels({
                projectId,
                botId: filters.botId === 'all' ? undefined : filters.botId,
                search: filters.search || undefined,
                type:
                    filters.type === 'all'
                        ? undefined
                        : (filters.type as 'channel' | 'supergroup'),
                limit: 200,
            });
            if (res.error) {
                toast.error({
                    title: 'Failed to load channels',
                    description: res.error,
                });
            }
            setChannels(res.channels);
        } finally {
            setLoading(false);
        }
    }, [projectId, filters, toast]);

    React.useEffect(() => {
        if (!projectId) return;
        listTelegramBots(projectId).then(setBots).catch(() => setBots([]));
    }, [projectId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const kpis = React.useMemo(() => {
        // posts-this-week and per-channel scheduled counts live on the
        // detail mirror; the list endpoint doesn't include them, so we
        // surface "n/a" here and let the user drill into a channel for
        // live numbers.
        const top = channels
            .filter((c) => typeof c.memberCount === 'number')
            .sort((a, b) => (b.memberCount ?? 0) - (a.memberCount ?? 0))[0];
        return {
            total: channels.length,
            postsThisWeek: null as number | null,
            scheduled: null as number | null,
            topName: top?.title ?? 'n/a',
            topMembers: top?.memberCount ?? null,
        };
    }, [channels]);

    const handleRefresh = React.useCallback(
        async (channelId: string) => {
            if (!projectId) return;
            setRefreshing(channelId);
            try {
                // Triggering get() forces a server-side refresh against
                // Telegram and re-saves the mirror.
                const res = await getChannel(channelId, projectId);
                if (res.error) {
                    toast.error({
                        title: 'Refresh failed',
                        description: res.error,
                    });
                } else if (res.channel) {
                    setChannels((curr) =>
                        curr.map((c) =>
                            c._id === channelId ? (res.channel as ChannelRow) : c,
                        ),
                    );
                    toast.success('Channel refreshed');
                }
            } finally {
                setRefreshing(null);
            }
        },
        [projectId, toast],
    );

    const handleRemove = React.useCallback(async () => {
        if (!pendingRemove || !projectId) return;
        const id = pendingRemove._id;
        setPendingRemove(null);
        const res = await removeChannel(id, projectId);
        if (res.success) {
            setChannels((curr) => curr.filter((c) => c._id !== id));
            toast.success('Channel removed');
        } else {
            toast.error({
                title: 'Remove failed',
                description: res.error,
            });
        }
    }, [pendingRemove, projectId, toast]);

    const onSubmitDiscover = React.useCallback(async () => {
        if (!projectId) return;
        const target = buildDiscoverBody(discover.input);
        if (!target.chatId && !target.username) {
            toast.error({
                title: 'Channel required',
                description: 'Paste a @username or numeric channel id.',
            });
            return;
        }
        setDiscover((s) => ({ ...s, busy: true }));
        const res = await discoverChannel({
            projectId,
            botId: discover.botId,
            ...target,
        });
        if (res.success) {
            toast.success({ title: 'Channel added', description: res.message });
            setDiscover({ open: false, botId: '', input: '', busy: false });
            await load();
        } else {
            setDiscover((s) => ({ ...s, busy: false }));
            toast.error({
                title: 'Discover failed',
                description: res.error,
            });
        }
    }, [projectId, discover, toast, load]);

    if (isLoadingProject) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <Skeleton className="h-10 w-64" />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="p-6">
                <EmptyState
                    icon={Hash}
                    title="Pick a project"
                    description="Telegram channels are scoped to a project. Select one from the header switcher to continue."
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            <TelegramProjectGate />
            <PageHeader>
                <div className="flex items-start justify-between gap-3">
                    <PageHeading>
                        <PageEyebrow>Telegram</PageEyebrow>
                        <PageTitle>
                            <span className="inline-flex items-center gap-2">
                                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]">
                                    <Hash className="h-4 w-4" aria-hidden="true" />
                                </span>
                                Telegram Channels
                            </span>
                        </PageTitle>
                        <PageDescription>
                            Discover channels your bots are admins of, post messages,
                            schedule broadcasts, and manage administrators.
                        </PageDescription>
                    </PageHeading>
                    <Button
                        variant="primary"
                        iconLeft={Plus}
                        onClick={() =>
                            setDiscover({
                                open: true,
                                botId: bots[0]?._id ?? '',
                                input: '',
                                busy: false,
                            })
                        }
                        disabled={bots.length === 0}
                    >
                        Discover channel
                    </Button>
                </div>
            </PageHeader>

            {bots.length === 0 ? (
                <Card className="p-4 text-sm text-[var(--st-text-secondary)]">
                    Connect a Telegram bot first. Channels are managed through your bot.{' '}
                    <Link
                        href="/dashboard/telegram/bots"
                        className="text-[var(--st-text)] underline"
                    >
                        Go to bots
                    </Link>
                    .
                </Card>
            ) : null}

            {/* KPI */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Total channels"
                    value={kpis.total}
                    icon={Hash}
                    accent="var(--st-accent)"
                />
                <StatCard
                    label="Posts this week"
                    value={kpis.postsThisWeek ?? 'n/a'}
                    icon={Calendar}
                    accent="var(--st-accent)"
                />
                <StatCard
                    label="Scheduled"
                    value={kpis.scheduled ?? 'n/a'}
                    icon={Calendar}
                    accent="var(--st-accent)"
                />
                <StatCard
                    label="Top by members"
                    value={kpis.topName}
                    icon={Users}
                    accent="var(--st-accent)"
                    delta={
                        kpis.topMembers
                            ? { value: `${kpis.topMembers} members`, tone: 'neutral' }
                            : undefined
                    }
                />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
                <Input
                    value={filters.search}
                    onChange={(e) =>
                        setFilters((f) => ({ ...f, search: e.target.value }))
                    }
                    placeholder="Search title or @username"
                    iconLeft={Search}
                    aria-label="Search channels"
                    className="min-w-[240px] flex-1"
                />
                <Select
                    value={filters.type}
                    onValueChange={(v: Filters['type']) =>
                        setFilters((f) => ({ ...f, type: v }))
                    }
                >
                    <SelectTrigger className="w-[160px]" aria-label="Filter by type">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="channel">Channels</SelectItem>
                        <SelectItem value="supergroup">Supergroups</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={filters.botId}
                    onValueChange={(v) => setFilters((f) => ({ ...f, botId: v }))}
                >
                    <SelectTrigger className="w-[200px]" aria-label="Filter by bot">
                        <SelectValue placeholder="All bots" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All bots</SelectItem>
                        {bots.map((b) => (
                            <SelectItem key={b._id} value={b._id}>
                                @{b.username}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button
                    variant="outline"
                    onClick={load}
                    loading={loading}
                    iconLeft={loading ? undefined : RefreshCw}
                >
                    Refresh
                </Button>
            </div>

            {/* Grid */}
            {loading && channels.length === 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-44 w-full rounded-xl" />
                    ))}
                </div>
            ) : channels.length === 0 ? (
                <EmptyState
                    icon={Hash}
                    title="No channels yet"
                    description={
                        bots.length === 0
                            ? 'Connect a bot first, then come back to discover channels.'
                            : 'Add your bot as an administrator of a Telegram channel, then click Discover channel.'
                    }
                    action={
                        bots.length > 0 ? (
                            <Button
                                variant="primary"
                                iconLeft={Plus}
                                onClick={() =>
                                    setDiscover({
                                        open: true,
                                        botId: bots[0]?._id ?? '',
                                        input: '',
                                        busy: false,
                                    })
                                }
                            >
                                Discover channel
                            </Button>
                        ) : null
                    }
                />
            ) : (
                <div
                    className={cn(
                        'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
                        refreshing ? 'opacity-95' : '',
                    )}
                >
                    {channels.map((c) => (
                        <ChannelCard
                            key={c._id}
                            channel={c}
                            onRefresh={handleRefresh}
                            onRemove={(id) => {
                                const found = channels.find((x) => x._id === id);
                                if (found) setPendingRemove(found);
                            }}
                            onOpen={(id) => {
                                window.location.href = `/dashboard/telegram/channels/${id}`;
                            }}
                        />
                    ))}
                </div>
            )}

            <DiscoverDialog
                state={discover}
                bots={bots}
                onChange={setDiscover}
                onSubmit={onSubmitDiscover}
                onClose={() =>
                    setDiscover({ open: false, botId: '', input: '', busy: false })
                }
            />

            <AlertDialog
                open={!!pendingRemove}
                onOpenChange={(o) => (o ? null : setPendingRemove(null))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove channel?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This unlinks <strong>{pendingRemove?.title}</strong> from
                            SabNode. The bot keeps its administrator role on Telegram, so
                            remove the bot from the channel manually if you also want to
                            revoke its access.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRemove}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" /> Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

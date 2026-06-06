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
    Alert,
    Badge,
    Button,
    Card,
    Checkbox,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    EmptyState,
    Field,
    IconButton,
    Input,
    Label,
    PageActions,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    SegmentedControl,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Skeleton,
    StatCard,
    Textarea,
    useToast,
} from '@/components/sabcrm/20ui';
import { useParams } from 'next/navigation';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    Crown,
    ExternalLink,
    Eye,
    Hash,
    MessageSquarePlus,
    PenSquare,
    Pin,
    PinOff,
    Plus,
    Trash2,
    Users,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { SabFileUrlInput } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import {
    cancelScheduledPost,
    deleteChannelPost,
    demoteAdmin,
    editChannelPost,
    getChannel,
    getStats,
    listAdmins,
    listPosts,
    listScheduled,
    pinChannelPost,
    postToChannel,
    promoteAdmin,
    unpinChannelPost,
    type ChannelRow,
} from '@/app/actions/telegram-channels.actions';
import type {
    AdminRow,
    MediaItem,
    PostMessage,
    PostRow,
    ScheduledRow,
    StatsResp,
} from '@/lib/rust-client/telegram-channels';

type TabKey = 'posts' | 'scheduled' | 'admins' | 'stats';

const TAB_ITEMS: ReadonlyArray<{ value: TabKey; label: string }> = [
    { value: 'posts', label: 'Posts' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'admins', label: 'Admins' },
    { value: 'stats', label: 'Stats' },
];

type ComposerState = {
    open: boolean;
    text: string;
    parseMode: 'NONE' | 'HTML' | 'MarkdownV2';
    media: string;
    mediaType: 'photo' | 'video' | 'document' | 'audio';
    disablePreview: boolean;
    disableNotification: boolean;
    scheduleAt: string; // datetime-local string
    inlineButtons: { text: string; url: string }[];
    busy: boolean;
};

const COMPOSER_INITIAL: ComposerState = {
    open: false,
    text: '',
    parseMode: 'NONE',
    media: '',
    mediaType: 'photo',
    disablePreview: false,
    disableNotification: false,
    scheduleAt: '',
    inlineButtons: [],
    busy: false,
};

type EditState = {
    post: PostRow | null;
    text: string;
    parseMode: 'NONE' | 'HTML' | 'MarkdownV2';
    busy: boolean;
};

type PromoteDialogState = {
    admin: AdminRow | null;
    canPostMessages: boolean;
    canEditMessages: boolean;
    canDeleteMessages: boolean;
    canInviteUsers: boolean;
    canManageChat: boolean;
    canPinMessages: boolean;
    canPromoteMembers: boolean;
    canChangeInfo: boolean;
    busy: boolean;
};

function formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

function Sparkline({ points }: { points: { date: string; posts: number }[] }) {
    if (points.length === 0) {
        return (
            <div className="flex h-32 items-center justify-center text-xs text-[var(--st-text-secondary)]">
                No data
            </div>
        );
    }
    const max = Math.max(1, ...points.map((p) => p.posts));
    const width = 480;
    const height = 120;
    const step = points.length > 1 ? width / (points.length - 1) : width;
    const path = points
        .map((p, i) => {
            const x = i * step;
            const y = height - (p.posts / max) * (height - 16) - 4;
            return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-32 w-full"
            aria-hidden="true"
        >
            <path
                d={path}
                fill="none"
                stroke="var(--st-accent)"
                strokeWidth={2}
            />
            {points.map((p, i) => {
                const x = i * step;
                const y = height - (p.posts / max) * (height - 16) - 4;
                return (
                    <circle
                        key={`${p.date}-${i}`}
                        cx={x}
                        cy={y}
                        r={2.5}
                        fill="var(--st-accent)"
                    >
                        <title>{`${p.date}: ${p.posts}`}</title>
                    </circle>
                );
            })}
        </svg>
    );
}

export default function ChannelDetailPage() {
    const params = useParams<{ channelId: string }>();
    const channelId = params?.channelId ?? '';
    const { activeProjectId, isLoadingProject } = useProject();
    const { toast } = useToast();
    const projectId = activeProjectId ?? '';

    const [tab, setTab] = React.useState<TabKey>('posts');
    const [channel, setChannel] = React.useState<ChannelRow | null>(null);
    const [loadingChannel, setLoadingChannel] = React.useState(true);
    const [posts, setPosts] = React.useState<PostRow[]>([]);
    const [scheduled, setScheduled] = React.useState<ScheduledRow[]>([]);
    const [admins, setAdmins] = React.useState<AdminRow[]>([]);
    const [stats, setStats] = React.useState<StatsResp | null>(null);
    const [tabBusy, setTabBusy] = React.useState(false);

    const [composer, setComposer] = React.useState<ComposerState>(COMPOSER_INITIAL);
    const [editState, setEditState] = React.useState<EditState>({
        post: null,
        text: '',
        parseMode: 'NONE',
        busy: false,
    });
    const [pendingDeletePost, setPendingDeletePost] =
        React.useState<PostRow | null>(null);
    const [pendingCancelScheduled, setPendingCancelScheduled] =
        React.useState<ScheduledRow | null>(null);
    const [pendingDemote, setPendingDemote] = React.useState<AdminRow | null>(
        null,
    );
    const [promoteState, setPromoteState] = React.useState<PromoteDialogState>({
        admin: null,
        canPostMessages: false,
        canEditMessages: false,
        canDeleteMessages: false,
        canInviteUsers: false,
        canManageChat: false,
        canPinMessages: false,
        canPromoteMembers: false,
        canChangeInfo: false,
        busy: false,
    });

    // Initial channel load.
    React.useEffect(() => {
        if (!projectId || !channelId) return;
        let cancelled = false;
        setLoadingChannel(true);
        getChannel(channelId, projectId)
            .then((res) => {
                if (cancelled) return;
                if (res.error) {
                    toast({
                        title: 'Could not load channel',
                        description: res.error,
                        variant: 'destructive',
                    });
                    setChannel(null);
                } else if (res.channel) {
                    setChannel(res.channel);
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingChannel(false);
            });
        return () => {
            cancelled = true;
        };
    }, [projectId, channelId, toast]);

    const refreshTab = React.useCallback(
        async (next: TabKey) => {
            if (!projectId || !channelId) return;
            setTabBusy(true);
            try {
                if (next === 'posts') {
                    const res = await listPosts(channelId, projectId, { limit: 100 });
                    if (res.error) {
                        toast({
                            title: 'Posts failed',
                            description: res.error,
                            variant: 'destructive',
                        });
                    }
                    setPosts(res.posts ?? []);
                } else if (next === 'scheduled') {
                    const res = await listScheduled(channelId, projectId);
                    if (res.error) {
                        toast({
                            title: 'Scheduled failed',
                            description: res.error,
                            variant: 'destructive',
                        });
                    }
                    setScheduled(res.scheduled ?? []);
                } else if (next === 'admins') {
                    const res = await listAdmins(channelId, projectId);
                    if (res.error) {
                        toast({
                            title: 'Admins failed',
                            description: res.error,
                            variant: 'destructive',
                        });
                    }
                    setAdmins(res.admins ?? []);
                } else if (next === 'stats') {
                    const res = await getStats(channelId, projectId);
                    if (res.error) {
                        toast({
                            title: 'Stats failed',
                            description: res.error,
                            variant: 'destructive',
                        });
                    }
                    setStats(res);
                }
            } finally {
                setTabBusy(false);
            }
        },
        [projectId, channelId, toast],
    );

    React.useEffect(() => {
        void refreshTab(tab);
    }, [tab, refreshTab]);

    const onTabChange = React.useCallback((next: TabKey) => setTab(next), []);

    const handleSubmitPost = React.useCallback(async () => {
        if (!projectId) return;
        const message: PostMessage = {};
        if (composer.text.trim()) message.text = composer.text;
        if (composer.media) {
            message.media = {
                url: composer.media,
                type: composer.mediaType,
            } as MediaItem;
        }
        if (composer.parseMode !== 'NONE') {
            message.parseMode = composer.parseMode;
        }
        if (composer.disablePreview) message.disableWebPagePreview = true;
        if (composer.disableNotification) message.disableNotification = true;
        if (composer.scheduleAt) {
            const at = new Date(composer.scheduleAt);
            if (!Number.isNaN(at.getTime())) {
                message.scheduleAt = at.toISOString();
            }
        }
        if (!message.text && !message.media) {
            toast({
                title: 'Nothing to send',
                description: 'Add text or pick a SabFile.',
                variant: 'destructive',
            });
            return;
        }
        const inlineKeyboard =
            composer.inlineButtons.filter((b) => b.text && b.url).length > 0
                ? {
                      inline_keyboard: [
                          composer.inlineButtons
                              .filter((b) => b.text && b.url)
                              .map((b) => ({ text: b.text, url: b.url })),
                      ],
                  }
                : undefined;
        setComposer((c) => ({ ...c, busy: true }));
        const res = await postToChannel(channelId, {
            projectId,
            message,
            inlineKeyboard,
        });
        setComposer((c) => ({ ...c, busy: false }));
        if (res.success) {
            toast({ title: 'Post sent', description: res.message });
            setComposer(COMPOSER_INITIAL);
            await refreshTab(composer.scheduleAt ? 'scheduled' : 'posts');
            setTab(composer.scheduleAt ? 'scheduled' : 'posts');
        } else {
            toast({
                title: 'Post failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, channelId, composer, toast, refreshTab]);

    const handleEditPost = React.useCallback(async () => {
        if (!projectId || !editState.post) return;
        setEditState((s) => ({ ...s, busy: true }));
        const res = await editChannelPost(channelId, editState.post._id, {
            projectId,
            text: editState.post.kind === 'text' ? editState.text : undefined,
            caption: editState.post.kind !== 'text' ? editState.text : undefined,
            parseMode:
                editState.parseMode === 'NONE' ? undefined : editState.parseMode,
        });
        setEditState((s) => ({ ...s, busy: false }));
        if (res.success) {
            toast({ title: 'Post updated' });
            setEditState({
                post: null,
                text: '',
                parseMode: 'NONE',
                busy: false,
            });
            await refreshTab('posts');
        } else {
            toast({
                title: 'Edit failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, channelId, editState, toast, refreshTab]);

    const handleDeletePost = React.useCallback(async () => {
        if (!projectId || !pendingDeletePost) return;
        const post = pendingDeletePost;
        setPendingDeletePost(null);
        const res = await deleteChannelPost(channelId, post._id, projectId);
        if (res.success) {
            toast({ title: 'Post deleted' });
            setPosts((curr) => curr.filter((p) => p._id !== post._id));
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, channelId, pendingDeletePost, toast]);

    const handleTogglePin = React.useCallback(
        async (post: PostRow) => {
            if (!projectId) return;
            const action = post.isPinned ? 'unpin' : 'pin';
            const res = post.isPinned
                ? await unpinChannelPost(channelId, post._id, projectId)
                : await pinChannelPost(channelId, post._id, { projectId });
            if (res.success) {
                toast({ title: action === 'pin' ? 'Post pinned' : 'Post unpinned' });
                setPosts((curr) =>
                    curr.map((p) =>
                        p._id === post._id ? { ...p, isPinned: !p.isPinned } : p,
                    ),
                );
            } else {
                toast({
                    title: `${action === 'pin' ? 'Pin' : 'Unpin'} failed`,
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [projectId, channelId, toast],
    );

    const handleCancelScheduled = React.useCallback(async () => {
        if (!projectId || !pendingCancelScheduled) return;
        const post = pendingCancelScheduled;
        setPendingCancelScheduled(null);
        const res = await cancelScheduledPost(channelId, post._id, projectId);
        if (res.success) {
            toast({ title: 'Scheduled post cancelled' });
            setScheduled((curr) => curr.filter((p) => p._id !== post._id));
        } else {
            toast({
                title: 'Cancel failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, channelId, pendingCancelScheduled, toast]);

    const openPromoteDialog = React.useCallback((admin: AdminRow | null) => {
        if (!admin) return;
        setPromoteState({
            admin,
            canPostMessages: admin.canPostMessages,
            canEditMessages: admin.canEditMessages,
            canDeleteMessages: admin.canDeleteMessages,
            canInviteUsers: admin.canInviteUsers,
            canManageChat: admin.canManageChat,
            canPinMessages: admin.canPinMessages,
            canPromoteMembers: admin.canPromoteMembers,
            canChangeInfo: admin.canChangeInfo,
            busy: false,
        });
    }, []);

    const handlePromote = React.useCallback(async () => {
        if (!projectId || !promoteState.admin) return;
        setPromoteState((s) => ({ ...s, busy: true }));
        const res = await promoteAdmin(channelId, {
            projectId,
            userId: promoteState.admin.userId,
            can_post_messages: promoteState.canPostMessages,
            can_edit_messages: promoteState.canEditMessages,
            can_delete_messages: promoteState.canDeleteMessages,
            can_invite_users: promoteState.canInviteUsers,
            can_manage_chat: promoteState.canManageChat,
            can_pin_messages: promoteState.canPinMessages,
            can_promote_members: promoteState.canPromoteMembers,
            can_change_info: promoteState.canChangeInfo,
        });
        setPromoteState((s) => ({ ...s, busy: false }));
        if (res.success) {
            toast({ title: 'Member rights updated' });
            setPromoteState((s) => ({ ...s, admin: null }));
            await refreshTab('admins');
        } else {
            toast({
                title: 'Promote failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, channelId, promoteState, toast, refreshTab]);

    const handleDemote = React.useCallback(async () => {
        if (!projectId || !pendingDemote) return;
        const admin = pendingDemote;
        setPendingDemote(null);
        const res = await demoteAdmin(channelId, {
            projectId,
            userId: admin.userId,
        });
        if (res.success) {
            toast({ title: 'Member demoted' });
            await refreshTab('admins');
        } else {
            toast({
                title: 'Demote failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    }, [projectId, channelId, pendingDemote, toast, refreshTab]);

    if (isLoadingProject || loadingChannel) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <Skeleton className="h-8 w-72" />
                <Skeleton className="h-32 w-full rounded-xl" />
                <Skeleton className="h-64 w-full rounded-xl" />
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="p-6">
                <EmptyState
                    title="Pick a project"
                    description="Channel detail is scoped to a project."
                />
            </div>
        );
    }

    if (!channel) {
        return (
            <div className="p-6">
                <EmptyState
                    title="Channel not found"
                    description="It may have been removed or you no longer have access."
                    action={
                        <Link href="/dashboard/telegram/channels">
                            <Button variant="outline" iconLeft={ArrowLeft}>
                                Back to channels
                            </Button>
                        </Link>
                    }
                />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <PageHeader bordered={false}>
                <PageHeaderHeading className="min-w-0 flex-1">
                    <Link
                        href="/dashboard/telegram/channels"
                        className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    >
                        <ArrowLeft className="h-3 w-3" aria-hidden="true" /> Channels
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                        <span
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius-sm)] bg-[var(--st-accent-soft)] text-[var(--st-accent)]"
                            aria-hidden="true"
                        >
                            <Hash className="h-4 w-4" />
                        </span>
                        <PageTitle>{channel.title}</PageTitle>
                        {channel.isVerified ? <Badge>verified</Badge> : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                        {channel.username ? (
                            <a
                                href={`https://t.me/${channel.username}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 hover:text-[var(--st-text)]"
                            >
                                @{channel.username}{' '}
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            </a>
                        ) : (
                            <span>{channel.chatId}</span>
                        )}
                        <Badge variant="outline">{channel.type}</Badge>
                        {channel.isAdmin ? (
                            <Badge variant="secondary">
                                <Crown
                                    className="mr-1 h-3 w-3"
                                    aria-hidden="true"
                                />{' '}
                                Admin
                            </Badge>
                        ) : (
                            <Badge variant="danger">
                                <AlertCircle
                                    className="mr-1 h-3 w-3"
                                    aria-hidden="true"
                                />{' '}
                                Not admin
                            </Badge>
                        )}
                        <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" aria-hidden="true" />
                            {channel.memberCount ?? '-'}
                        </span>
                    </div>
                </PageHeaderHeading>
                <PageActions>
                    <Button
                        variant="primary"
                        iconLeft={MessageSquarePlus}
                        onClick={() =>
                            setComposer({ ...COMPOSER_INITIAL, open: true })
                        }
                        disabled={!channel.permissions.canPostMessages}
                    >
                        New post
                    </Button>
                </PageActions>
            </PageHeader>

            {/* Permission warning */}
            {!channel.permissions.canPostMessages ? (
                <Alert tone="warning" title="Posting is disabled">
                    The bot lacks the <code>can_post_messages</code> permission on
                    this channel. Update its admin rights in Telegram to enable
                    posting.
                </Alert>
            ) : null}

            {/* Segmented tabs */}
            <SegmentedControl<TabKey>
                items={TAB_ITEMS}
                value={tab}
                onChange={onTabChange}
                aria-label="Channel sections"
            />

            {/* Tab body */}
            {tabBusy ? (
                <Skeleton className="h-48 w-full rounded-xl" />
            ) : tab === 'posts' ? (
                <PostsTab
                    posts={posts}
                    onTogglePin={handleTogglePin}
                    onEdit={(post) =>
                        setEditState({
                            post,
                            text: post.text ?? '',
                            parseMode: 'NONE',
                            busy: false,
                        })
                    }
                    onDelete={setPendingDeletePost}
                />
            ) : tab === 'scheduled' ? (
                <ScheduledTab
                    scheduled={scheduled}
                    onCancel={setPendingCancelScheduled}
                />
            ) : tab === 'admins' ? (
                <AdminsTab
                    admins={admins}
                    onEditRights={openPromoteDialog}
                    onDemote={setPendingDemote}
                />
            ) : (
                <StatsTab stats={stats} />
            )}

            {/* Composer */}
            <ComposerDialog
                state={composer}
                onChange={setComposer}
                onClose={() => setComposer(COMPOSER_INITIAL)}
                onSubmit={handleSubmitPost}
            />

            {/* Edit dialog */}
            <Dialog
                open={!!editState.post}
                onOpenChange={(o) =>
                    o
                        ? null
                        : setEditState({
                              post: null,
                              text: '',
                              parseMode: 'NONE',
                              busy: false,
                          })
                }
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit post</DialogTitle>
                        <DialogDescription>
                            {editState.post?.kind === 'text'
                                ? 'Editing the text body.'
                                : 'Editing the media caption.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3">
                        <Field label="Message">
                            <Textarea
                                rows={5}
                                value={editState.text}
                                onChange={(e) =>
                                    setEditState((s) => ({
                                        ...s,
                                        text: e.target.value,
                                    }))
                                }
                                placeholder="Updated text"
                            />
                        </Field>
                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-[var(--st-text-secondary)]">
                                Parse mode
                            </Label>
                            <Select
                                value={editState.parseMode}
                                onValueChange={(v: 'NONE' | 'HTML' | 'MarkdownV2') =>
                                    setEditState((s) => ({ ...s, parseMode: v }))
                                }
                            >
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">Plain text</SelectItem>
                                    <SelectItem value="HTML">HTML</SelectItem>
                                    <SelectItem value="MarkdownV2">
                                        MarkdownV2
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() =>
                                setEditState({
                                    post: null,
                                    text: '',
                                    parseMode: 'NONE',
                                    busy: false,
                                })
                            }
                            disabled={editState.busy}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            iconLeft={PenSquare}
                            onClick={handleEditPost}
                            loading={editState.busy}
                        >
                            Save
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Promote dialog */}
            <Dialog
                open={!!promoteState.admin}
                onOpenChange={(o) =>
                    o ? null : setPromoteState((s) => ({ ...s, admin: null }))
                }
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>
                            Edit rights for {promoteState.admin?.name}
                        </DialogTitle>
                        <DialogDescription>
                            Telegram only honours these flags for non-creator admins.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-2">
                        {(
                            [
                                ['canPostMessages', 'Post messages'],
                                ['canEditMessages', 'Edit messages'],
                                ['canDeleteMessages', 'Delete messages'],
                                ['canInviteUsers', 'Invite users'],
                                ['canManageChat', 'Manage chat'],
                                ['canPinMessages', 'Pin messages'],
                                ['canChangeInfo', 'Change info'],
                                ['canPromoteMembers', 'Promote members'],
                            ] as const
                        ).map(([key, label]) => (
                            <Checkbox
                                key={key}
                                label={label}
                                className="rounded-[var(--st-radius-sm)] border border-[var(--st-border)] p-2"
                                checked={promoteState[key]}
                                onChange={(e) =>
                                    setPromoteState((s) => ({
                                        ...s,
                                        [key]: e.target.checked,
                                    }))
                                }
                            />
                        ))}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() =>
                                setPromoteState((s) => ({ ...s, admin: null }))
                            }
                            disabled={promoteState.busy}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            iconLeft={Crown}
                            onClick={handlePromote}
                            loading={promoteState.busy}
                        >
                            Save rights
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Confirm dialogs */}
            <AlertDialog
                open={!!pendingDeletePost}
                onOpenChange={(o) => (o ? null : setPendingDeletePost(null))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete post?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This also deletes the message from Telegram. Channel posts
                            can only be deleted by an admin with the right permission.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeletePost}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={!!pendingCancelScheduled}
                onOpenChange={(o) => (o ? null : setPendingCancelScheduled(null))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancel scheduled post?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This stops the worker from sending the post. You can
                            recreate it later from the composer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction onClick={handleCancelScheduled}>
                            Cancel post
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={!!pendingDemote}
                onOpenChange={(o) => (o ? null : setPendingDemote(null))}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Demote {pendingDemote?.name}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Telegram will revoke every administrative right from this
                            member. Channel creators cannot be demoted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDemote}>
                            Demote
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Tab views
// ---------------------------------------------------------------------------

function PostsTab({
    posts,
    onTogglePin,
    onEdit,
    onDelete,
}: {
    posts: PostRow[];
    onTogglePin: (p: PostRow) => void;
    onEdit: (p: PostRow) => void;
    onDelete: (p: PostRow) => void;
}) {
    if (posts.length === 0) {
        return (
            <EmptyState
                title="No posts yet"
                description="Use the New post button to publish text or media."
            />
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {posts.map((p) => (
                <Card key={p._id} padding="sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                                <Badge variant="outline">#{p.messageId}</Badge>
                                <Badge variant="outline">{p.kind}</Badge>
                                {p.isPinned ? (
                                    <Badge variant="secondary">
                                        <Pin
                                            className="mr-1 h-3 w-3"
                                            aria-hidden="true"
                                        />{' '}
                                        pinned
                                    </Badge>
                                ) : null}
                                <span className="inline-flex items-center gap-1">
                                    <Calendar
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                    />{' '}
                                    {formatDate(p.sentAt)}
                                </span>
                                {typeof p.views === 'number' && p.views > 0 ? (
                                    <span className="inline-flex items-center gap-1">
                                        <Eye
                                            className="h-3 w-3"
                                            aria-hidden="true"
                                        />{' '}
                                        {p.views}
                                    </span>
                                ) : null}
                            </div>
                            {p.text ? (
                                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-[var(--st-text)]">
                                    {p.text}
                                </p>
                            ) : (
                                <p className="mt-2 text-xs italic text-[var(--st-text-secondary)]">
                                    Media post (no caption).
                                </p>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                            <IconButton
                                icon={p.isPinned ? PinOff : Pin}
                                label={p.isPinned ? 'Unpin' : 'Pin'}
                                size="sm"
                                onClick={() => onTogglePin(p)}
                            />
                            <IconButton
                                icon={PenSquare}
                                label="Edit"
                                size="sm"
                                onClick={() => onEdit(p)}
                            />
                            <IconButton
                                icon={Trash2}
                                label="Delete"
                                size="sm"
                                onClick={() => onDelete(p)}
                            />
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function ScheduledTab({
    scheduled,
    onCancel,
}: {
    scheduled: ScheduledRow[];
    onCancel: (s: ScheduledRow) => void;
}) {
    if (scheduled.length === 0) {
        return (
            <EmptyState
                title="Nothing scheduled"
                description="Schedule a post with a future Send at time from the composer."
            />
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {scheduled.map((p) => (
                <Card key={p._id} padding="sm">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                                <Badge variant="outline">{p.status}</Badge>
                                <span className="inline-flex items-center gap-1">
                                    <Calendar
                                        className="h-3 w-3"
                                        aria-hidden="true"
                                    />{' '}
                                    Sends {formatDate(p.scheduledAt)}
                                </span>
                            </div>
                            <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-[var(--st-text)]">
                                {p.message.text || (
                                    <span className="italic text-[var(--st-text-secondary)]">
                                        Media post.
                                    </span>
                                )}
                            </p>
                        </div>
                        <IconButton
                            icon={Trash2}
                            label="Cancel scheduled post"
                            size="sm"
                            onClick={() => onCancel(p)}
                        />
                    </div>
                </Card>
            ))}
        </div>
    );
}

function AdminsTab({
    admins,
    onEditRights,
    onDemote,
}: {
    admins: AdminRow[];
    onEditRights: (a: AdminRow) => void;
    onDemote: (a: AdminRow) => void;
}) {
    if (admins.length === 0) {
        return (
            <EmptyState
                title="No administrators"
                description="The Bot API only returns admins for channels/supergroups the bot can read."
            />
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {admins.map((a) => (
                <Card key={a.userId} padding="sm">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                        >
                            <Users className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-[var(--st-text)]">
                                    {a.name}
                                </span>
                                <Badge
                                    variant={
                                        a.status === 'creator'
                                            ? 'secondary'
                                            : 'outline'
                                    }
                                >
                                    {a.status}
                                </Badge>
                            </div>
                            {a.username ? (
                                <a
                                    href={`https://t.me/${a.username}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                                >
                                    @{a.username}
                                </a>
                            ) : (
                                <span className="text-xs text-[var(--st-text-secondary)]">
                                    #{a.userId}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                iconLeft={PenSquare}
                                disabled={a.status === 'creator'}
                                onClick={() => onEditRights(a)}
                            >
                                Edit rights
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={a.status === 'creator'}
                                onClick={() => onDemote(a)}
                            >
                                Demote
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}

function StatsTab({ stats }: { stats: StatsResp | null }) {
    if (!stats) {
        return <Skeleton className="h-48 w-full rounded-xl" />;
    }
    return (
        <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="Posts (30d)" value={stats.postsCount} />
                <StatCard
                    label="Total views (mirror)"
                    value={stats.totalViews}
                />
                <StatCard label="Pending scheduled" value={stats.scheduledCount} />
            </div>
            <Card>
                <div className="mb-2 text-xs font-medium text-[var(--st-text)]">
                    Posts over time
                </div>
                <Sparkline points={stats.series} />
                <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--st-text-secondary)]">
                    <span>{stats.series[0]?.date ?? ''}</span>
                    <span>{stats.series.at(-1)?.date ?? ''}</span>
                </div>
            </Card>
            <Card>
                <div className="mb-2 text-xs font-medium text-[var(--st-text)]">
                    Top posts
                </div>
                {stats.topPosts.length === 0 ? (
                    <div className="text-xs text-[var(--st-text-secondary)]">
                        No mirrored posts in the window.
                    </div>
                ) : (
                    <ul className="flex flex-col gap-1.5">
                        {stats.topPosts.map((p) => (
                            <li
                                key={p._id}
                                className="flex items-center justify-between gap-2 text-sm"
                            >
                                <span className="truncate">
                                    {p.text ?? (
                                        <span className="italic text-[var(--st-text-secondary)]">
                                            Media post
                                        </span>
                                    )}
                                </span>
                                <span className="inline-flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                                    <Eye className="h-3 w-3" aria-hidden="true" />{' '}
                                    {p.views ?? 0}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Composer
// ---------------------------------------------------------------------------

function ComposerDialog({
    state,
    onChange,
    onClose,
    onSubmit,
}: {
    state: ComposerState;
    onChange: (s: ComposerState) => void;
    onClose: () => void;
    onSubmit: () => void;
}) {
    return (
        <Dialog open={state.open} onOpenChange={(o) => (o ? null : onClose())}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>New channel post</DialogTitle>
                    <DialogDescription>
                        Compose text, attach a SabFile, build an inline keyboard, and
                        optionally schedule it for later.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                    <Field label="Message">
                        <Textarea
                            rows={5}
                            value={state.text}
                            onChange={(e) =>
                                onChange({ ...state, text: e.target.value })
                            }
                            placeholder="What's on your mind?"
                        />
                    </Field>

                    <div className="flex flex-wrap items-center gap-2">
                        <Label className="text-xs text-[var(--st-text-secondary)]">
                            Parse mode
                        </Label>
                        <Select
                            value={state.parseMode}
                            onValueChange={(v: ComposerState['parseMode']) =>
                                onChange({ ...state, parseMode: v })
                            }
                        >
                            <SelectTrigger className="w-[160px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="NONE">Plain text</SelectItem>
                                <SelectItem value="HTML">HTML</SelectItem>
                                <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                            </SelectContent>
                        </Select>

                        <Label className="ml-3 text-xs text-[var(--st-text-secondary)]">
                            Media type
                        </Label>
                        <Select
                            value={state.mediaType}
                            onValueChange={(v: ComposerState['mediaType']) =>
                                onChange({ ...state, mediaType: v })
                            }
                        >
                            <SelectTrigger className="w-[140px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="photo">Photo</SelectItem>
                                <SelectItem value="video">Video</SelectItem>
                                <SelectItem value="audio">Audio</SelectItem>
                                <SelectItem value="document">Document</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Field label="Attachment (SabFiles)">
                        <SabFileUrlInput
                            value={state.media}
                            onChange={(v) => onChange({ ...state, media: v })}
                            accept={
                                state.mediaType === 'photo'
                                    ? 'image'
                                    : state.mediaType === 'video'
                                      ? 'video'
                                      : state.mediaType === 'audio'
                                        ? 'audio'
                                        : 'document'
                            }
                            placeholder="No file chosen"
                            pickerTitle="Pick a file from SabFiles"
                        />
                    </Field>

                    {/* Inline keyboard builder */}
                    <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2">
                        <div className="mb-1.5 flex items-center justify-between">
                            <Label className="text-xs text-[var(--st-text-secondary)]">
                                Inline buttons
                            </Label>
                            <Button
                                variant="ghost"
                                size="sm"
                                iconLeft={Plus}
                                onClick={() =>
                                    onChange({
                                        ...state,
                                        inlineButtons: [
                                            ...state.inlineButtons,
                                            { text: '', url: '' },
                                        ],
                                    })
                                }
                            >
                                Add button
                            </Button>
                        </div>
                        {state.inlineButtons.length === 0 ? (
                            <p className="text-[11px] text-[var(--st-text-secondary)]">
                                Add up to a row of URL buttons.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-1.5">
                                {state.inlineButtons.map((b, i) => (
                                    <div
                                        key={`btn-${i}`}
                                        className="flex items-center gap-2"
                                    >
                                        <Input
                                            value={b.text}
                                            placeholder="Button label"
                                            aria-label={`Button ${i + 1} label`}
                                            onChange={(e) => {
                                                const next =
                                                    state.inlineButtons.slice();
                                                next[i] = {
                                                    ...next[i],
                                                    text: e.target.value,
                                                };
                                                onChange({
                                                    ...state,
                                                    inlineButtons: next,
                                                });
                                            }}
                                        />
                                        <Input
                                            value={b.url}
                                            placeholder="https://example.com"
                                            aria-label={`Button ${i + 1} URL`}
                                            onChange={(e) => {
                                                const next =
                                                    state.inlineButtons.slice();
                                                next[i] = {
                                                    ...next[i],
                                                    url: e.target.value,
                                                };
                                                onChange({
                                                    ...state,
                                                    inlineButtons: next,
                                                });
                                            }}
                                        />
                                        <IconButton
                                            icon={Trash2}
                                            label="Remove button"
                                            size="sm"
                                            onClick={() => {
                                                const next =
                                                    state.inlineButtons.slice();
                                                next.splice(i, 1);
                                                onChange({
                                                    ...state,
                                                    inlineButtons: next,
                                                });
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Checkbox
                            label="Disable link preview"
                            checked={state.disablePreview}
                            onChange={(e) =>
                                onChange({
                                    ...state,
                                    disablePreview: e.target.checked,
                                })
                            }
                        />
                        <Checkbox
                            label="Silent"
                            checked={state.disableNotification}
                            onChange={(e) =>
                                onChange({
                                    ...state,
                                    disableNotification: e.target.checked,
                                })
                            }
                        />
                    </div>

                    <Field
                        label="Schedule (optional)"
                        help="Leave empty to send now. Scheduled posts are queued for a worker; cancel them anytime from the Scheduled tab."
                    >
                        <Input
                            type="datetime-local"
                            value={state.scheduleAt}
                            onChange={(e) =>
                                onChange({ ...state, scheduleAt: e.target.value })
                            }
                        />
                    </Field>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} disabled={state.busy}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        iconLeft={state.scheduleAt ? Calendar : MessageSquarePlus}
                        onClick={onSubmit}
                        loading={state.busy}
                    >
                        {state.scheduleAt ? 'Schedule' : 'Send'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

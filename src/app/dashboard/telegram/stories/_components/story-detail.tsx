import React, { useEffect, useState } from 'react';
import { Badge, Button, ZoruDrawerDescription, ZoruDrawerHeader, ZoruDrawerTitle } from '@/components/zoruui';
import { ImageIcon, Pencil, Send, Trash2, VideoIcon, X, XCircle } from 'lucide-react';
import type { StoryRow, StoryStatus } from '@/lib/rust-client/telegram-stories';

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

function fmtDateClient(iso?: string): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
}

function fmtRelativeClient(iso?: string): string {
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

export function StoryDetail({
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
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <>
            <ZoruDrawerHeader>
                <ZoruDrawerTitle>Story · {row.type}</ZoruDrawerTitle>
                <ZoruDrawerDescription>
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                        {row.status}
                    </Badge>{' '}
                    {mounted ? (
                        isPosted ? (
                            <>
                                posted {fmtRelativeClient(row.postedAt)}, expires{' '}
                                {fmtRelativeClient(row.expiresAt)}.
                            </>
                        ) : row.status === 'scheduled' ? (
                            <>
                                scheduled for {fmtDateClient(row.scheduledAt)} (
                                {fmtRelativeClient(row.scheduledAt)}).
                            </>
                        ) : (
                            <>created {fmtRelativeClient(row.createdAt)}.</>
                        )
                    ) : null}
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

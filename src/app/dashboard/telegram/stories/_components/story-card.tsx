import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';
import { ImageIcon, MoreVertical, Pencil, Send, Trash2, VideoIcon, X, XCircle } from 'lucide-react';
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

export function StoryCard({
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
    
    // Avoid hydration mismatch by rendering time only after mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const timestamp = mounted ? (isPosted
        ? `Posted ${fmtRelativeClient(row.postedAt)}`
        : row.status === 'scheduled'
            ? `Scheduled ${fmtRelativeClient(row.scheduledAt)}`
            : `Created ${fmtRelativeClient(row.createdAt)}`) : '';

    return (
        <Card className="overflow-hidden">
            <div
                className="relative flex h-44 w-full cursor-pointer items-center justify-center bg-[var(--st-bg-muted)]"
                onClick={onOpen}
            >
                {isPhoto ? (
                    <ImageIcon className="h-8 w-8 text-[var(--st-text-tertiary)]" />
                ) : (
                    <VideoIcon className="h-8 w-8 text-[var(--st-text-tertiary)]" />
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                    <Badge variant={STATUS_VARIANT[row.status] ?? 'secondary'}>
                        {row.status}
                    </Badge>
                    <Badge variant="ghost">{row.type}</Badge>
                </div>
                <div className="absolute right-2 top-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Actions"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={onOpen}>
                                Open
                            </DropdownMenuItem>
                            {!isPosted && row.status !== 'deleted' ? (
                                <>
                                    <DropdownMenuItem onClick={onEdit}>
                                        <Pencil className="h-3.5 w-3.5" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={onPostNow}>
                                        <Send className="h-3.5 w-3.5" /> Post now
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                            {row.status === 'scheduled' ? (
                                <DropdownMenuItem onClick={onCancel}>
                                    <X className="h-3.5 w-3.5" /> Cancel
                                </DropdownMenuItem>
                            ) : null}
                            {isPosted ? (
                                <DropdownMenuItem
                                    onClick={onDeleteOnTelegram}
                                >
                                    <XCircle className="h-3.5 w-3.5" />
                                    Delete on Telegram
                                </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onDeleteLocal}>
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete local
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="flex flex-col gap-1.5 p-3">
                <p className="line-clamp-2 text-[13px] text-[var(--st-text)]">
                    {row.content.caption || (
                        <span className="italic text-[var(--st-text-secondary)]">
                            No caption
                        </span>
                    )}
                </p>
                <p className="text-[11.5px] text-[var(--st-text-secondary)] h-[16px]">{timestamp}</p>
                {isFinal && row.errorMessage ? (
                    <p className="line-clamp-2 text-[11.5px] text-[var(--st-danger)]">
                        {row.errorMessage}
                    </p>
                ) : null}
            </div>
        </Card>
    );
}

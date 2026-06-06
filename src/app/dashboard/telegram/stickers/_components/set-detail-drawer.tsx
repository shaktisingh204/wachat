import * as React from 'react';
import { Badge, Button, Card, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, StatCard, EmptyState, Skeleton, useToast, cn } from '@/components/sabcrm/20ui';
import {
  Sticker as StickerIcon,
  Plus,
  Image as ImageIcon,
  Layers,
  Smile,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Replace,
  X,
  Loader2,
  RefreshCw,
  Archive,
} from 'lucide-react';
import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../../_components/telegram-project-gate';
import type {
    SetRow,
    StickerRow,
    StickerType,
    StickerInputBody,
    MaskPositionDto,
} from '@/lib/rust-client/telegram-stickers';
import {
    getStickerSetAction,
    archiveStickerSetAction,
    addStickerAction,
    deleteStickerAction,
    setStickerSetTitleAction,
    setStickerSetThumbnailAction,
    setStickerEmojiListAction,
    setStickerKeywordsAction,
    setStickerMaskPositionAction,
    setStickerPositionAction,
    replaceStickerAction,
} from '@/app/actions/telegram-stickers.actions';
// ---------------------------------------------------------------------------

export function SetDetailDrawer({
    open,
    onOpenChange,
    setName,
    projectId,
    botId,
    botUsername,
    onMutate,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    setName: string;
    projectId: string;
    botId: string;
    botUsername: string;
    onMutate: () => void;
}) {
    const { toast } = useToast();
    const [set, setSet] = React.useState<SetRow | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [busy, setBusy] = React.useState<string | null>(null);

    const reload = React.useCallback(async () => {
        setLoading(true);
        const res = await getStickerSetAction(setName, projectId, botId);
        setLoading(false);
        if (res.error) {
            toast({
                title: 'Failed to load pack',
                description: res.error,
                variant: 'destructive',
            });
            return;
        }
        setSet(res.set ?? null);
    }, [setName, projectId, botId, toast]);

    React.useEffect(() => {
        if (!open) return;
        void reload();
    }, [open, reload]);

    const ownerUserId = React.useRef('');

    if (!open) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full max-w-3xl flex-col gap-4 overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <StickerIcon className="h-5 w-5" /> {set?.title ?? setName}
                    </SheetTitle>
                    <SheetDescription>
                        <code className="font-mono text-[12px]">{setName}</code>
                        {set?.archived && (
                            <Badge variant="ghost" className="ml-2 text-[var(--st-text)]">
                                Archived
                            </Badge>
                        )}
                    </SheetDescription>
                </SheetHeader>

                {loading || !set ? (
                    <Skeleton className="h-[420px] w-full" />
                ) : (
                    <DetailBody
                        set={set}
                        ownerUserIdRef={ownerUserId}
                        botUsername={botUsername}
                        busy={busy}
                        setBusy={setBusy}
                        onMutated={async () => {
                            await reload();
                            onMutate();
                        }}
                        projectId={projectId}
                        botId={botId}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function DetailBody({
    set,
    ownerUserIdRef,
    busy,
    setBusy,
    onMutated,
    projectId,
    botId,
    botUsername: _botUsername,
}: {
    set: SetRow;
    ownerUserIdRef: React.MutableRefObject<string>;
    botUsername: string;
    busy: string | null;
    setBusy: (k: string | null) => void;
    onMutated: () => Promise<void> | void;
    projectId: string;
    botId: string;
}) {
    const { toast } = useToast();

    const [editTitleOpen, setEditTitleOpen] = React.useState(false);
    const [newTitle, setNewTitle] = React.useState(set.title);

    const [ownerUserId, setOwnerUserId] = React.useState(ownerUserIdRef.current);
    React.useEffect(() => {
        ownerUserIdRef.current = ownerUserId;
    }, [ownerUserId, ownerUserIdRef]);
    const ownerUserIdNum = Number(ownerUserId.trim());
    const ownerOk = Number.isFinite(ownerUserIdNum) && ownerUserIdNum > 0;

    const handleArchive = async () => {
        setBusy('archive');
        const res = await archiveStickerSetAction(set.name, projectId, botId);
        setBusy(null);
        if (res.success) {
            toast({ title: 'Pack archived', description: res.message });
            await onMutated();
        } else {
            toast({
                title: 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const handleTitle = async () => {
        if (!newTitle.trim()) return;
        setBusy('title');
        const res = await setStickerSetTitleAction(set.name, {
            projectId,
            botId,
            title: newTitle.trim(),
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Title updated' });
            setEditTitleOpen(false);
            await onMutated();
        } else {
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const handleThumbnail = async (pick: SabFilePick | null) => {
        if (!ownerOk) {
            toast({
                title: 'Owner user id required',
                description: 'Enter the numeric Telegram user id at the top of this drawer first.',
                variant: 'destructive',
            });
            return;
        }
        setBusy('thumbnail');
        const res = await setStickerSetThumbnailAction(set.name, {
            projectId,
            botId,
            userId: ownerUserIdNum,
            sabFileId: pick?.id ?? null,
            sabFileUrl: pick?.url ?? null,
        });
        setBusy(null);
        if (res.success) {
            toast({ title: pick ? 'Thumbnail updated' : 'Thumbnail cleared' });
            await onMutated();
        } else {
            toast({
                title: 'Thumbnail change failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const handleMove = async (sticker: StickerRow, direction: -1 | 1) => {
        const nextPos = Math.max(0, sticker.positionInSet + direction);
        setBusy(`pos-${sticker.fileId}`);
        const res = await setStickerPositionAction(set.name, sticker.fileId, {
            projectId,
            botId,
            position: nextPos,
        });
        setBusy(null);
        if (res.success) await onMutated();
        else
            toast({
                title: 'Reorder failed',
                description: res.error,
                variant: 'destructive',
            });
    };

    const handleDeleteSticker = async (sticker: StickerRow) => {
        setBusy(`del-${sticker.fileId}`);
        const res = await deleteStickerAction(set.name, sticker.fileId, projectId, botId);
        setBusy(null);
        if (res.success) await onMutated();
        else
            toast({
                title: 'Remove failed',
                description: res.error,
                variant: 'destructive',
            });
    };

    const handleEmoji = async (sticker: StickerRow, value: string) => {
        const emojiList = value
            .split(/[,\s]+/)
            .filter(Boolean);
        if (emojiList.length === 0) return;
        setBusy(`emoji-${sticker.fileId}`);
        const res = await setStickerEmojiListAction(set.name, sticker.fileId, {
            projectId,
            botId,
            emojiList,
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Emojis updated' });
            await onMutated();
        } else
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
    };

    const handleKeywords = async (sticker: StickerRow, value: string) => {
        const keywords = value
            .split(/[,\n]/)
            .map((k) => k.trim())
            .filter(Boolean);
        setBusy(`kw-${sticker.fileId}`);
        const res = await setStickerKeywordsAction(set.name, sticker.fileId, {
            projectId,
            botId,
            keywords,
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Keywords updated' });
            await onMutated();
        } else
            toast({
                title: 'Update failed',
                description: res.error,
                variant: 'destructive',
            });
    };

    const handleMask = async (sticker: StickerRow, mp: MaskPositionDto | null) => {
        setBusy(`mask-${sticker.fileId}`);
        const res = await setStickerMaskPositionAction(set.name, sticker.fileId, {
            projectId,
            botId,
            maskPosition: mp,
        });
        setBusy(null);
        if (res.success) await onMutated();
        else
            toast({
                title: 'Mask change failed',
                description: res.error,
                variant: 'destructive',
            });
    };

    const handleReplace = async (sticker: StickerRow, pick: SabFilePick) => {
        if (!ownerOk) {
            toast({
                title: 'Owner user id required',
                description: 'Enter the numeric Telegram user id at the top of this drawer first.',
                variant: 'destructive',
            });
            return;
        }
        setBusy(`replace-${sticker.fileId}`);
        const res = await replaceStickerAction(set.name, sticker.fileId, {
            projectId,
            botId,
            userId: ownerUserIdNum,
            sabFileId: pick.id,
            sabFileUrl: pick.url,
            sabFileName: pick.name,
            emoji: sticker.emoji || '🧷',
            keywords: sticker.keywords,
            maskPosition: sticker.maskPosition,
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Sticker replaced' });
            await onMutated();
        } else
            toast({
                title: 'Replace failed',
                description: res.error,
                variant: 'destructive',
            });
    };

    const handleAdd = async (pick: SabFilePick, emoji: string) => {
        if (!ownerOk) {
            toast({
                title: 'Owner user id required',
                description: 'Enter the numeric Telegram user id at the top of this drawer first.',
                variant: 'destructive',
            });
            return;
        }
        setBusy('add');
        const res = await addStickerAction(set.name, {
            projectId,
            botId,
            userId: ownerUserIdNum,
            sticker: {
                sabFileId: pick.id,
                sabFileUrl: pick.url,
                sabFileName: pick.name,
                emoji,
            },
        });
        setBusy(null);
        if (res.success) {
            toast({ title: 'Sticker added' });
            await onMutated();
        } else
            toast({
                title: 'Add failed',
                description: res.error,
                variant: 'destructive',
            });
    };

    const sortedStickers = React.useMemo(
        () => [...set.stickers].sort((a, b) => a.positionInSet - b.positionInSet),
        [set.stickers],
    );

    return (
        <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]">
                    {set.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={set.thumbnailUrl}
                            alt={set.title}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <StickerIcon className="h-8 w-8 text-[var(--st-text-secondary)]" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-[16px] font-medium text-[var(--st-text)]">
                            {set.title}
                        </h3>
                        <Badge variant="ghost" className="capitalize">
                            {set.stickerType.replace('_', ' ')}
                        </Badge>
                    </div>
                    <p className="truncate text-[12px] text-[var(--st-text-secondary)]">
                        {set.stickerCount} stickers · created{' '}
                        <span suppressHydrationWarning>{new Date(set.createdAt).toLocaleDateString()}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setNewTitle(set.title);
                            setEditTitleOpen((v) => !v);
                        }}
                    >
                        <Pencil className="h-4 w-4" /> Title
                    </Button>
                    <SabFilePickerButton
                        accept="image"
                        variant="outline"
                        className="text-[12.5px]"
                        onPick={(p) => handleThumbnail(p)}
                    >
                        <ImageIcon className="h-4 w-4" /> Thumbnail
                    </SabFilePickerButton>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleThumbnail(null)}
                        disabled={!set.thumbnailUrl || busy === 'thumbnail'}
                    >
                        <X className="h-4 w-4" /> Clear
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleArchive}
                        disabled={set.archived || busy === 'archive'}
                    >
                        <Archive className="h-4 w-4" /> Archive
                    </Button>
                </div>
            </Card>

            {editTitleOpen && (
                <Card className="flex items-center gap-2 p-2">
                    <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="New title"
                        maxLength={64}
                    />
                    <Button size="sm" onClick={handleTitle} disabled={busy === 'title'}>
                        {busy === 'title' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditTitleOpen(false)}
                    >
                        Cancel
                    </Button>
                </Card>
            )}

            <Card className="flex flex-col gap-2 p-3">
                <Label>Owner Telegram user id</Label>
                <Input
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                    placeholder="123456789"
                    inputMode="numeric"
                />
                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                    Required for adding new stickers, replacing a file, or changing the thumbnail.
                </p>
            </Card>

            <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-medium text-[var(--st-text)]">Stickers</h4>
                <SabFilePickerButton
                    accept="image"
                    variant="outline"
                    onPick={(p) => handleAdd(p, '🧷')}
                >
                    <Plus className="h-4 w-4" /> Add sticker
                </SabFilePickerButton>
            </div>

            {sortedStickers.length === 0 ? (
                <EmptyState
                    compact
                    icon={<StickerIcon className="h-5 w-5 text-[var(--st-text-secondary)]" />}
                    title="No stickers in this pack yet"
                    description="Use Add sticker to upload one from SabFiles."
                />
            ) : (
                <ul className="flex flex-col gap-2">
                    {sortedStickers.map((sticker, idx) => (
                        <StickerRowEditor
                            key={sticker.fileId}
                            sticker={sticker}
                            isFirst={idx === 0}
                            isLast={idx === sortedStickers.length - 1}
                            busy={busy}
                            stickerType={set.stickerType}
                            onMoveUp={() => handleMove(sticker, -1)}
                            onMoveDown={() => handleMove(sticker, 1)}
                            onEmoji={(v) => handleEmoji(sticker, v)}
                            onKeywords={(v) => handleKeywords(sticker, v)}
                            onMask={(mp) => handleMask(sticker, mp)}
                            onDelete={() => handleDeleteSticker(sticker)}
                            onReplace={(p) => handleReplace(sticker, p)}
                        />
                    ))}
                </ul>
            )}
        </div>
    );
}

function StickerRowEditor({
    sticker,
    isFirst,
    isLast,
    busy,
    stickerType,
    onMoveUp,
    onMoveDown,
    onEmoji,
    onKeywords,
    onMask,
    onDelete,
    onReplace,
}: {
    sticker: StickerRow;
    isFirst: boolean;
    isLast: boolean;
    busy: string | null;
    stickerType: StickerType;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onEmoji: (v: string) => void;
    onKeywords: (v: string) => void;
    onMask: (mp: MaskPositionDto | null) => void;
    onDelete: () => void;
    onReplace: (p: SabFilePick) => void;
}) {
    const [emoji, setEmoji] = React.useState(sticker.emoji);
    const [keywords, setKeywords] = React.useState(sticker.keywords.join(', '));
    const [maskPoint, setMaskPoint] = React.useState(sticker.maskPosition?.point ?? '');
    const [maskX, setMaskX] = React.useState(sticker.maskPosition?.xShift ?? 0);
    const [maskY, setMaskY] = React.useState(sticker.maskPosition?.yShift ?? 0);
    const [maskScale, setMaskScale] = React.useState(sticker.maskPosition?.scale ?? 1);

    React.useEffect(() => {
        setEmoji(sticker.emoji);
        setKeywords(sticker.keywords.join(', '));
        setMaskPoint(sticker.maskPosition?.point ?? '');
        setMaskX(sticker.maskPosition?.xShift ?? 0);
        setMaskY(sticker.maskPosition?.yShift ?? 0);
        setMaskScale(sticker.maskPosition?.scale ?? 1);
    }, [sticker.fileId, sticker.emoji, sticker.keywords, sticker.maskPosition]);

    return (
        <li className="grid gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3">
            <TelegramProjectGate />
            <div className="flex items-center gap-3">
                <span className="rounded-md bg-[var(--st-bg-secondary)] px-2 py-0.5 font-mono text-[11px] text-[var(--st-text-secondary)]">
                    #{sticker.positionInSet + 1}
                </span>
                <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--st-text-secondary)]">
                    {sticker.fileId}
                </div>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move up"
                    onClick={onMoveUp}
                    disabled={isFirst || busy === `pos-${sticker.fileId}`}
                >
                    <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move down"
                    onClick={onMoveDown}
                    disabled={isLast || busy === `pos-${sticker.fileId}`}
                >
                    <ArrowDown className="h-4 w-4" />
                </Button>
                <SabFilePickerButton
                    accept="image"
                    variant="ghost"
                    className="px-2"
                    onPick={onReplace}
                >
                    <Replace className="h-4 w-4" />
                </SabFilePickerButton>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    onClick={onDelete}
                    disabled={busy === `del-${sticker.fileId}`}
                >
                    <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Label className="text-[11px]">Emoji(s)</Label>
                        <Input
                            value={emoji}
                            onChange={(e) => setEmoji(e.target.value)}
                            placeholder="😺🐾"
                        />
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEmoji(emoji)}
                        disabled={busy === `emoji-${sticker.fileId}`}
                    >
                        Save
                    </Button>
                </div>
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <Label className="text-[11px]">Keywords</Label>
                        <Input
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="comma, separated"
                        />
                    </div>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onKeywords(keywords)}
                        disabled={busy === `kw-${sticker.fileId}`}
                    >
                        Save
                    </Button>
                </div>
            </div>
            {stickerType === 'mask' && (
                <div className="grid gap-2 rounded-[var(--st-radius-sm)] border border-dashed border-[var(--st-border)] p-2 sm:grid-cols-5">
                    <div className="flex flex-col gap-1">
                        <Label className="text-[11px]">Anchor</Label>
                        <Select value={maskPoint} onValueChange={(v) => setMaskPoint(v)}>
                            <SelectTrigger>
                                <SelectValue placeholder="forehead" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="forehead">forehead</SelectItem>
                                <SelectItem value="eyes">eyes</SelectItem>
                                <SelectItem value="mouth">mouth</SelectItem>
                                <SelectItem value="chin">chin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <NumberField label="x shift" value={maskX} onChange={setMaskX} step={0.1} />
                    <NumberField label="y shift" value={maskY} onChange={setMaskY} step={0.1} />
                    <NumberField label="scale" value={maskScale} onChange={setMaskScale} step={0.1} />
                    <div className="flex items-end">
                        <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === `mask-${sticker.fileId}` || !maskPoint}
                            onClick={() =>
                                onMask({
                                    point: maskPoint,
                                    xShift: maskX,
                                    yShift: maskY,
                                    scale: maskScale,
                                })
                            }
                        >
                            Save mask
                        </Button>
                    </div>
                </div>
            )}
        </li>
    );
}

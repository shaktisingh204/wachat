import * as React from 'react';
import { Badge, Button, Card, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, StatCard, EmptyState, Skeleton, useToast, cn } from '@/components/sabcrm/20ui/compat';
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
import { createStickerSetAction } from '@/app/actions/telegram-stickers.actions';
//  Create-pack drawer (3-step wizard)
// ---------------------------------------------------------------------------

interface DraftSticker {
    sabFileId?: string;
    sabFileUrl: string;
    sabFileName?: string;
    sabFileMime?: string;
    emoji: string;
    keywords: string;
    maskPoint?: string;
    maskXShift?: number;
    maskYShift?: number;
    maskScale?: number;
}

export function CreatePackDrawer({
    open,
    onOpenChange,
    projectId,
    botId,
    botUsername,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    projectId: string;
    botId: string;
    botUsername: string;
    onCreated: () => void;
}) {
    const { toast } = useToast();
    const [step, setStep] = React.useState<1 | 2 | 3>(1);
    const [submitting, setSubmitting] = React.useState(false);

    // Step 1
    const [ownerUserId, setOwnerUserId] = React.useState('');
    const [shortName, setShortName] = React.useState('');
    const [title, setTitle] = React.useState('');
    const [stickerType, setStickerType] = React.useState<StickerType>('regular');

    // Step 2
    const [stickers, setStickers] = React.useState<DraftSticker[]>([]);

    // Reset when the drawer (re)opens.
    React.useEffect(() => {
        if (!open) return;
        setStep(1);
        setOwnerUserId('');
        setShortName('');
        setTitle('');
        setStickerType('regular');
        setStickers([]);
    }, [open]);

    const fullPackName = React.useMemo(() => {
        if (!shortName) return '';
        const suffix = `_by_${botUsername}`;
        return shortName.endsWith(suffix) ? shortName : `${shortName}${suffix}`;
    }, [shortName, botUsername]);

    const ownerUserIdNumber = Number(ownerUserId.trim());
    const step1Valid =
        ownerUserId.trim() !== '' &&
        Number.isFinite(ownerUserIdNumber) &&
        ownerUserIdNumber > 0 &&
        title.trim() !== '' &&
        /^[A-Za-z0-9_]+$/.test(fullPackName);

    const step2Valid =
        stickers.length > 0 &&
        stickers.every((s) => s.sabFileUrl && s.emoji.trim() !== '') &&
        (stickerType !== 'mask' ||
            stickers.every((s) => s.maskPoint && Number.isFinite(s.maskScale ?? NaN)));

    const handleAddSticker = (pick: SabFilePick) => {
        setStickers((arr) => [
            ...arr,
            {
                sabFileId: pick.id,
                sabFileUrl: pick.url,
                sabFileName: pick.name,
                sabFileMime: pick.mime,
                emoji: '',
                keywords: '',
            },
        ]);
    };

    const submit = async () => {
        if (!step2Valid) return;
        setSubmitting(true);
        const payload = {
            projectId,
            botId,
            userId: ownerUserIdNumber,
            name: shortName,
            title: title.trim(),
            stickerType,
            stickers: stickers.map<StickerInputBody>((s) => ({
                sabFileId: s.sabFileId,
                sabFileUrl: s.sabFileUrl,
                sabFileName: s.sabFileName,
                emoji: s.emoji.trim(),
                keywords: s.keywords
                    .split(/[,\n]/)
                    .map((k) => k.trim())
                    .filter(Boolean),
                maskPosition:
                    stickerType === 'mask' && s.maskPoint
                        ? {
                              point: s.maskPoint,
                              xShift: s.maskXShift ?? 0,
                              yShift: s.maskYShift ?? 0,
                              scale: s.maskScale ?? 1,
                          }
                        : undefined,
            })),
        };
        const res = await createStickerSetAction(payload);
        setSubmitting(false);
        if (res.success) {
            toast({ title: 'Pack created', description: res.message });
            onCreated();
        } else {
            toast({
                title: 'Could not create pack',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="flex w-full max-w-2xl flex-col gap-4 overflow-y-auto"
            >
                <SheetHeader>
                    <SheetTitle>New sticker pack</SheetTitle>
                    <SheetDescription>
                        Step {step} of 3 — {step === 1 ? 'basics' : step === 2 ? 'stickers' : 'review'}.
                    </SheetDescription>
                </SheetHeader>

                <Stepper step={step} />

                {step === 1 && (
                    <Step1Basics
                        ownerUserId={ownerUserId}
                        setOwnerUserId={setOwnerUserId}
                        shortName={shortName}
                        setShortName={setShortName}
                        title={title}
                        setTitle={setTitle}
                        stickerType={stickerType}
                        setStickerType={setStickerType}
                        botUsername={botUsername}
                        fullPackName={fullPackName}
                    />
                )}

                {step === 2 && (
                    <Step2Stickers
                        stickers={stickers}
                        setStickers={setStickers}
                        stickerType={stickerType}
                        onAdd={handleAddSticker}
                    />
                )}

                {step === 3 && (
                    <Step3Review
                        ownerUserId={ownerUserId}
                        fullPackName={fullPackName}
                        title={title}
                        stickerType={stickerType}
                        stickers={stickers}
                    />
                )}

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--st-border)] pt-3">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </Button>
                    <div className="flex items-center gap-2">
                        {step > 1 && (
                            <Button
                                variant="outline"
                                onClick={() => setStep((s) => ((s - 1) || 1) as 1 | 2 | 3)}
                                disabled={submitting}
                            >
                                Back
                            </Button>
                        )}
                        {step < 3 && (
                            <Button
                                onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
                                disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                            >
                                Next
                            </Button>
                        )}
                        {step === 3 && (
                            <Button onClick={submit} disabled={submitting || !step2Valid}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Create pack
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
    return (
        <ol className="flex items-center gap-2 text-[12px] text-[var(--st-text-secondary)]">
            {[
                { n: 1, label: 'Basics' },
                { n: 2, label: 'Stickers' },
                { n: 3, label: 'Review' },
            ].map((s) => (
                <li
                    key={s.n}
                    className={cn(
                        'flex items-center gap-2 rounded-full border border-[var(--st-border)] px-2.5 py-1',
                        step === s.n && 'border-[var(--st-text)] bg-[var(--st-text)] text-[var(--st-text-inverted)]',
                    )}
                >
                    <span
                        className={cn(
                            'inline-flex h-4 w-4 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[10px] font-semibold',
                            step === s.n && 'bg-[var(--st-text-inverted)] text-[var(--st-text)]',
                        )}
                    >
                        {s.n}
                    </span>
                    {s.label}
                </li>
            ))}
        </ol>
    );
}

function Step1Basics({
    ownerUserId,
    setOwnerUserId,
    shortName,
    setShortName,
    title,
    setTitle,
    stickerType,
    setStickerType,
    botUsername,
    fullPackName,
}: {
    ownerUserId: string;
    setOwnerUserId: (v: string) => void;
    shortName: string;
    setShortName: (v: string) => void;
    title: string;
    setTitle: (v: string) => void;
    stickerType: StickerType;
    setStickerType: (t: StickerType) => void;
    botUsername: string;
    fullPackName: string;
}) {
    const validName = fullPackName === '' || /^[A-Za-z0-9_]+$/.test(fullPackName);
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <Label>Owner Telegram user id</Label>
                <Input
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                    placeholder="123456789"
                    inputMode="numeric"
                />
                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                    Numeric Telegram user id of the pack owner. The bot must have already
                    spoken to this user. Find it via @userinfobot.
                </p>
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Pack short name</Label>
                <Input
                    value={shortName}
                    onChange={(e) =>
                        setShortName(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))
                    }
                    placeholder="my_cats"
                />
                <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                    Letters, digits, underscores. We'll suffix with{' '}
                    <code>_by_{botUsername}</code> if missing.
                </p>
                {fullPackName && (
                    <div
                        className={cn(
                            'rounded-[var(--st-radius)] border px-3 py-2 text-[12px]',
                            validName
                                ? 'border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]'
                                : 'border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]',
                        )}
                    >
                        Final name: <code className="font-mono">{fullPackName}</code>
                        {!validName && (
                            <div className="mt-1 text-[11.5px]">
                                Name must match [A-Za-z0-9_]+_by_{botUsername}.
                            </div>
                        )}
                    </div>
                )}
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Title</Label>
                <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My Cats"
                    maxLength={64}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <Label>Sticker type</Label>
                <Select
                    value={stickerType}
                    onValueChange={(v) => setStickerType(v as StickerType)}
                >
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="regular">Regular</SelectItem>
                        <SelectItem value="mask">Mask</SelectItem>
                        <SelectItem value="custom_emoji">Custom emoji</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}

function Step2Stickers({
    stickers,
    setStickers,
    stickerType,
    onAdd,
}: {
    stickers: DraftSticker[];
    setStickers: React.Dispatch<React.SetStateAction<DraftSticker[]>>;
    stickerType: StickerType;
    onAdd: (pick: SabFilePick) => void;
}) {
    const update = (idx: number, patch: Partial<DraftSticker>) => {
        setStickers((arr) => arr.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
    };
    const remove = (idx: number) => {
        setStickers((arr) => arr.filter((_, i) => i !== idx));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                    Add up to 50 stickers. Each needs 1–20 emojis (and a mask position for
                    mask packs).
                </p>
                <SabFilePickerButton
                    accept="image"
                    onPick={onAdd}
                    variant="outline"
                    className="shrink-0"
                >
                    <Plus className="h-4 w-4" /> Add sticker file
                </SabFilePickerButton>
            </div>
            {stickers.length === 0 && (
                <EmptyState
                    compact
                    icon={<StickerIcon className="h-5 w-5 text-[var(--st-text-secondary)]" />}
                    title="No stickers yet"
                    description="Pick a file from SabFiles to begin."
                />
            )}
            <ul className="flex flex-col gap-2">
                {stickers.map((s, idx) => (
                    <li
                        key={`${s.sabFileId}-${idx}`}
                        className="flex flex-col gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--st-radius-sm)] bg-[var(--st-bg-secondary)]">
                                {s.sabFileMime?.startsWith('image/') ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={s.sabFileUrl}
                                        alt={s.sabFileName ?? ''}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <ImageIcon className="h-6 w-6 text-[var(--st-text-secondary)]" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium text-[var(--st-text)]">
                                    {s.sabFileName ?? 'Sticker'}
                                </div>
                                <div className="truncate text-[11px] text-[var(--st-text-secondary)]">
                                    {s.sabFileMime ?? 'unknown mime'}
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove"
                                onClick={() => remove(idx)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <Label className="text-[11px]">Emoji(s)</Label>
                                <Input
                                    value={s.emoji}
                                    onChange={(e) => update(idx, { emoji: e.target.value })}
                                    placeholder="😺🐾"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <Label className="text-[11px]">Keywords</Label>
                                <Input
                                    value={s.keywords}
                                    onChange={(e) => update(idx, { keywords: e.target.value })}
                                    placeholder="cat, kitten"
                                />
                            </div>
                        </div>
                        {stickerType === 'mask' && (
                            <MaskFields
                                point={s.maskPoint}
                                xShift={s.maskXShift}
                                yShift={s.maskYShift}
                                scale={s.maskScale}
                                onChange={(patch) => update(idx, patch)}
                            />
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function MaskFields({
    point,
    xShift,
    yShift,
    scale,
    onChange,
}: {
    point?: string;
    xShift?: number;
    yShift?: number;
    scale?: number;
    onChange: (patch: Partial<DraftSticker>) => void;
}) {
    return (
        <div className="grid gap-2 rounded-[var(--st-radius-sm)] border border-dashed border-[var(--st-border)] p-2 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
                <Label className="text-[11px]">Anchor</Label>
                <Select value={point} onValueChange={(v) => onChange({ maskPoint: v })}>
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
            <NumberField
                label="x shift"
                value={xShift}
                onChange={(v) => onChange({ maskXShift: v })}
                step={0.1}
            />
            <NumberField
                label="y shift"
                value={yShift}
                onChange={(v) => onChange({ maskYShift: v })}
                step={0.1}
            />
            <NumberField
                label="scale"
                value={scale}
                onChange={(v) => onChange({ maskScale: v })}
                step={0.1}
            />
        </div>
    );
}

function NumberField({
    label,
    value,
    onChange,
    step,
}: {
    label: string;
    value?: number;
    onChange: (v: number) => void;
    step?: number;
}) {
    return (
        <div className="flex flex-col gap-1">
            <Label className="text-[11px]">{label}</Label>
            <Input
                type="number"
                value={value ?? ''}
                onChange={(e) => onChange(Number(e.target.value))}
                step={step}
            />
        </div>
    );
}

function Step3Review({
    ownerUserId,
    fullPackName,
    title,
    stickerType,
    stickers,
}: {
    ownerUserId: string;
    fullPackName: string;
    title: string;
    stickerType: StickerType;
    stickers: DraftSticker[];
}) {
    return (
        <div className="flex flex-col gap-3">
            <Card className="grid gap-2 p-3 text-[13px]">
                <Row label="Owner user id" value={ownerUserId} />
                <Row label="Pack name" value={<code className="font-mono">{fullPackName}</code>} />
                <Row label="Title" value={title} />
                <Row label="Type" value={<span className="capitalize">{stickerType.replace('_', ' ')}</span>} />
                <Row label="Sticker count" value={String(stickers.length)} />
            </Card>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {stickers.map((s, i) => (
                    <div
                        key={i}
                        className="flex aspect-square items-center justify-center overflow-hidden rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)]"
                    >
                        {s.sabFileMime?.startsWith('image/') ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={s.sabFileUrl}
                                alt={s.emoji}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <span className="text-2xl">{s.emoji || '🧷'}</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-[var(--st-border)]/60 py-1.5 last:border-b-0">
            <span className="text-[11px] uppercase tracking-[0.1em] text-[var(--st-text-secondary)]">
                {label}
            </span>
            <span className="text-[13px] text-[var(--st-text)]">{value || '—'}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------

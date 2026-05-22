'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSelectContent,
  ZoruSelectItem,
  Sheet,
  ZoruSheetContent,
  ZoruSheetHeader,
  ZoruSheetTitle,
  ZoruSheetDescription,
  StatCard,
  EmptyState,
  Skeleton,
  useZoruToast,
  cn,
} from '@/components/zoruui';
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

/**
 * /dashboard/telegram/stickers
 *
 * Full sticker-pack manager backed by the `telegram-stickers` Rust BFF
 * crate.  The page lets the user:
 *   1. Pick a connected bot (from the active project).
 *   2. See KPIs across the bot's packs.
 *   3. Browse pack cards (refreshed from Telegram on demand).
 *   4. Create a new pack via a 3-step wizard drawer.
 *   5. Open a detail drawer to edit title/thumbnail, reorder stickers,
 *      and add / replace / remove individual stickers.
 *
 * All file inputs go through `<SabFilePickerButton>` — SabNode policy
 * is that every file lives in SabFiles (no external URL paste).
 */

import * as React from 'react';

import { SabFilePickerButton, type SabFilePick } from '@/components/sabfiles';
import { useProject } from '@/context/project-context';
import { TelegramProjectGate } from '../_components/telegram-project-gate';

import {
    listProjectBotsForStickersAction,
    listStickerSetsAction,
    getStickerSetAction,
    createStickerSetAction,
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
import type {
    SetRow,
    StickerRow,
    StickerType,
    StickerInputBody,
    MaskPositionDto,
} from '@/lib/rust-client/telegram-stickers';

const ACCENT = '#229ED9';

// ---------------------------------------------------------------------------
//  Page
// ---------------------------------------------------------------------------

interface BotChoice {
    _id: string;
    username: string;
    name: string;
    botId: number;
}

export default function TelegramStickersPage() {
    const { activeProjectId } = useProject();
    const { toast } = useZoruToast();

    const [bots, setBots] = React.useState<BotChoice[]>([]);
    const [botsLoading, setBotsLoading] = React.useState(false);
    const [selectedBotId, setSelectedBotId] = React.useState<string | null>(null);

    const selectedBot = React.useMemo(
        () => bots.find((b) => b._id === selectedBotId) ?? null,
        [bots, selectedBotId],
    );

    const [sets, setSets] = React.useState<SetRow[]>([]);
    const [setsLoading, setSetsLoading] = React.useState(false);
    const [setsError, setSetsError] = React.useState<string | null>(null);
    const [refreshing, setRefreshing] = React.useState(false);

    const [createOpen, setCreateOpen] = React.useState(false);
    const [activeSetName, setActiveSetName] = React.useState<string | null>(null);

    // Load bots when the active project changes.
    React.useEffect(() => {
        if (!activeProjectId) {
            setBots([]);
            setSelectedBotId(null);
            return;
        }
        let cancelled = false;
        setBotsLoading(true);
        void (async () => {
            const res = await listProjectBotsForStickersAction(activeProjectId);
            if (cancelled) return;
            setBotsLoading(false);
            if (res.error) {
                toast({
                    title: 'Could not load bots',
                    description: res.error,
                    variant: 'destructive',
                });
                setBots([]);
                return;
            }
            setBots(res.bots);
            if (res.bots.length > 0) {
                setSelectedBotId((curr) => curr ?? res.bots[0]._id);
            } else {
                setSelectedBotId(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeProjectId, toast]);

    const loadSets = React.useCallback(
        async (opts?: { refresh?: boolean; silent?: boolean }) => {
            if (!activeProjectId || !selectedBotId) {
                setSets([]);
                return;
            }
            if (!opts?.silent) {
                if (opts?.refresh) setRefreshing(true);
                else setSetsLoading(true);
            }
            setSetsError(null);
            const res = await listStickerSetsAction(activeProjectId, selectedBotId, {
                refresh: opts?.refresh,
            });
            setSetsLoading(false);
            setRefreshing(false);
            if (res.error) {
                setSetsError(res.error);
                if (!opts?.silent) {
                    toast({
                        title: 'Failed to load packs',
                        description: res.error,
                        variant: 'destructive',
                    });
                }
                return;
            }
            setSets(res.sets);
        },
        [activeProjectId, selectedBotId, toast],
    );

    React.useEffect(() => {
        void loadSets();
    }, [loadSets]);

    // KPIs
    const kpi = React.useMemo(() => {
        const totalSets = sets.length;
        const totalStickers = sets.reduce((acc, s) => acc + (s.stickerCount ?? 0), 0);
        const maskSets = sets.filter((s) => s.stickerType === 'mask').length;
        const customEmojiSets = sets.filter((s) => s.stickerType === 'custom_emoji').length;
        return { totalSets, totalStickers, maskSets, customEmojiSets };
    }, [sets]);

    return (
        <div className="flex flex-col gap-6">
            <Header
                onRefresh={() => loadSets({ refresh: true })}
                refreshing={refreshing}
                onCreate={() => setCreateOpen(true)}
                disabled={!selectedBot || !activeProjectId}
            />

            <BotSelector
                bots={bots}
                selectedBotId={selectedBotId}
                onSelect={setSelectedBotId}
                loading={botsLoading}
            />

            {!activeProjectId ? (
                <ZoruEmptyState
                    icon={<StickerIcon className="h-6 w-6 text-zoru-ink-muted" />}
                    title="Select a project"
                    description="Pick a project from the sidebar to manage sticker packs."
                />
            ) : !selectedBot ? (
                botsLoading ? (
                    <KpiSkeleton />
                ) : (
                    <ZoruEmptyState
                        icon={<StickerIcon className="h-6 w-6 text-zoru-ink-muted" />}
                        title="No connected bots yet"
                        description="Connect a Telegram bot in /dashboard/telegram/connections to start managing sticker packs."
                    />
                )
            ) : (
                <>
                    <Kpis kpi={kpi} />

                    {setsLoading ? (
                        <GridSkeleton />
                    ) : setsError ? (
                        <ZoruEmptyState
                            icon={<StickerIcon className="h-6 w-6 text-zoru-ink-muted" />}
                            title="Couldn't load packs"
                            description={setsError}
                            action={
                                <ZoruButton variant="outline" size="sm" onClick={() => loadSets()}>
                                    Try again
                                </ZoruButton>
                            }
                        />
                    ) : sets.length === 0 ? (
                        <ZoruEmptyState
                            icon={<StickerIcon className="h-6 w-6 text-zoru-ink-muted" />}
                            title="No sticker packs yet"
                            description="Create your first pack to publish stickers via this bot."
                            action={
                                <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" /> New sticker pack
                                </ZoruButton>
                            }
                        />
                    ) : (
                        <SetsGrid sets={sets} onOpen={(s) => setActiveSetName(s.name)} />
                    )}
                </>
            )}

            {selectedBot && activeProjectId && (
                <CreatePackDrawer
                    open={createOpen}
                    onOpenChange={setCreateOpen}
                    botUsername={selectedBot.username}
                    botId={selectedBot._id}
                    projectId={activeProjectId}
                    onCreated={() => {
                        setCreateOpen(false);
                        void loadSets({ silent: true });
                    }}
                />
            )}

            {selectedBot && activeProjectId && activeSetName && (
                <SetDetailDrawer
                    key={activeSetName}
                    open={activeSetName !== null}
                    onOpenChange={(v) => {
                        if (!v) setActiveSetName(null);
                    }}
                    setName={activeSetName}
                    projectId={activeProjectId}
                    botId={selectedBot._id}
                    botUsername={selectedBot.username}
                    onMutate={() => loadSets({ silent: true })}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Header
// ---------------------------------------------------------------------------

function Header({
    onCreate,
    onRefresh,
    refreshing,
    disabled,
}: {
    onCreate: () => void;
    onRefresh: () => void;
    refreshing: boolean;
    disabled?: boolean;
}) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
                <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                    style={{
                        background: 'linear-gradient(135deg, #37BBFE 0%, #007DBB 100%)',
                        boxShadow: `0 10px 28px ${ACCENT}40`,
                    }}
                >
                    <StickerIcon className="h-6 w-6 text-white" strokeWidth={1.75} />
                </div>
                <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                        Telegram
                    </p>
                    <h1 className="text-[22px] leading-tight text-zoru-ink">Telegram Stickers</h1>
                    <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zoru-ink-muted">
                        Create, edit and publish sticker packs through the bot you select.
                        Files come from your SabFiles library — no external URLs.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={onRefresh}
                    disabled={disabled || refreshing}
                >
                    {refreshing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                </ZoruButton>
                <ZoruButton size="sm" onClick={onCreate} disabled={disabled}>
                    <Plus className="h-4 w-4" /> New sticker pack
                </ZoruButton>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Bot selector
// ---------------------------------------------------------------------------

function BotSelector({
    bots,
    selectedBotId,
    onSelect,
    loading,
}: {
    bots: BotChoice[];
    selectedBotId: string | null;
    onSelect: (id: string) => void;
    loading: boolean;
}) {
    return (
        <ZoruCard className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                <div className="text-[11px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                    Bot
                </div>
                <div className="text-[13.5px] text-zoru-ink">
                    {loading ? 'Loading connected bots…' : 'Pick which bot owns these packs.'}
                </div>
            </div>
            <div className="flex w-full max-w-sm items-center gap-2">
                <ZoruSelect
                    value={selectedBotId ?? undefined}
                    onValueChange={(v) => onSelect(v)}
                    disabled={loading || bots.length === 0}
                >
                    <ZoruSelectTrigger className="w-full">
                        <ZoruSelectValue
                            placeholder={
                                loading
                                    ? 'Loading bots…'
                                    : bots.length === 0
                                      ? 'No bots connected'
                                      : 'Select a bot'
                            }
                        />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {bots.map((b) => (
                            <ZoruSelectItem key={b._id} value={b._id}>
                                <span className="flex items-center gap-2">
                                    <span className="font-medium">{b.name || b.username}</span>
                                    <span className="text-zoru-ink-muted">@{b.username}</span>
                                </span>
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </ZoruSelect>
            </div>
        </ZoruCard>
    );
}

// ---------------------------------------------------------------------------
//  KPIs
// ---------------------------------------------------------------------------

function Kpis({
    kpi,
}: {
    kpi: { totalSets: number; totalStickers: number; maskSets: number; customEmojiSets: number };
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ZoruStatCard
                label="Total sets"
                value={kpi.totalSets}
                icon={<Layers className="h-4 w-4" />}
            />
            <ZoruStatCard
                label="Total stickers"
                value={kpi.totalStickers}
                icon={<StickerIcon className="h-4 w-4" />}
            />
            <ZoruStatCard
                label="Mask sets"
                value={kpi.maskSets}
                icon={<Smile className="h-4 w-4" />}
            />
            <ZoruStatCard
                label="Custom emoji sets"
                value={kpi.customEmojiSets}
                icon={<ImageIcon className="h-4 w-4" />}
            />
        </div>
    );
}

function KpiSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
                <ZoruSkeleton key={i} className="h-[88px] w-full" />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Sets grid
// ---------------------------------------------------------------------------

function GridSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <ZoruSkeleton key={i} className="h-[180px] w-full" />
            ))}
        </div>
    );
}

function SetsGrid({ sets, onOpen }: { sets: SetRow[]; onOpen: (s: SetRow) => void }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sets.map((s) => (
                <button
                    key={s._id}
                    type="button"
                    onClick={() => onOpen(s)}
                    className={cn(
                        'group flex flex-col items-stretch gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-bg p-3 text-left transition-colors hover:border-zoru-ink/40',
                        s.archived && 'opacity-60',
                    )}
                >
                    <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-surface">
                        {s.thumbnailUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={s.thumbnailUrl}
                                alt={s.title}
                                className="h-full w-full object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <StickerIcon className="h-10 w-10 text-zoru-ink-muted" />
                        )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="truncate text-[14px] font-medium text-zoru-ink">
                                {s.title || s.name}
                            </div>
                            <div className="truncate text-[11.5px] text-zoru-ink-muted">
                                {s.name}
                            </div>
                        </div>
                        <ZoruBadge variant="ghost" className="capitalize">
                            {s.stickerType.replace('_', ' ')}
                        </ZoruBadge>
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-zoru-ink-muted">
                        <span>
                            {s.stickerCount} {s.stickerCount === 1 ? 'sticker' : 'stickers'}
                        </span>
                        {s.archived && <span className="text-amber-600">Archived</span>}
                    </div>
                </button>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
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

function CreatePackDrawer({
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
    const { toast } = useZoruToast();
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
        <ZoruSheet open={open} onOpenChange={onOpenChange}>
            <ZoruSheetContent
                side="right"
                className="flex w-full max-w-2xl flex-col gap-4 overflow-y-auto"
            >
                <ZoruSheetHeader>
                    <ZoruSheetTitle>New sticker pack</ZoruSheetTitle>
                    <ZoruSheetDescription>
                        Step {step} of 3 — {step === 1 ? 'basics' : step === 2 ? 'stickers' : 'review'}.
                    </ZoruSheetDescription>
                </ZoruSheetHeader>

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

                <div className="mt-auto flex items-center justify-between gap-2 border-t border-zoru-line pt-3">
                    <ZoruButton
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={submitting}
                    >
                        Cancel
                    </ZoruButton>
                    <div className="flex items-center gap-2">
                        {step > 1 && (
                            <ZoruButton
                                variant="outline"
                                onClick={() => setStep((s) => ((s - 1) || 1) as 1 | 2 | 3)}
                                disabled={submitting}
                            >
                                Back
                            </ZoruButton>
                        )}
                        {step < 3 && (
                            <ZoruButton
                                onClick={() => setStep((s) => ((s + 1) as 1 | 2 | 3))}
                                disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                            >
                                Next
                            </ZoruButton>
                        )}
                        {step === 3 && (
                            <ZoruButton onClick={submit} disabled={submitting || !step2Valid}>
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                Create pack
                            </ZoruButton>
                        )}
                    </div>
                </div>
            </ZoruSheetContent>
        </ZoruSheet>
    );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
    return (
        <ol className="flex items-center gap-2 text-[12px] text-zoru-ink-muted">
            {[
                { n: 1, label: 'Basics' },
                { n: 2, label: 'Stickers' },
                { n: 3, label: 'Review' },
            ].map((s) => (
                <li
                    key={s.n}
                    className={cn(
                        'flex items-center gap-2 rounded-full border border-zoru-line px-2.5 py-1',
                        step === s.n && 'border-zoru-ink bg-zoru-ink text-zoru-on-primary',
                    )}
                >
                    <span
                        className={cn(
                            'inline-flex h-4 w-4 items-center justify-center rounded-full bg-zoru-surface text-[10px] font-semibold',
                            step === s.n && 'bg-zoru-on-primary text-zoru-ink',
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
                <ZoruLabel>Owner Telegram user id</ZoruLabel>
                <ZoruInput
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                    placeholder="123456789"
                    inputMode="numeric"
                />
                <p className="text-[11.5px] text-zoru-ink-muted">
                    Numeric Telegram user id of the pack owner. The bot must have already
                    spoken to this user. Find it via @userinfobot.
                </p>
            </div>
            <div className="flex flex-col gap-1.5">
                <ZoruLabel>Pack short name</ZoruLabel>
                <ZoruInput
                    value={shortName}
                    onChange={(e) =>
                        setShortName(e.target.value.replace(/[^A-Za-z0-9_]/g, ''))
                    }
                    placeholder="my_cats"
                />
                <p className="text-[11.5px] text-zoru-ink-muted">
                    Letters, digits, underscores. We'll suffix with{' '}
                    <code>_by_{botUsername}</code> if missing.
                </p>
                {fullPackName && (
                    <div
                        className={cn(
                            'rounded-[var(--zoru-radius)] border px-3 py-2 text-[12px]',
                            validName
                                ? 'border-zoru-line bg-zoru-surface text-zoru-ink'
                                : 'border-red-300 bg-red-50 text-red-700',
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
                <ZoruLabel>Title</ZoruLabel>
                <ZoruInput
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="My Cats"
                    maxLength={64}
                />
            </div>
            <div className="flex flex-col gap-1.5">
                <ZoruLabel>Sticker type</ZoruLabel>
                <ZoruSelect
                    value={stickerType}
                    onValueChange={(v) => setStickerType(v as StickerType)}
                >
                    <ZoruSelectTrigger>
                        <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="regular">Regular</ZoruSelectItem>
                        <ZoruSelectItem value="mask">Mask</ZoruSelectItem>
                        <ZoruSelectItem value="custom_emoji">Custom emoji</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
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
                <p className="text-[12.5px] text-zoru-ink-muted">
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
                <ZoruEmptyState
                    compact
                    icon={<StickerIcon className="h-5 w-5 text-zoru-ink-muted" />}
                    title="No stickers yet"
                    description="Pick a file from SabFiles to begin."
                />
            )}
            <ul className="flex flex-col gap-2">
                {stickers.map((s, idx) => (
                    <li
                        key={`${s.sabFileId}-${idx}`}
                        className="flex flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--zoru-radius-sm)] bg-zoru-surface">
                                {s.sabFileMime?.startsWith('image/') ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={s.sabFileUrl}
                                        alt={s.sabFileName ?? ''}
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <ImageIcon className="h-6 w-6 text-zoru-ink-muted" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium text-zoru-ink">
                                    {s.sabFileName ?? 'Sticker'}
                                </div>
                                <div className="truncate text-[11px] text-zoru-ink-muted">
                                    {s.sabFileMime ?? 'unknown mime'}
                                </div>
                            </div>
                            <ZoruButton
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Remove"
                                onClick={() => remove(idx)}
                            >
                                <X className="h-4 w-4" />
                            </ZoruButton>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            <div className="flex flex-col gap-1">
                                <ZoruLabel className="text-[11px]">Emoji(s)</ZoruLabel>
                                <ZoruInput
                                    value={s.emoji}
                                    onChange={(e) => update(idx, { emoji: e.target.value })}
                                    placeholder="😺🐾"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <ZoruLabel className="text-[11px]">Keywords</ZoruLabel>
                                <ZoruInput
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
        <div className="grid gap-2 rounded-[var(--zoru-radius-sm)] border border-dashed border-zoru-line p-2 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
                <ZoruLabel className="text-[11px]">Anchor</ZoruLabel>
                <ZoruSelect value={point} onValueChange={(v) => onChange({ maskPoint: v })}>
                    <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="forehead" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="forehead">forehead</ZoruSelectItem>
                        <ZoruSelectItem value="eyes">eyes</ZoruSelectItem>
                        <ZoruSelectItem value="mouth">mouth</ZoruSelectItem>
                        <ZoruSelectItem value="chin">chin</ZoruSelectItem>
                    </ZoruSelectContent>
                </ZoruSelect>
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
            <ZoruLabel className="text-[11px]">{label}</ZoruLabel>
            <ZoruInput
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
            <ZoruCard className="grid gap-2 p-3 text-[13px]">
                <Row label="Owner user id" value={ownerUserId} />
                <Row label="Pack name" value={<code className="font-mono">{fullPackName}</code>} />
                <Row label="Title" value={title} />
                <Row label="Type" value={<span className="capitalize">{stickerType.replace('_', ' ')}</span>} />
                <Row label="Sticker count" value={String(stickers.length)} />
            </ZoruCard>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {stickers.map((s, i) => (
                    <div
                        key={i}
                        className="flex aspect-square items-center justify-center overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-surface"
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
        <div className="flex items-center justify-between gap-3 border-b border-zoru-line/60 py-1.5 last:border-b-0">
            <span className="text-[11px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                {label}
            </span>
            <span className="text-[13px] text-zoru-ink">{value || '—'}</span>
        </div>
    );
}

// ---------------------------------------------------------------------------
//  Detail drawer
// ---------------------------------------------------------------------------

function SetDetailDrawer({
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
    const { toast } = useZoruToast();
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
        <ZoruSheet open={open} onOpenChange={onOpenChange}>
            <ZoruSheetContent
                side="right"
                className="flex w-full max-w-3xl flex-col gap-4 overflow-y-auto"
            >
                <ZoruSheetHeader>
                    <ZoruSheetTitle className="flex items-center gap-2">
                        <StickerIcon className="h-5 w-5" /> {set?.title ?? setName}
                    </ZoruSheetTitle>
                    <ZoruSheetDescription>
                        <code className="font-mono text-[12px]">{setName}</code>
                        {set?.archived && (
                            <ZoruBadge variant="ghost" className="ml-2 text-amber-700">
                                Archived
                            </ZoruBadge>
                        )}
                    </ZoruSheetDescription>
                </ZoruSheetHeader>

                {loading || !set ? (
                    <ZoruSkeleton className="h-[420px] w-full" />
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
            </ZoruSheetContent>
        </ZoruSheet>
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
    const { toast } = useZoruToast();

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
            <ZoruCard className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--zoru-radius)] bg-zoru-surface">
                    {set.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={set.thumbnailUrl}
                            alt={set.title}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <StickerIcon className="h-8 w-8 text-zoru-ink-muted" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="truncate text-[16px] font-medium text-zoru-ink">
                            {set.title}
                        </h3>
                        <ZoruBadge variant="ghost" className="capitalize">
                            {set.stickerType.replace('_', ' ')}
                        </ZoruBadge>
                    </div>
                    <p className="truncate text-[12px] text-zoru-ink-muted">
                        {set.stickerCount} stickers · created{' '}
                        {new Date(set.createdAt).toLocaleDateString()}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <ZoruButton
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setNewTitle(set.title);
                            setEditTitleOpen((v) => !v);
                        }}
                    >
                        <Pencil className="h-4 w-4" /> Title
                    </ZoruButton>
                    <SabFilePickerButton
                        accept="image"
                        variant="outline"
                        className="text-[12.5px]"
                        onPick={(p) => handleThumbnail(p)}
                    >
                        <ImageIcon className="h-4 w-4" /> Thumbnail
                    </SabFilePickerButton>
                    <ZoruButton
                        variant="outline"
                        size="sm"
                        onClick={() => handleThumbnail(null)}
                        disabled={!set.thumbnailUrl || busy === 'thumbnail'}
                    >
                        <X className="h-4 w-4" /> Clear
                    </ZoruButton>
                    <ZoruButton
                        variant="outline"
                        size="sm"
                        onClick={handleArchive}
                        disabled={set.archived || busy === 'archive'}
                    >
                        <Archive className="h-4 w-4" /> Archive
                    </ZoruButton>
                </div>
            </ZoruCard>

            {editTitleOpen && (
                <ZoruCard className="flex items-center gap-2 p-2">
                    <ZoruInput
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="New title"
                        maxLength={64}
                    />
                    <ZoruButton size="sm" onClick={handleTitle} disabled={busy === 'title'}>
                        {busy === 'title' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save
                    </ZoruButton>
                    <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditTitleOpen(false)}
                    >
                        Cancel
                    </ZoruButton>
                </ZoruCard>
            )}

            <ZoruCard className="flex flex-col gap-2 p-3">
                <ZoruLabel>Owner Telegram user id</ZoruLabel>
                <ZoruInput
                    value={ownerUserId}
                    onChange={(e) => setOwnerUserId(e.target.value)}
                    placeholder="123456789"
                    inputMode="numeric"
                />
                <p className="text-[11.5px] text-zoru-ink-muted">
                    Required for adding new stickers, replacing a file, or changing the thumbnail.
                </p>
            </ZoruCard>

            <div className="flex items-center justify-between">
                <h4 className="text-[13px] font-medium text-zoru-ink">Stickers</h4>
                <SabFilePickerButton
                    accept="image"
                    variant="outline"
                    onPick={(p) => handleAdd(p, '🧷')}
                >
                    <Plus className="h-4 w-4" /> Add sticker
                </SabFilePickerButton>
            </div>

            {sortedStickers.length === 0 ? (
                <ZoruEmptyState
                    compact
                    icon={<StickerIcon className="h-5 w-5 text-zoru-ink-muted" />}
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
        <li className="grid gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-3">
            <TelegramProjectGate />
            <div className="flex items-center gap-3">
                <span className="rounded-md bg-zoru-surface px-2 py-0.5 font-mono text-[11px] text-zoru-ink-muted">
                    #{sticker.positionInSet + 1}
                </span>
                <div className="min-w-0 flex-1 truncate font-mono text-[12px] text-zoru-ink-muted">
                    {sticker.fileId}
                </div>
                <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move up"
                    onClick={onMoveUp}
                    disabled={isFirst || busy === `pos-${sticker.fileId}`}
                >
                    <ArrowUp className="h-4 w-4" />
                </ZoruButton>
                <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Move down"
                    onClick={onMoveDown}
                    disabled={isLast || busy === `pos-${sticker.fileId}`}
                >
                    <ArrowDown className="h-4 w-4" />
                </ZoruButton>
                <SabFilePickerButton
                    accept="image"
                    variant="ghost"
                    className="px-2"
                    onPick={onReplace}
                >
                    <Replace className="h-4 w-4" />
                </SabFilePickerButton>
                <ZoruButton
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove"
                    onClick={onDelete}
                    disabled={busy === `del-${sticker.fileId}`}
                >
                    <Trash2 className="h-4 w-4 text-red-500" />
                </ZoruButton>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <ZoruLabel className="text-[11px]">Emoji(s)</ZoruLabel>
                        <ZoruInput
                            value={emoji}
                            onChange={(e) => setEmoji(e.target.value)}
                            placeholder="😺🐾"
                        />
                    </div>
                    <ZoruButton
                        size="sm"
                        variant="outline"
                        onClick={() => onEmoji(emoji)}
                        disabled={busy === `emoji-${sticker.fileId}`}
                    >
                        Save
                    </ZoruButton>
                </div>
                <div className="flex items-end gap-2">
                    <div className="flex-1">
                        <ZoruLabel className="text-[11px]">Keywords</ZoruLabel>
                        <ZoruInput
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            placeholder="comma, separated"
                        />
                    </div>
                    <ZoruButton
                        size="sm"
                        variant="outline"
                        onClick={() => onKeywords(keywords)}
                        disabled={busy === `kw-${sticker.fileId}`}
                    >
                        Save
                    </ZoruButton>
                </div>
            </div>
            {stickerType === 'mask' && (
                <div className="grid gap-2 rounded-[var(--zoru-radius-sm)] border border-dashed border-zoru-line p-2 sm:grid-cols-5">
                    <div className="flex flex-col gap-1">
                        <ZoruLabel className="text-[11px]">Anchor</ZoruLabel>
                        <ZoruSelect value={maskPoint} onValueChange={(v) => setMaskPoint(v)}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="forehead" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="forehead">forehead</ZoruSelectItem>
                                <ZoruSelectItem value="eyes">eyes</ZoruSelectItem>
                                <ZoruSelectItem value="mouth">mouth</ZoruSelectItem>
                                <ZoruSelectItem value="chin">chin</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                    <NumberField label="x shift" value={maskX} onChange={setMaskX} step={0.1} />
                    <NumberField label="y shift" value={maskY} onChange={setMaskY} step={0.1} />
                    <NumberField label="scale" value={maskScale} onChange={setMaskScale} step={0.1} />
                    <div className="flex items-end">
                        <ZoruButton
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
                        </ZoruButton>
                    </div>
                </div>
            )}
        </li>
    );
}

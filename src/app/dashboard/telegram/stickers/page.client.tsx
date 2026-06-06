'use client';
import { Header } from './_components/header';
import { BotSelector, type BotChoice } from './_components/bot-selector';
import { Kpis, KpiSkeleton } from './_components/kpis';
import { SetsGrid, GridSkeleton } from './_components/sets-grid';
import { CreatePackDrawer } from './_components/create-pack-drawer';
import { SetDetailDrawer } from './_components/set-detail-drawer';

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
} from '@/components/sabcrm/20ui/compat';
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
        
        // Enhance real-time updates by silently polling every 15 seconds
        const interval = setInterval(() => {
            void loadSets({ silent: true });
        }, 15000);
        
        return () => clearInterval(interval);
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
                <EmptyState
                    icon={<StickerIcon className="h-6 w-6 text-[var(--st-text-secondary)]" />}
                    title="Select a project"
                    description="Pick a project from the sidebar to manage sticker packs."
                />
            ) : !selectedBot ? (
                botsLoading ? (
                    <KpiSkeleton />
                ) : (
                    <EmptyState
                        icon={<StickerIcon className="h-6 w-6 text-[var(--st-text-secondary)]" />}
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
                        <EmptyState
                            icon={<StickerIcon className="h-6 w-6 text-[var(--st-text-secondary)]" />}
                            title="Couldn't load packs"
                            description={setsError}
                            action={
                                <Button variant="outline" size="sm" onClick={() => loadSets()}>
                                    Try again
                                </Button>
                            }
                        />
                    ) : sets.length === 0 ? (
                        <EmptyState
                            icon={<StickerIcon className="h-6 w-6 text-[var(--st-text-secondary)]" />}
                            title="No sticker packs yet"
                            description="Create your first pack to publish stickers via this bot."
                            action={
                                <Button size="sm" onClick={() => setCreateOpen(true)}>
                                    <Plus className="h-4 w-4" /> New sticker pack
                                </Button>
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


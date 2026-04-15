'use client';

import React, { useState, useMemo, memo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDebouncedCallback } from 'use-debounce';
import {
    Search, Zap, GitFork, Calendar, PlayCircle, Webhook,
    MessageSquare, Type, Image, Video, Music, Globe,
    Phone, Star, Hash, Mail, Upload, CreditCard, List,
    Code2, Filter, Timer, Repeat, ArrowRight, Shuffle,
    Bot, Sparkles, StickyNote, ToggleLeft, ChevronRight,
    ChevronDown, Lock, Unlock,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────
const SIDEBAR_LOCKED_KEY = 'sabflow_sidebar_locked';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BlockItem {
    type: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    stripe: string;
    iconBg: string;
    iconColor: string;
}

interface Category {
    id: string;
    label: string;
    blocks: BlockItem[];
}

interface DraggedBlock {
    type: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
}

// ─── Block categories ─────────────────────────────────────────────────────────
const CATEGORIES: Category[] = [
    {
        id: 'bubbles',
        label: 'Bubbles',
        blocks: [
            { type: 'text_bubble',  label: 'Text',  icon: Type,  stripe: 'bg-zinc-400',   iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500'   },
            { type: 'image_bubble', label: 'Image', icon: Image, stripe: 'bg-zinc-400',   iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500'   },
            { type: 'video_bubble', label: 'Video', icon: Video, stripe: 'bg-zinc-400',   iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500'   },
            { type: 'audio_bubble', label: 'Audio', icon: Music, stripe: 'bg-zinc-400',   iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500'   },
            { type: 'embed_bubble', label: 'Embed', icon: Globe, stripe: 'bg-zinc-400',   iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500'   },
        ],
    },
    {
        id: 'inputs',
        label: 'Inputs',
        blocks: [
            { type: 'text_input',   label: 'Text',       icon: MessageSquare, stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'number_input', label: 'Number',     icon: Hash,          stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'email_input',  label: 'Email',      icon: Mail,          stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'phone_input',  label: 'Phone',      icon: Phone,         stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'date_input',   label: 'Date',       icon: Calendar,      stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'url_input',    label: 'Website',    icon: Globe,         stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'file_input',   label: 'File',       icon: Upload,        stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'buttons',      label: 'Button',     icon: List,          stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'rating',       label: 'Rating',     icon: Star,          stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
            { type: 'payment',      label: 'Payment',    icon: CreditCard,    stripe: 'bg-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-950/60',   iconColor: 'text-orange-500' },
        ],
    },
    {
        id: 'logic',
        label: 'Logic',
        blocks: [
            { type: 'condition',    label: 'Condition',    icon: GitFork,    stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
            { type: 'set_variable', label: 'Set Variable', icon: ToggleLeft, stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
            { type: 'redirect',     label: 'Redirect',     icon: ArrowRight, stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
            { type: 'script',       label: 'Script',       icon: Code2,      stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
            { type: 'wait',         label: 'Wait',         icon: Timer,      stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
            { type: 'ab_test',      label: 'A/B Test',     icon: Shuffle,    stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
            { type: 'jump',         label: 'Jump',         icon: Repeat,     stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
            { type: 'filter',       label: 'Filter',       icon: Filter,     stripe: 'bg-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-950/60',   iconColor: 'text-purple-500' },
        ],
    },
    {
        id: 'triggers',
        label: 'Events',
        blocks: [
            { type: 'trigger',         label: 'Manual',   icon: PlayCircle, stripe: 'bg-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-500' },
            { type: 'webhook_trigger', label: 'Webhook',  icon: Webhook,    stripe: 'bg-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-500' },
            { type: 'schedule',        label: 'Schedule', icon: Calendar,   stripe: 'bg-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-500' },
        ],
    },
    {
        id: 'ai',
        label: 'AI',
        blocks: [
            { type: 'ai_message', label: 'AI Message', icon: Bot,      stripe: 'bg-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-950/60',  iconColor: 'text-violet-500' },
            { type: 'ai_agent',   label: 'AI Agent',   icon: Sparkles, stripe: 'bg-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-950/60',  iconColor: 'text-violet-500' },
        ],
    },
    {
        id: 'notes',
        label: 'Notes',
        blocks: [
            { type: 'sticky_note', label: 'Sticky Note', icon: StickyNote, stripe: 'bg-yellow-400', iconBg: 'bg-yellow-50 dark:bg-yellow-950/60', iconColor: 'text-yellow-500' },
        ],
    },
];

// ─── Sidebar block card — Typebot BlockCardLayout style ───────────────────────
const BlockCard = memo(function BlockCard({
    block,
    onDragStart,
    onDragEnd,
}: {
    block: BlockItem;
    onDragStart: (e: React.DragEvent, block: BlockItem) => void;
    onDragEnd: () => void;
}) {
    const Icon = block.icon;
    return (
        <div
            draggable
            onDragStart={(e) => onDragStart(e, block)}
            onDragEnd={onDragEnd}
            className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2',
                'cursor-grab active:cursor-grabbing select-none',
                'bg-white dark:bg-zinc-800/80',
                'border-zinc-200 dark:border-zinc-700/60',
                'hover:shadow-md dark:hover:bg-zinc-700/70 dark:hover:border-zinc-600',
                'transition-[box-shadow,background-color,border-color] duration-100',
            )}
        >
            <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', block.iconBg)}>
                <Icon className={cn('h-3.5 w-3.5', block.iconColor)} />
            </div>
            <span className="truncate text-[12px] font-medium text-zinc-700 dark:text-zinc-300">
                {block.label}
            </span>
        </div>
    );
});

// ─── Category section — Typebot style ────────────────────────────────────────
function Section({
    label,
    open,
    onToggle,
    children,
}: {
    label: string;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2">
            <button
                type="button"
                onClick={onToggle}
                className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
                {label}
                <ChevronDown className={cn('h-4 w-4 text-zinc-400 transition-transform duration-150', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="grid grid-cols-2 gap-3">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Integration app row ──────────────────────────────────────────────────────
const AppRow = memo(function AppRow({
    app,
    isOpen,
    onToggle,
    onDragApp,
    onDragAction,
    onDragEnd,
}: {
    app: typeof sabnodeAppActions[number];
    isOpen: boolean;
    onToggle: () => void;
    onDragApp: (e: React.DragEvent) => void;
    onDragAction: (e: React.DragEvent, actionName: string) => void;
    onDragEnd: () => void;
}) {
    const AppIcon = (app as any).icon ?? Zap;
    const iconColor = (app as any).iconColor ?? 'text-blue-400';
    const actions: any[] = (app as any).actions ?? [];

    return (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-800/40 overflow-hidden">
            <div className="flex items-center gap-2 px-2 py-1.5">
                <div
                    draggable
                    onDragStart={onDragApp}
                    onDragEnd={onDragEnd}
                    className="flex h-5 w-5 shrink-0 items-center justify-center cursor-grab active:cursor-grabbing"
                    title="Drag to canvas"
                >
                    <AppIcon className={cn('h-3.5 w-3.5', iconColor)} />
                </div>
                <span className="flex-1 truncate text-[11.5px] font-medium text-zinc-700 dark:text-zinc-300">
                    {app.name}
                </span>
                {actions.length > 0 && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    >
                        <ChevronRight className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-90')} />
                    </button>
                )}
            </div>

            {isOpen && actions.length > 0 && (
                <div className="border-t border-zinc-200 dark:border-zinc-700/30 bg-zinc-50 dark:bg-zinc-900/40 px-2 pb-1.5 pt-1 space-y-0.5">
                    {actions.map((action: any) => (
                        <div
                            key={action.name}
                            draggable
                            onDragStart={(e) => onDragAction(e, action.name)}
                            onDragEnd={onDragEnd}
                            className={cn(
                                'group flex items-center gap-2 rounded-md px-2 py-1',
                                'cursor-grab active:cursor-grabbing select-none',
                                'hover:bg-zinc-100 dark:hover:bg-zinc-700/40 transition-colors',
                                action.isTrigger && 'border-l-2 border-emerald-500/60 pl-1.5',
                            )}
                        >
                            <div className={cn(
                                'h-1.5 w-1.5 rounded-full shrink-0',
                                action.isTrigger ? 'bg-emerald-400' : 'bg-blue-400/60',
                            )} />
                            <span className="flex-1 truncate text-[10.5px] text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors">
                                {action.label}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

// ─── Drag overlay — Typebot BlockCardOverlay style ────────────────────────────
function DragOverlay({ block, pos }: { block: DraggedBlock; pos: { x: number; y: number } }) {
    const Icon = block.icon;
    return createPortal(
        <div
            className="fixed top-0 left-0 z-[9999] pointer-events-none"
            style={{ transform: `translate(${pos.x - 40}px, ${pos.y - 16}px) rotate(-2deg)` }}
        >
            <div className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-2',
                'shadow-xl bg-white dark:bg-zinc-800',
                'border-zinc-200 dark:border-zinc-600',
                'w-[147px] cursor-grabbing select-none',
            )}>
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md', block.iconBg)}>
                    <Icon className={cn('h-3.5 w-3.5', block.iconColor)} />
                </div>
                <span className="truncate text-[12px] font-medium text-zinc-700 dark:text-zinc-300">
                    {block.label}
                </span>
            </div>
        </div>,
        document.body,
    );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export function SabFlowSidebar() {
    const sidebarRef = useRef<HTMLDivElement>(null);
    const dockBarRef = useRef<HTMLButtonElement>(null);

    // Sidebar open/lock state
    const [isLocked, setIsLocked] = useState(() => {
        try { return localStorage.getItem(SIDEBAR_LOCKED_KEY) !== 'false'; }
        catch { return true; }
    });
    const [isExtended, setIsExtended] = useState(true);

    // Search
    const [search, setSearch] = useState('');

    // Section open states
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        bubbles: true, inputs: true, logic: false, triggers: false, ai: false, notes: false,
    });
    const [openApps, setOpenApps] = useState<Record<string, boolean>>({});
    const [openIntegCats, setOpenIntegCats] = useState<Record<string, boolean>>({});
    const [integOpen, setIntegOpen] = useState(true);

    // Drag state
    const [draggedBlock, setDraggedBlock] = useState<DraggedBlock | null>(null);
    const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Track mouse position during drag
    useEffect(() => {
        if (!draggedBlock) return;
        const onMove = (e: MouseEvent) => setDragPos({ x: e.clientX, y: e.clientY });
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, [draggedBlock]);

    // Auto-collapse helpers
    const scheduledClose = useDebouncedCallback(() => setIsExtended(false), 200);

    const isMouseInElement = useCallback((el: HTMLElement | null, x: number, y: number) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }, []);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (isLocked) return;
            const { clientX, clientY } = e;
            if (isMouseInElement(sidebarRef.current, clientX, clientY)) {
                scheduledClose.cancel();
                return;
            }
            if (isMouseInElement(dockBarRef.current, clientX, clientY)) {
                scheduledClose.cancel();
                setIsExtended(true);
                return;
            }
            if (clientX < 100) return;
            scheduledClose();
        };
        window.addEventListener('mousemove', onMove);
        return () => window.removeEventListener('mousemove', onMove);
    }, [isLocked, isMouseInElement, scheduledClose]);

    // Lock toggle
    const handleLockClick = () => {
        const next = !isLocked;
        setIsLocked(next);
        try { localStorage.setItem(SIDEBAR_LOCKED_KEY, String(next)); } catch { /* noop */ }
    };

    // Drag payload helpers
    const setDragData = (e: React.DragEvent, payload: string) => {
        e.dataTransfer.setData('application/reactflow', payload);
        e.dataTransfer.effectAllowed = 'move';
        // Hide native ghost image
        const ghost = new Image();
        ghost.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        e.dataTransfer.setDragImage(ghost, 0, 0);
    };

    const handleBlockDragStart = (e: React.DragEvent, block: BlockItem) => {
        setDragData(e, JSON.stringify({ type: block.type, blockType: block.type }));
        setDragPos({ x: e.clientX, y: e.clientY });
        setDraggedBlock({ type: block.type, label: block.label, icon: block.icon, iconBg: block.iconBg, iconColor: block.iconColor });
    };

    const handleDragEnd = () => setDraggedBlock(null);

    // Search filtering
    const q = search.toLowerCase().trim();

    const filteredCats = CATEGORIES.map(cat => ({
        ...cat,
        blocks: cat.blocks.filter(b =>
            !q || b.label.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)
        ),
    })).filter(cat => cat.blocks.length > 0);

    const filteredApps = useMemo(() => {
        if (!q) return sabnodeAppActions;
        return sabnodeAppActions.filter(app => {
            if (app.name.toLowerCase().includes(q)) return true;
            if ((app as any).category?.toLowerCase().includes(q)) return true;
            return ((app as any).actions ?? []).some((a: any) =>
                a.label?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
            );
        });
    }, [q]);

    const groupedApps = useMemo(() =>
        filteredApps.reduce<Record<string, typeof filteredApps>>((acc, app) => {
            const cat = (app as any).category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(app);
            return acc;
        }, {}), [filteredApps]);

    const integCats = useMemo(() => Object.keys(groupedApps).sort(), [groupedApps]);

    return (
        <>
            {/* Sidebar panel */}
            <div
                ref={sidebarRef}
                className={cn(
                    'flex w-[360px] absolute left-0 top-0 h-full pl-4 py-4 z-20',
                    'transition-transform duration-150 ease-out',
                    isExtended ? 'translate-x-0' : '-translate-x-[350px]',
                )}
            >
                <div className="flex flex-col w-full rounded-xl border border-zinc-200 dark:border-zinc-700/60 pt-4 pb-10 px-4 gap-6 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">

                    {/* Header: search + lock */}
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search blocks…"
                                className={cn(
                                    'w-full h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800',
                                    'border border-zinc-200 dark:border-zinc-700/60',
                                    'pl-9 pr-3 text-[13px] text-zinc-800 dark:text-zinc-200',
                                    'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
                                    'focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-500',
                                    'transition-colors',
                                )}
                            />
                        </div>
                        <button
                            type="button"
                            aria-label={isLocked ? 'Unlock sidebar' : 'Lock sidebar'}
                            onClick={handleLockClick}
                            className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
                                'transition-colors',
                                isLocked
                                    ? 'border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400'
                                    : 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300',
                            )}
                        >
                            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                        </button>
                    </div>

                    {/* Block list */}
                    <ScrollArea className="flex-1 -mx-1 px-1">
                        <div className="space-y-6">

                            {/* Built-in categories */}
                            {filteredCats.map(cat => (
                                <Section
                                    key={cat.id}
                                    label={cat.label}
                                    open={openSections[cat.id] ?? true}
                                    onToggle={() => setOpenSections(p => ({ ...p, [cat.id]: !p[cat.id] }))}
                                >
                                    {cat.blocks.map(b => (
                                        <BlockCard
                                            key={b.type}
                                            block={b}
                                            onDragStart={handleBlockDragStart}
                                            onDragEnd={handleDragEnd}
                                        />
                                    ))}
                                </Section>
                            ))}

                            {/* Integrations */}
                            {integCats.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIntegOpen(o => !o)}
                                        className="flex items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                                    >
                                        <span>Integrations <span className="ml-1 text-[11px] font-normal text-zinc-400">({filteredApps.length})</span></span>
                                        <ChevronDown className={cn('h-4 w-4 text-zinc-400 transition-transform duration-150', integOpen && 'rotate-180')} />
                                    </button>

                                    {integOpen && (
                                        <div className="space-y-2">
                                            {integCats.map(catName => {
                                                const catApps = groupedApps[catName];
                                                const isCatOpen = openIntegCats[catName] ?? (q.length > 0);
                                                return (
                                                    <div key={catName}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setOpenIntegCats(p => ({ ...p, [catName]: !p[catName] }))}
                                                            className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
                                                        >
                                                            <ChevronRight className={cn('h-3 w-3 text-zinc-400 transition-transform', isCatOpen && 'rotate-90')} />
                                                            <span className="flex-1 text-left text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                                                {catName}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-400">{catApps.length}</span>
                                                        </button>

                                                        {isCatOpen && (
                                                            <div className="mt-1 space-y-1 pl-1">
                                                                {catApps.map(app => (
                                                                    <AppRow
                                                                        key={app.appId}
                                                                        app={app}
                                                                        isOpen={openApps[app.appId] ?? (q.length > 0)}
                                                                        onToggle={() => setOpenApps(p => ({ ...p, [app.appId]: !p[app.appId] }))}
                                                                        onDragApp={e => {
                                                                            const first = ((app as any).actions ?? [])[0]?.name ?? 'action';
                                                                            setDragData(e, JSON.stringify({ type: 'action', blockType: first, appId: app.appId, actionName: first }));
                                                                            handleDragEnd();
                                                                        }}
                                                                        onDragAction={(e, actionName) => {
                                                                            setDragData(e, JSON.stringify({ type: 'action', blockType: actionName, appId: app.appId, actionName }));
                                                                        }}
                                                                        onDragEnd={handleDragEnd}
                                                                    />
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Empty state */}
                            {filteredCats.length === 0 && integCats.length === 0 && q && (
                                <p className="py-10 text-center text-sm text-zinc-400">
                                    No results for &ldquo;{search}&rdquo;
                                </p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>

            {/* Dock bar — hover strip visible when sidebar is collapsed */}
            {!isLocked && (
                <button
                    ref={dockBarRef}
                    type="button"
                    aria-label="Open blocks sidebar"
                    className="absolute left-0 top-0 h-full w-[450px] z-10 flex justify-end pr-10 items-center -translate-x-[70px] pointer-events-auto"
                    onFocus={() => { scheduledClose.cancel(); setIsExtended(true); }}
                >
                    <span className="flex w-[5px] h-[20px] rounded-md bg-zinc-300 dark:bg-zinc-600" />
                </button>
            )}

            {/* Drag overlay — Typebot BlockCardOverlay */}
            {mounted && draggedBlock && (
                <DragOverlay block={draggedBlock} pos={dragPos} />
            )}
        </>
    );
}

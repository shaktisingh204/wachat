'use client';

import React, { useState, useMemo, memo } from 'react';
import { cn } from '@/lib/utils';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    Search, Zap, GitFork, Calendar, PlayCircle, Webhook,
    MessageSquare, Type, Image, Video, Music, Globe,
    Phone, Star, Hash, Mail, Upload, CreditCard, List,
    Code2, Filter, Timer, Repeat, ArrowRight, Shuffle,
    Bot, Sparkles, StickyNote, ToggleLeft, ChevronDown,
    ChevronRight, Layers, GripVertical,
} from 'lucide-react';

// ─── Built-in block categories ────────────────────────────────────────────────
const BUBBLE_BLOCKS = [
    { type: 'text_bubble',  label: 'Text',        icon: Type,          desc: 'Send a text message'  },
    { type: 'image_bubble', label: 'Image',        icon: Image,         desc: 'Send an image'        },
    { type: 'video_bubble', label: 'Video',        icon: Video,         desc: 'Send a video'         },
    { type: 'audio_bubble', label: 'Audio',        icon: Music,         desc: 'Send audio'           },
    { type: 'embed_bubble', label: 'Embed',        icon: Globe,         desc: 'Embed content'        },
];

const INPUT_BLOCKS = [
    { type: 'text_input',   label: 'Text',        icon: MessageSquare, desc: 'Collect text'         },
    { type: 'number_input', label: 'Number',       icon: Hash,          desc: 'Collect a number'     },
    { type: 'email_input',  label: 'Email',        icon: Mail,          desc: 'Collect an email'     },
    { type: 'phone_input',  label: 'Phone',        icon: Phone,         desc: 'Collect a phone'      },
    { type: 'date_input',   label: 'Date',         icon: Calendar,      desc: 'Collect a date'       },
    { type: 'url_input',    label: 'URL',          icon: Globe,         desc: 'Collect a URL'        },
    { type: 'file_input',   label: 'File Upload',  icon: Upload,        desc: 'Collect a file'       },
    { type: 'buttons',      label: 'Buttons',      icon: List,          desc: 'Multiple choice'      },
    { type: 'rating',       label: 'Rating',       icon: Star,          desc: 'Star rating'          },
    { type: 'payment',      label: 'Payment',      icon: CreditCard,    desc: 'Collect payment'      },
];

const LOGIC_BLOCKS = [
    { type: 'condition',    label: 'Condition',    icon: GitFork,    desc: 'Branch on conditions'   },
    { type: 'set_variable', label: 'Set Variable', icon: ToggleLeft, desc: 'Store a value'          },
    { type: 'redirect',     label: 'Redirect',     icon: ArrowRight, desc: 'Redirect to URL'        },
    { type: 'script',       label: 'Script',       icon: Code2,      desc: 'Run custom code'        },
    { type: 'wait',         label: 'Wait',         icon: Timer,      desc: 'Pause the flow'         },
    { type: 'ab_test',      label: 'A/B Test',     icon: Shuffle,    desc: 'Split traffic'          },
    { type: 'jump',         label: 'Jump',         icon: Repeat,     desc: 'Jump to group'          },
    { type: 'filter',       label: 'Filter',       icon: Filter,     desc: 'Filter items'           },
];

const TRIGGER_BLOCKS = [
    { type: 'trigger',         label: 'Manual',   icon: PlayCircle, desc: 'Manual start'           },
    { type: 'webhook_trigger', label: 'Webhook',  icon: Webhook,    desc: 'HTTP webhook'           },
    { type: 'schedule',        label: 'Schedule', icon: Calendar,   desc: 'Scheduled run'          },
];

const AI_BLOCKS = [
    { type: 'ai_message', label: 'AI Message', icon: Bot,      desc: 'AI-generated reply'         },
    { type: 'ai_agent',   label: 'AI Agent',   icon: Sparkles, desc: 'Run an AI agent'            },
];

const BUILTIN_CATEGORIES = [
    {
        id: 'bubbles',
        label: 'Bubbles',
        dot: 'bg-zinc-400',
        labelColor: 'text-zinc-500 dark:text-zinc-400',
        blocks: BUBBLE_BLOCKS,
        iconBg: 'bg-zinc-100 dark:bg-zinc-800',
        iconColor: 'text-zinc-500 dark:text-zinc-400',
    },
    {
        id: 'inputs',
        label: 'Inputs',
        dot: 'bg-orange-400',
        labelColor: 'text-orange-600 dark:text-orange-400',
        blocks: INPUT_BLOCKS,
        iconBg: 'bg-orange-50 dark:bg-orange-950/60',
        iconColor: 'text-orange-500',
    },
    {
        id: 'logic',
        label: 'Logic',
        dot: 'bg-purple-400',
        labelColor: 'text-purple-600 dark:text-purple-400',
        blocks: LOGIC_BLOCKS,
        iconBg: 'bg-purple-50 dark:bg-purple-950/60',
        iconColor: 'text-purple-500',
    },
    {
        id: 'triggers',
        label: 'Triggers',
        dot: 'bg-emerald-400',
        labelColor: 'text-emerald-600 dark:text-emerald-400',
        blocks: TRIGGER_BLOCKS,
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
        iconColor: 'text-emerald-500',
    },
    {
        id: 'ai',
        label: 'AI',
        dot: 'bg-violet-400',
        labelColor: 'text-violet-600 dark:text-violet-400',
        blocks: AI_BLOCKS,
        iconBg: 'bg-violet-50 dark:bg-violet-950/60',
        iconColor: 'text-violet-500',
    },
] as const;

// ─── Drag helpers ─────────────────────────────────────────────────────────────
function makeDragPayload(nodeType: string, appId?: string, actionName?: string) {
    return appId
        ? JSON.stringify({ type: 'action', blockType: nodeType, appId, actionName: actionName ?? nodeType })
        : JSON.stringify({ type: nodeType, blockType: nodeType });
}

// ─── Draggable built-in chip ──────────────────────────────────────────────────
interface ChipProps {
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    onDragStart: (e: React.DragEvent) => void;
}

const BlockChip = memo(function BlockChip({ label, desc, icon: Icon, iconBg, iconColor, onDragStart }: ChipProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    draggable
                    onDragStart={onDragStart}
                    className={cn(
                        'group flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/70 px-2.5 py-2',
                        'cursor-grab active:cursor-grabbing select-none',
                        'transition-all duration-100 hover:border-border hover:bg-card hover:shadow-sm hover:-translate-y-px',
                    )}
                >
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', iconBg)}>
                        <Icon className={cn('h-3.5 w-3.5', iconColor)} />
                    </div>
                    <span className="truncate text-[12.5px] font-medium leading-tight text-foreground">
                        {label}
                    </span>
                    <GripVertical className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{desc}</TooltipContent>
        </Tooltip>
    );
});

// ─── Collapsible section header ───────────────────────────────────────────────
interface SectionProps {
    label: string;
    dot: string;
    labelColor: string;
    count: number;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function Section({ label, dot, labelColor, count, open, onToggle, children }: SectionProps) {
    return (
        <div>
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-muted/50 transition-colors"
            >
                <div className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
                <span className={cn('text-[10.5px] font-bold uppercase tracking-[0.12em]', labelColor)}>
                    {label}
                </span>
                <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                    {count}
                </span>
                <ChevronDown className={cn('h-3 w-3 text-muted-foreground transition-transform duration-150', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="mt-1.5 grid grid-cols-1 gap-1 pl-0.5">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── App row with expandable actions ─────────────────────────────────────────
interface AppRowProps {
    app: typeof sabnodeAppActions[number];
    isOpen: boolean;
    onToggle: () => void;
    onDragStartAction: (e: React.DragEvent, actionName: string, actionLabel: string) => void;
    onDragStartApp: (e: React.DragEvent) => void;
}

const AppRow = memo(function AppRow({ app, isOpen, onToggle, onDragStartAction, onDragStartApp }: AppRowProps) {
    const AppIcon = (app as any).icon ?? Zap;
    const iconColor = (app as any).iconColor ?? 'text-blue-500';
    const actions: any[] = (app as any).actions ?? [];
    const hasActions = actions.length > 0;

    return (
        <div className="rounded-lg border border-border/40 bg-card/50 overflow-hidden">
            {/* App header row */}
            <div
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-muted/40 transition-colors"
            >
                {/* Draggable icon area */}
                <div
                    draggable
                    onDragStart={onDragStartApp}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/60 cursor-grab active:cursor-grabbing"
                    title={`Drag ${app.name} app`}
                >
                    <AppIcon className={cn('h-3.5 w-3.5', iconColor)} />
                </div>

                <span className="flex-1 truncate text-[12px] font-medium text-foreground">
                    {app.name}
                </span>

                {hasActions && (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted text-muted-foreground"
                        title={isOpen ? 'Collapse actions' : 'Show actions'}
                    >
                        <ChevronRight className={cn('h-3 w-3 transition-transform duration-150', isOpen && 'rotate-90')} />
                    </button>
                )}
            </div>

            {/* Expanded actions list */}
            {isOpen && hasActions && (
                <div className="border-t border-border/30 bg-muted/20 px-2 pb-1.5 pt-1 space-y-0.5">
                    {actions.map((action: any) => (
                        <div
                            key={action.name}
                            draggable
                            onDragStart={(e) => onDragStartAction(e, action.name, action.label)}
                            className={cn(
                                'group flex items-center gap-2 rounded-md px-2 py-1.5',
                                'cursor-grab active:cursor-grabbing select-none',
                                'hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors',
                                action.isTrigger && 'border-l-2 border-emerald-400',
                            )}
                            title={action.description || action.label}
                        >
                            <div className={cn(
                                'h-1.5 w-1.5 rounded-full shrink-0',
                                action.isTrigger ? 'bg-emerald-400' : 'bg-blue-400',
                            )} />
                            <span className="flex-1 truncate text-[11px] leading-tight text-foreground/80 group-hover:text-foreground">
                                {action.label}
                            </span>
                            <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export function SabFlowSidebar({ className }: { className?: string }) {
    const [search, setSearch] = useState('');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        bubbles: true,
        inputs: true,
        logic: true,
        triggers: true,
        ai: true,
    });
    // Track which app rows are expanded (key = appId)
    const [openApps, setOpenApps] = useState<Record<string, boolean>>({});
    // Track which integration categories are open (key = category name)
    const [openIntegCats, setOpenIntegCats] = useState<Record<string, boolean>>({});

    const toggleSection = (id: string) =>
        setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));

    const toggleApp = (appId: string) =>
        setOpenApps(prev => ({ ...prev, [appId]: !prev[appId] }));

    const toggleIntegCat = (cat: string) =>
        setOpenIntegCats(prev => ({ ...prev, [cat]: !prev[cat] }));

    const q = search.toLowerCase().trim();

    // Filter built-in categories
    const filteredBuiltin = BUILTIN_CATEGORIES.map(cat => ({
        ...cat,
        blocks: cat.blocks.filter(b =>
            !q || b.label.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q)
        ),
    })).filter(cat => cat.blocks.length > 0);

    // Filter integration apps: search in app name, category, and action labels
    const filteredApps = useMemo(() => {
        if (!q) return sabnodeAppActions;
        return sabnodeAppActions.filter(app => {
            if (app.name.toLowerCase().includes(q)) return true;
            if ((app as any).category?.toLowerCase().includes(q)) return true;
            const actions: any[] = (app as any).actions ?? [];
            return actions.some(a =>
                a.label?.toLowerCase().includes(q) ||
                a.description?.toLowerCase().includes(q)
            );
        });
    }, [q]);

    // Group apps by category
    const groupedApps = useMemo(() =>
        filteredApps.reduce<Record<string, typeof filteredApps>>((acc, app) => {
            const cat = (app as any).category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(app);
            return acc;
        }, {}),
        [filteredApps],
    );

    const integCategoryNames = useMemo(() => Object.keys(groupedApps).sort(), [groupedApps]);

    const showNotes = !q || 'note sticky'.includes(q);
    const hasResults = filteredBuiltin.length > 0 || integCategoryNames.length > 0 || showNotes;

    const onDragStartBuiltin = (e: React.DragEvent, nodeType: string) => {
        e.dataTransfer.setData('application/reactflow', makeDragPayload(nodeType));
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragStartApp = (e: React.DragEvent, appId: string) => {
        // Dragging the app itself — uses the first action name or generic 'action'
        const app = sabnodeAppActions.find(a => a.appId === appId);
        const firstAction = ((app as any)?.actions ?? [])[0]?.name ?? 'action';
        e.dataTransfer.setData('application/reactflow', makeDragPayload(firstAction, appId, firstAction));
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragStartAction = (e: React.DragEvent, appId: string, actionName: string, actionLabel: string) => {
        e.dataTransfer.setData('application/reactflow', makeDragPayload(actionName, appId, actionName));
        e.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className={cn('flex h-full flex-col overflow-hidden', className)}>

            {/* Header */}
            <div className="flex items-center gap-2 border-b px-3 py-3 shrink-0">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold text-foreground">Blocks</span>
                <span className="ml-auto text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full font-medium">
                    {sabnodeAppActions.length} apps
                </span>
            </div>

            {/* Search */}
            <div className="px-2.5 py-2 shrink-0">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search blocks, apps, actions…"
                        className="h-8 bg-muted/40 pl-8 text-[12px] border-border/50 focus-visible:bg-background"
                    />
                </div>
            </div>

            {/* Block list */}
            <ScrollArea className="flex-1 px-2.5 pb-4">
                <div className="space-y-2.5">

                    {/* ── Built-in categories ── */}
                    {filteredBuiltin.map(cat => (
                        <Section
                            key={cat.id}
                            label={cat.label}
                            dot={cat.dot}
                            labelColor={cat.labelColor}
                            count={cat.blocks.length}
                            open={openSections[cat.id] ?? true}
                            onToggle={() => toggleSection(cat.id)}
                        >
                            {cat.blocks.map(b => (
                                <BlockChip
                                    key={b.type}
                                    label={b.label}
                                    desc={b.desc}
                                    icon={b.icon}
                                    iconBg={cat.iconBg}
                                    iconColor={cat.iconColor}
                                    onDragStart={e => onDragStartBuiltin(e, b.type)}
                                />
                            ))}
                        </Section>
                    ))}

                    {/* ── Integrations ── */}
                    {integCategoryNames.length > 0 && (
                        <div>
                            {/* Master integrations header */}
                            <div className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left">
                                <div className="h-2 w-2 rounded-full shrink-0 bg-blue-400" />
                                <span className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-blue-600 dark:text-blue-400">
                                    Integrations
                                </span>
                                <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                                    {filteredApps.length}
                                </span>
                            </div>

                            <div className="mt-1.5 space-y-2">
                                {integCategoryNames.map(catName => {
                                    const catApps = groupedApps[catName];
                                    const isCatOpen = openIntegCats[catName] ?? (q.length > 0);
                                    return (
                                        <div key={catName}>
                                            {/* Category sub-header */}
                                            <button
                                                type="button"
                                                onClick={() => toggleIntegCat(catName)}
                                                className="flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-muted/40 transition-colors"
                                            >
                                                <ChevronRight className={cn('h-3 w-3 text-muted-foreground/70 transition-transform', isCatOpen && 'rotate-90')} />
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex-1 text-left">
                                                    {catName}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/60">
                                                    {catApps.length}
                                                </span>
                                            </button>

                                            {isCatOpen && (
                                                <div className="mt-1 space-y-1 pl-1">
                                                    {catApps.map(app => (
                                                        <AppRow
                                                            key={app.appId}
                                                            app={app}
                                                            isOpen={openApps[app.appId] ?? (q.length > 0)}
                                                            onToggle={() => toggleApp(app.appId)}
                                                            onDragStartApp={e => onDragStartApp(e, app.appId)}
                                                            onDragStartAction={(e, actionName, actionLabel) =>
                                                                onDragStartAction(e, app.appId, actionName, actionLabel)
                                                            }
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Notes ── */}
                    {showNotes && (
                        <Section
                            label="Notes"
                            dot="bg-yellow-400"
                            labelColor="text-yellow-600 dark:text-yellow-400"
                            count={1}
                            open={openSections.notes ?? true}
                            onToggle={() => toggleSection('notes')}
                        >
                            <BlockChip
                                label="Sticky Note"
                                desc="Add a canvas annotation"
                                icon={StickyNote}
                                iconBg="bg-yellow-50 dark:bg-yellow-900/40"
                                iconColor="text-yellow-600 dark:text-yellow-400"
                                onDragStart={e => onDragStartBuiltin(e, 'sticky_note')}
                            />
                        </Section>
                    )}

                    {/* Empty state */}
                    {!hasResults && q && (
                        <p className="py-10 text-center text-xs text-muted-foreground">
                            No results for &ldquo;{search}&rdquo;
                        </p>
                    )}
                </div>
            </ScrollArea>
        </aside>
    );
}

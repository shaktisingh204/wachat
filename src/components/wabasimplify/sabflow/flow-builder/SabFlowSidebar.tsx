'use client';

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

// ─── Typebot block categories ─────────────────────────────────────────────────
const BUBBLE_BLOCKS = [
    { type: 'text_bubble',  label: 'Text',   icon: Type,          desc: 'Send a message'     },
    { type: 'image_bubble', label: 'Image',  icon: Image,         desc: 'Send an image'      },
    { type: 'video_bubble', label: 'Video',  icon: Video,         desc: 'Send a video'       },
    { type: 'audio_bubble', label: 'Audio',  icon: Music,         desc: 'Send audio'         },
    { type: 'embed_bubble', label: 'Embed',  icon: Globe,         desc: 'Embed content'      },
];

const INPUT_BLOCKS = [
    { type: 'text_input',   label: 'Text',       icon: MessageSquare, desc: 'Collect text'        },
    { type: 'number_input', label: 'Number',      icon: Hash,          desc: 'Collect a number'    },
    { type: 'email_input',  label: 'Email',       icon: Mail,          desc: 'Collect email'       },
    { type: 'phone_input',  label: 'Phone',       icon: Phone,         desc: 'Collect phone'       },
    { type: 'date_input',   label: 'Date',        icon: Calendar,      desc: 'Collect a date'      },
    { type: 'url_input',    label: 'URL',         icon: Globe,         desc: 'Collect a URL'       },
    { type: 'file_input',   label: 'File Upload', icon: Upload,        desc: 'Collect a file'      },
    { type: 'buttons',      label: 'Buttons',     icon: List,          desc: 'Multiple choice'     },
    { type: 'rating',       label: 'Rating',      icon: Star,          desc: 'Star rating'         },
    { type: 'payment',      label: 'Payment',     icon: CreditCard,    desc: 'Collect payment'     },
];

const LOGIC_BLOCKS = [
    { type: 'condition',    label: 'Condition',    icon: GitFork,   desc: 'Branch flow'        },
    { type: 'set_variable', label: 'Set Variable', icon: ToggleLeft, desc: 'Store a value'     },
    { type: 'redirect',     label: 'Redirect',     icon: ArrowRight, desc: 'Redirect to URL'   },
    { type: 'script',       label: 'Script',       icon: Code2,      desc: 'Run custom code'   },
    { type: 'wait',         label: 'Wait',         icon: Timer,      desc: 'Pause the flow'    },
    { type: 'ab_test',      label: 'A/B Test',     icon: Shuffle,    desc: 'Split traffic'     },
    { type: 'jump',         label: 'Jump',         icon: Repeat,     desc: 'Jump to group'     },
    { type: 'filter',       label: 'Filter',       icon: Filter,     desc: 'Filter items'      },
];

const TRIGGER_BLOCKS = [
    { type: 'trigger',          label: 'Manual',   icon: PlayCircle, desc: 'Manual start'       },
    { type: 'webhook_trigger',  label: 'Webhook',  icon: Webhook,    desc: 'HTTP webhook'       },
    { type: 'schedule',         label: 'Schedule', icon: Calendar,   desc: 'Scheduled run'      },
];

const AI_BLOCKS = [
    { type: 'ai_message', label: 'AI Message', icon: Bot,      desc: 'AI-generated reply' },
    { type: 'ai_agent',   label: 'AI Agent',   icon: Sparkles, desc: 'Run an AI agent'    },
];

// ─── Category config ──────────────────────────────────────────────────────────
const BUILTIN_CATEGORIES = [
    {
        id: 'bubbles',
        label: 'Bubbles',
        dot: 'bg-zinc-400',
        labelColor: 'text-zinc-600 dark:text-zinc-400',
        blocks: BUBBLE_BLOCKS,
        dragType: 'bubble',
        iconBg: 'bg-zinc-100 dark:bg-zinc-800',
        iconColor: 'text-zinc-500 dark:text-zinc-400',
    },
    {
        id: 'inputs',
        label: 'Inputs',
        dot: 'bg-orange-400',
        labelColor: 'text-orange-600 dark:text-orange-400',
        blocks: INPUT_BLOCKS,
        dragType: 'input',
        iconBg: 'bg-orange-50 dark:bg-orange-950/60',
        iconColor: 'text-orange-500',
    },
    {
        id: 'logic',
        label: 'Logic',
        dot: 'bg-purple-400',
        labelColor: 'text-purple-600 dark:text-purple-400',
        blocks: LOGIC_BLOCKS,
        dragType: 'logic',
        iconBg: 'bg-purple-50 dark:bg-purple-950/60',
        iconColor: 'text-purple-500',
    },
    {
        id: 'triggers',
        label: 'Triggers',
        dot: 'bg-emerald-400',
        labelColor: 'text-emerald-600 dark:text-emerald-400',
        blocks: TRIGGER_BLOCKS,
        dragType: 'trigger',
        iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
        iconColor: 'text-emerald-500',
    },
    {
        id: 'ai',
        label: 'AI',
        dot: 'bg-violet-400',
        labelColor: 'text-violet-600 dark:text-violet-400',
        blocks: AI_BLOCKS,
        dragType: 'ai',
        iconBg: 'bg-violet-50 dark:bg-violet-950/60',
        iconColor: 'text-violet-500',
    },
] as const;

// ─── Draggable chip ───────────────────────────────────────────────────────────
interface ChipProps {
    label: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    onDragStart: (e: React.DragEvent) => void;
}

function BlockChip({ label, desc, icon: Icon, iconBg, iconColor, onDragStart }: ChipProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div
                    draggable
                    onDragStart={onDragStart}
                    className={cn(
                        'group flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/60 px-2.5 py-2',
                        'cursor-grab active:cursor-grabbing transition-all duration-100',
                        'hover:border-border hover:bg-card hover:shadow-sm hover:-translate-y-px',
                    )}
                >
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
                        <Icon className={cn('h-4 w-4', iconColor)} />
                    </div>
                    <span className="text-[13px] font-medium leading-tight text-foreground truncate">{label}</span>
                </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{desc}</TooltipContent>
        </Tooltip>
    );
}

// ─── Collapsible section ──────────────────────────────────────────────────────
interface SectionProps {
    id: string;
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
        <div className="space-y-2">
            <button
                type="button"
                onClick={onToggle}
                className="flex w-full items-center gap-2 px-1 py-0.5 text-left"
            >
                <div className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
                <span className={cn('text-[11px] font-bold uppercase tracking-[0.12em]', labelColor)}>
                    {label}
                </span>
                <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">
                    {count}
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="grid grid-cols-1 gap-1.5">
                    {children}
                </div>
            )}
        </div>
    );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
export function SabFlowSidebar({ className }: { className?: string }) {
    const [search, setSearch]   = useState('');
    const [open, setOpen]       = useState<Record<string, boolean>>({
        bubbles: true, inputs: true, logic: true, triggers: true, ai: true, integrations: true,
    });

    const onDragStart = (e: React.DragEvent, nodeType: string, appId?: string) => {
        const payload = appId
            ? JSON.stringify({ type: 'action', blockType: nodeType, appId })
            : JSON.stringify({ type: nodeType, blockType: nodeType });
        e.dataTransfer.setData('application/reactflow', payload);
        e.dataTransfer.effectAllowed = 'move';
    };

    const toggle = (id: string) => setOpen(prev => ({ ...prev, [id]: !prev[id] }));

    // Filter built-in blocks
    const q = search.toLowerCase();
    const filteredBuiltin = BUILTIN_CATEGORIES.map(cat => ({
        ...cat,
        blocks: cat.blocks.filter(b => !q || b.label.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q)),
    })).filter(cat => cat.blocks.length > 0);

    // Filter integration apps
    const filteredApps = useMemo(() => {
        return sabnodeAppActions.filter(app => {
            if (!q) return true;
            return app.name.toLowerCase().includes(q) || (app as any).category?.toLowerCase().includes(q);
        });
    }, [q]);

    const groupedApps = useMemo(() => {
        return filteredApps.reduce<Record<string, typeof filteredApps>>((acc, app) => {
            const cat = (app as any).category || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(app);
            return acc;
        }, {});
    }, [filteredApps]);

    const appCategories = Object.keys(groupedApps).sort();

    return (
        <aside className={cn('flex h-full flex-col', className)}>
            {/* Search */}
            <div className="px-3 pb-3 pt-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search blocks & apps…"
                        className="h-8 bg-muted/40 pl-8 text-sm border-border/60 focus-visible:bg-background"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-3 pb-4">
                <div className="space-y-5">

                    {/* ── Built-in block categories ─────────────────── */}
                    {filteredBuiltin.map(cat => (
                        <Section
                            key={cat.id}
                            id={cat.id}
                            label={cat.label}
                            dot={cat.dot}
                            labelColor={cat.labelColor}
                            count={cat.blocks.length}
                            open={open[cat.id] ?? true}
                            onToggle={() => toggle(cat.id)}
                        >
                            {cat.blocks.map(b => (
                                <BlockChip
                                    key={b.type}
                                    label={b.label}
                                    desc={b.desc}
                                    icon={b.icon}
                                    iconBg={cat.iconBg}
                                    iconColor={cat.iconColor}
                                    onDragStart={e => onDragStart(e, b.type)}
                                />
                            ))}
                        </Section>
                    ))}

                    {/* ── App integrations ──────────────────────────── */}
                    {appCategories.length > 0 && (
                        <Section
                            id="integrations"
                            label="Integrations"
                            dot="bg-blue-400"
                            labelColor="text-blue-600 dark:text-blue-400"
                            count={filteredApps.length}
                            open={open.integrations ?? true}
                            onToggle={() => toggle('integrations')}
                        >
                            {appCategories.map(catName => (
                                <div key={catName} className="space-y-1">
                                    {appCategories.length > 1 && (
                                        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                            {catName}
                                        </p>
                                    )}
                                    {groupedApps[catName].map(app => {
                                        const AppIcon = (app as any).icon ?? Zap;
                                        return (
                                            <BlockChip
                                                key={app.appId}
                                                label={app.name}
                                                desc={(app as any).description || `${app.name} integration`}
                                                icon={AppIcon}
                                                iconBg="bg-blue-50 dark:bg-blue-950/60"
                                                iconColor={(app as any).iconColor ?? 'text-blue-500'}
                                                onDragStart={e => onDragStart(e, 'action', app.appId)}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </Section>
                    )}

                    {/* Empty state */}
                    {filteredBuiltin.length === 0 && appCategories.length === 0 && (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                            No results for &ldquo;{search}&rdquo;
                        </p>
                    )}

                    {/* Note block (always shown at bottom) */}
                    {(!q || 'note'.includes(q) || 'sticky'.includes(q)) && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-2 w-2 rounded-full bg-yellow-400 shrink-0" />
                                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-yellow-600 dark:text-yellow-400">
                                    Notes
                                </span>
                            </div>
                            <BlockChip
                                label="Sticky Note"
                                desc="Add a canvas annotation"
                                icon={StickyNote}
                                iconBg="bg-yellow-50 dark:bg-yellow-900/40"
                                iconColor="text-yellow-600 dark:text-yellow-400"
                                onDragStart={e => onDragStart(e, 'sticky_note')}
                            />
                        </div>
                    )}
                </div>
            </ScrollArea>
        </aside>
    );
}

'use client';

import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps, useEdges } from '@xyflow/react';
import { validateNode, ValidationError } from '@/lib/sabflow/validation';
import { cn } from '@/lib/utils';
import {
    Zap, GitFork, Calendar, PlayCircle, Webhook,
    MessageSquare, Type, Image, Video, Music, Globe,
    Phone, Star, Hash, Mail, Upload, CreditCard, List,
    Code2, Filter, Timer, Repeat, ArrowRight, Shuffle,
    Bot, Sparkles, Settings2, StickyNote, ToggleLeft,
    FileText, Link, AlertTriangle,
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';

// ─── Category palette — Typebot colour language ───────────────────────────────
const PALETTE = {
    bubble: {
        band:     'bg-zinc-300 dark:bg-zinc-600',
        card:     'bg-white dark:bg-zinc-900',
        border:   'border-zinc-200 dark:border-zinc-700',
        icon:     'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
        label:    'text-zinc-500 dark:text-zinc-400',
        badge:    'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
    },
    input: {
        band:     'bg-orange-400',
        card:     'bg-orange-50/60 dark:bg-orange-950/20',
        border:   'border-orange-200 dark:border-orange-800/50',
        icon:     'bg-orange-100 dark:bg-orange-950/60 text-orange-500',
        label:    'text-orange-600 dark:text-orange-400',
        badge:    'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400',
    },
    logic: {
        band:     'bg-purple-500',
        card:     'bg-purple-50/60 dark:bg-purple-950/20',
        border:   'border-purple-200 dark:border-purple-800/50',
        icon:     'bg-purple-100 dark:bg-purple-950/60 text-purple-500',
        label:    'text-purple-600 dark:text-purple-400',
        badge:    'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    },
    trigger: {
        band:     'bg-emerald-500',
        card:     'bg-emerald-50/60 dark:bg-emerald-950/20',
        border:   'border-emerald-200 dark:border-emerald-800/50',
        icon:     'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600',
        label:    'text-emerald-600 dark:text-emerald-400',
        badge:    'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    },
    ai: {
        band:     'bg-violet-500',
        card:     'bg-violet-50/60 dark:bg-violet-950/20',
        border:   'border-violet-200 dark:border-violet-800/50',
        icon:     'bg-violet-100 dark:bg-violet-950/60 text-violet-600',
        label:    'text-violet-600 dark:text-violet-400',
        badge:    'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    },
    integration: {
        band:     'bg-blue-500',
        card:     'bg-blue-50/60 dark:bg-blue-950/20',
        border:   'border-blue-200 dark:border-blue-800/50',
        icon:     'bg-blue-100 dark:bg-blue-950/60 text-blue-600',
        label:    'text-blue-600 dark:text-blue-400',
        badge:    'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    },
    default: {
        band:     'bg-muted-foreground/40',
        card:     'bg-card',
        border:   'border-border',
        icon:     'bg-muted text-muted-foreground',
        label:    'text-muted-foreground',
        badge:    'bg-muted text-muted-foreground',
    },
} as const;

type PaletteKey = keyof typeof PALETTE;

// ─── Block registry ───────────────────────────────────────────────────────────
const BLOCK_REGISTRY: Record<string, {
    label: string;
    category: string;
    palette: PaletteKey;
    icon: React.ComponentType<{ className?: string }>;
    categoryLabel: string;
}> = {
    // Bubbles
    text_bubble:     { label: 'Text',         category: 'Bubble',   palette: 'bubble',   icon: Type,          categoryLabel: 'Bubble'    },
    image_bubble:    { label: 'Image',        category: 'Bubble',   palette: 'bubble',   icon: Image,         categoryLabel: 'Bubble'    },
    video_bubble:    { label: 'Video',        category: 'Bubble',   palette: 'bubble',   icon: Video,         categoryLabel: 'Bubble'    },
    audio_bubble:    { label: 'Audio',        category: 'Bubble',   palette: 'bubble',   icon: Music,         categoryLabel: 'Bubble'    },
    embed_bubble:    { label: 'Embed',        category: 'Bubble',   palette: 'bubble',   icon: Globe,         categoryLabel: 'Bubble'    },
    // Inputs
    text_input:      { label: 'Text Input',   category: 'Input',    palette: 'input',    icon: MessageSquare, categoryLabel: 'Input'     },
    number_input:    { label: 'Number',       category: 'Input',    palette: 'input',    icon: Hash,          categoryLabel: 'Input'     },
    email_input:     { label: 'Email',        category: 'Input',    palette: 'input',    icon: Mail,          categoryLabel: 'Input'     },
    phone_input:     { label: 'Phone',        category: 'Input',    palette: 'input',    icon: Phone,         categoryLabel: 'Input'     },
    date_input:      { label: 'Date',         category: 'Input',    palette: 'input',    icon: Calendar,      categoryLabel: 'Input'     },
    url_input:       { label: 'URL',          category: 'Input',    palette: 'input',    icon: Link,          categoryLabel: 'Input'     },
    file_input:      { label: 'File Upload',  category: 'Input',    palette: 'input',    icon: Upload,        categoryLabel: 'Input'     },
    buttons:         { label: 'Buttons',      category: 'Input',    palette: 'input',    icon: List,          categoryLabel: 'Input'     },
    rating:          { label: 'Rating',       category: 'Input',    palette: 'input',    icon: Star,          categoryLabel: 'Input'     },
    payment:         { label: 'Payment',      category: 'Input',    palette: 'input',    icon: CreditCard,    categoryLabel: 'Input'     },
    // Logic
    condition:       { label: 'Condition',    category: 'Logic',    palette: 'logic',    icon: GitFork,       categoryLabel: 'Logic'     },
    set_variable:    { label: 'Set Variable', category: 'Logic',    palette: 'logic',    icon: ToggleLeft,    categoryLabel: 'Logic'     },
    redirect:        { label: 'Redirect',     category: 'Logic',    palette: 'logic',    icon: ArrowRight,    categoryLabel: 'Logic'     },
    script:          { label: 'Script',       category: 'Logic',    palette: 'logic',    icon: Code2,         categoryLabel: 'Logic'     },
    wait:            { label: 'Wait',         category: 'Logic',    palette: 'logic',    icon: Timer,         categoryLabel: 'Logic'     },
    ab_test:         { label: 'A/B Test',     category: 'Logic',    palette: 'logic',    icon: Shuffle,       categoryLabel: 'Logic'     },
    jump:            { label: 'Jump',         category: 'Logic',    palette: 'logic',    icon: Repeat,        categoryLabel: 'Logic'     },
    filter:          { label: 'Filter',       category: 'Logic',    palette: 'logic',    icon: Filter,        categoryLabel: 'Logic'     },
    // Triggers
    trigger:         { label: 'Start',        category: 'Trigger',  palette: 'trigger',  icon: Zap,           categoryLabel: 'Trigger'   },
    webhook_trigger: { label: 'Webhook',      category: 'Trigger',  palette: 'trigger',  icon: Webhook,       categoryLabel: 'Trigger'   },
    schedule:        { label: 'Schedule',     category: 'Trigger',  palette: 'trigger',  icon: Calendar,      categoryLabel: 'Trigger'   },
    manual:          { label: 'Manual',       category: 'Trigger',  palette: 'trigger',  icon: PlayCircle,    categoryLabel: 'Trigger'   },
    // AI
    ai_message:      { label: 'AI Message',   category: 'AI',       palette: 'ai',       icon: Bot,           categoryLabel: 'AI'        },
    ai_agent:        { label: 'AI Agent',     category: 'AI',       palette: 'ai',       icon: Sparkles,      categoryLabel: 'AI'        },
};

// ─── Content preview ──────────────────────────────────────────────────────────
function truncate(s: string, max = 55) {
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function ContentPreview({ data, blockType }: { data: any; blockType: string }) {
    switch (blockType) {
        case 'text_bubble': {
            const c = data?.content;
            if (!c?.trim()) return <span className="italic opacity-50">No message set</span>;
            return <span>{truncate(String(c))}</span>;
        }
        case 'image_bubble':
        case 'video_bubble':
        case 'audio_bubble': {
            const u = data?.url;
            if (!u?.trim()) return <span className="italic opacity-50">No URL set</span>;
            return <span>{truncate(String(u))}</span>;
        }
        case 'text_input': case 'email_input': case 'phone_input':
        case 'url_input': case 'date_input': case 'file_input':
        case 'number_input': {
            const v = data?.variableName;
            if (!v?.trim()) return <span className="italic opacity-50">No variable</span>;
            return <span>→ {`{{${v}}}`}</span>;
        }
        case 'buttons': {
            const btns: any[] = data?.buttons ?? [];
            if (!btns.length) return <span className="italic opacity-50">No buttons</span>;
            return <span>{btns.length} option{btns.length !== 1 ? 's' : ''}</span>;
        }
        case 'set_variable': {
            const v = data?.variableName;
            if (!v) return <span className="italic opacity-50">Not set</span>;
            return <span>{truncate(`{{${v}}} = ${data?.value ?? ''}`)}</span>;
        }
        case 'wait': {
            const d = data?.duration;
            if (d == null) return <span className="italic opacity-50">Duration not set</span>;
            return <span>{d} {data?.unit ?? 'seconds'}</span>;
        }
        case 'redirect': {
            const u = data?.url;
            if (!u?.trim()) return <span className="italic opacity-50">No URL set</span>;
            return <span>{truncate(String(u))}</span>;
        }
        case 'ai_message':
        case 'ai_agent': {
            const m = data?.model;
            if (!m) return <span className="italic opacity-50">Model not set</span>;
            return <span>{m}</span>;
        }
        case 'condition':
        case 'filter': {
            const rules: any[] = data?.rules ?? [];
            if (!rules.length) return <span className="italic opacity-50">No rules</span>;
            return <span>{rules.length} rule{rules.length !== 1 ? 's' : ''}</span>;
        }
        default: return null;
    }
}

// ─── Sticky note node ─────────────────────────────────────────────────────────
const StickyNoteNode = memo(function StickyNoteNode({ data, selected }: { data: any; selected: boolean }) {
    return (
        <div className={cn(
            'w-56 min-h-20 rounded-2xl border-2 p-3 shadow-sm text-sm leading-relaxed',
            'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100',
            selected && 'ring-2 ring-yellow-400 ring-offset-1',
        )}>
            {(data?.text as string) || <span className="opacity-50 italic">Add a note…</span>}
        </div>
    );
});

// ─── Main node ────────────────────────────────────────────────────────────────
const SabFlowCustomNode = ({ id, data, type, selected }: NodeProps) => {
    const edges = useEdges();

    const validationErrors: ValidationError[] = useMemo(() => {
        try {
            return validateNode({ id, type, data } as any, edges);
        } catch { return []; }
    }, [id, type, data, edges]);

    const hasError   = validationErrors.some(e => e.type === 'error');
    const hasWarning = !hasError && validationErrors.some(e => e.type === 'warning');

    // Resolve block definition
    const blockType = (data?.blockType as string) ?? type ?? '';

    const blockDef = useMemo(() => {
        if (BLOCK_REGISTRY[blockType]) return {
            ...BLOCK_REGISTRY[blockType],
            appIcon: null as React.ComponentType<{ className?: string }> | null,
            appIconColor: '',
        };

        // Integration (action node)
        const app = sabnodeAppActions.find(a => a.appId === (data?.appId as string));
        if (app) {
            return {
                label:         (data?.name as string) || app.name,
                category:      app.category || 'Integration',
                palette:       'integration' as PaletteKey,
                icon:          Settings2 as React.ComponentType<{ className?: string }>,
                categoryLabel: app.category || 'Integration',
                appIcon:       ((app as any).icon ?? null) as React.ComponentType<{ className?: string }> | null,
                appIconColor:  (app as any).iconColor ?? 'text-blue-500',
            };
        }

        return {
            label:         (data?.name as string) || 'Block',
            category:      'Other',
            palette:       'default' as PaletteKey,
            icon:          Settings2 as React.ComponentType<{ className?: string }>,
            categoryLabel: type ?? '',
            appIcon:       null as null,
            appIconColor:  '',
        };
    }, [data, type, blockType]);

    const pal       = PALETTE[blockDef.palette];
    const Icon      = blockDef.icon;
    const AppIcon   = (blockDef as any).appIcon as React.ComponentType<{ className?: string }> | null;
    const appIconColor = (blockDef as any).appIconColor as string;

    const isTrigger    = blockDef.palette === 'trigger';
    const isCondition  = blockType === 'condition' || type === 'condition';
    const isIntegration = blockDef.palette === 'integration';

    // Action subtitle
    const subtitle = useMemo(() => {
        if (data?.actionName) {
            const app = sabnodeAppActions.find(a => a.appId === (data?.appId as string));
            const action = (app as any)?.actions?.find((a: any) => a.name === data.actionName);
            return (action?.label as string) ?? (data.actionName as string);
        }
        return blockDef.categoryLabel;
    }, [data, blockDef]);

    // Sticky note
    if (type === 'sticky_note' || blockType === 'sticky_note') {
        return (
            <>
                <Handle type="target" position={Position.Left} className="opacity-0!" />
                <StickyNoteNode data={data as any} selected={!!selected} />
                <Handle type="source" position={Position.Right} id="output-main" className="opacity-0!" />
            </>
        );
    }

    const preview = <ContentPreview data={data} blockType={blockType} />;

    return (
        <div className="relative group/node select-none" data-node-id={id}>

            {/* "Start" pill above trigger nodes */}
            {isTrigger && (
                <div className="absolute -top-7 inset-x-0 flex justify-center pointer-events-none">
                    <span className="text-[9.5px] font-bold tracking-[0.15em] uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400">
                        Start
                    </span>
                </div>
            )}

            {/* Validation badge */}
            {(hasError || hasWarning) && (
                <div className={cn(
                    'absolute -top-2 -right-2 z-20 flex h-5 w-5 items-center justify-center rounded-full',
                    'text-white text-[9px] font-bold shadow ring-2 ring-background',
                    hasError ? 'bg-red-500' : 'bg-amber-400',
                )}>
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 z-30 w-52 -translate-x-1/2 rounded-xl border border-border bg-popover p-2.5 text-xs shadow-xl opacity-0 transition-opacity group-hover/node:opacity-100">
                        <p className={cn('mb-1 font-semibold text-[11px]', hasError ? 'text-red-500' : 'text-amber-500')}>
                            {hasError ? 'Errors' : 'Warnings'}
                        </p>
                        <ul className="list-disc space-y-0.5 pl-3 text-left">
                            {validationErrors.map((e, i) => (
                                <li key={i} className={e.type === 'error' ? 'text-red-500' : 'text-amber-400'}>
                                    {e.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* ── Card ────────────────────────────────────────────────────────── */}
            <div className={cn(
                'relative w-64 rounded-2xl border shadow-sm overflow-hidden',
                'transition-all duration-150',
                pal.card, pal.border,
                selected
                    ? 'ring-2 ring-violet-500 ring-offset-1 shadow-lg shadow-violet-500/10'
                    : 'hover:shadow-md hover:-translate-y-px',
            )}>

                {/* Top color band — Typebot's signature style */}
                <div className={cn('h-1 w-full shrink-0', pal.band)} />

                {/* Node body */}
                <div className="flex items-start gap-3 px-3.5 pt-3 pb-3">
                    {/* Icon */}
                    <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm',
                        isIntegration && AppIcon ? '' : pal.icon,
                    )}>
                        {isIntegration && AppIcon
                            ? <AppIcon className={cn('h-4 w-4', appIconColor)} />
                            : <Icon className="h-4 w-4" />
                        }
                    </div>

                    {/* Labels */}
                    <div className="min-w-0 flex-1">
                        {/* Category pill + name */}
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={cn(
                                'text-[9px] font-bold tracking-[0.12em] uppercase px-1.5 py-px rounded-sm',
                                pal.badge,
                            )}>
                                {blockDef.categoryLabel}
                            </span>
                        </div>

                        <p className="truncate text-[13px] font-semibold leading-snug text-foreground">
                            {(data?.name as string) || blockDef.label}
                        </p>

                        {subtitle && subtitle !== blockDef.categoryLabel && (
                            <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground leading-tight">
                                {subtitle}
                            </p>
                        )}

                        {/* Content preview */}
                        {preview && (
                            <div className="mt-2 rounded-lg bg-black/5 dark:bg-white/5 px-2.5 py-1.5 text-[10.5px] text-muted-foreground truncate border border-border/30">
                                {preview}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Handles ─────────────────────────────────────────────────── */}

                {/* Target */}
                {!isTrigger && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        className={cn(
                            'absolute! -left-2! top-1/2! -translate-y-1/2!',
                            'h-4! w-4! rounded-full! border-2! border-background!',
                            'bg-muted-foreground/30! hover:bg-violet-500! transition-colors',
                            'shadow-sm!',
                        )}
                        isConnectableStart={false}
                    />
                )}

                {/* Source — condition: YES/NO, others: single */}
                {isCondition ? (
                    <div className="absolute -right-10 top-0 flex h-full flex-col items-start justify-around py-4">
                        {(['yes', 'no'] as const).map(branch => (
                            <div key={branch} className="flex items-center gap-2">
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`output-${branch}`}
                                    className={cn(
                                        'relative! right-0! top-0! transform-none!',
                                        'h-4! w-4! rounded-full! border-2! border-background! shadow-sm!',
                                        branch === 'yes' ? 'bg-emerald-500!' : 'bg-red-500!',
                                    )}
                                />
                                <span className={cn(
                                    'rounded-md px-1.5 py-px text-[8.5px] font-bold border',
                                    branch === 'yes'
                                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-600'
                                        : 'bg-red-50 dark:bg-red-950 border-red-300 dark:border-red-700 text-red-600',
                                )}>
                                    {branch === 'yes' ? 'YES' : 'NO'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="output-main"
                        className={cn(
                            'absolute! -right-2! top-1/2! -translate-y-1/2!',
                            'h-4! w-4! rounded-full! border-2! border-background!',
                            'bg-muted-foreground/30! hover:bg-violet-500! transition-colors',
                            'shadow-sm!',
                        )}
                    />
                )}
            </div>
        </div>
    );
};

export default memo(SabFlowCustomNode);

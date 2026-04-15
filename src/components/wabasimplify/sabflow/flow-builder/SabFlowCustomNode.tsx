'use client';

import React, { memo, useMemo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useEdges, useReactFlow } from '@xyflow/react';
import { validateNode, ValidationError } from '@/lib/sabflow/validation';
import { cn } from '@/lib/utils';
import {
    Zap, GitFork, Calendar, PlayCircle, Webhook,
    MessageSquare, Type, Image, Video, Music, Globe,
    Phone, Star, Hash, Mail, Upload, CreditCard, List,
    Code2, Filter, Timer, Repeat, ArrowRight, Shuffle,
    Bot, Sparkles, Settings2, StickyNote, ToggleLeft, Link,
    AlertTriangle, Trash2, Settings,
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';

// ─── Block type definitions ───────────────────────────────────────────────────
interface BlockDef {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    stripe: string;
    iconBg: string;
    iconColor: string;
    category: string;
}

const BLOCKS: Record<string, BlockDef> = {
    // Bubbles — gray
    text_bubble:      { label: 'Text',         icon: Type,          stripe: 'bg-zinc-300 dark:bg-zinc-600',    iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500',    category: 'Bubble'   },
    image_bubble:     { label: 'Image',        icon: Image,         stripe: 'bg-zinc-300 dark:bg-zinc-600',    iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500',    category: 'Bubble'   },
    video_bubble:     { label: 'Video',        icon: Video,         stripe: 'bg-zinc-300 dark:bg-zinc-600',    iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500',    category: 'Bubble'   },
    audio_bubble:     { label: 'Audio',        icon: Music,         stripe: 'bg-zinc-300 dark:bg-zinc-600',    iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500',    category: 'Bubble'   },
    embed_bubble:     { label: 'Embed',        icon: Globe,         stripe: 'bg-zinc-300 dark:bg-zinc-600',    iconBg: 'bg-zinc-100 dark:bg-zinc-800',       iconColor: 'text-zinc-500',    category: 'Bubble'   },
    // Inputs — orange
    text_input:       { label: 'Text',         icon: MessageSquare, stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    number_input:     { label: 'Number',       icon: Hash,          stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    email_input:      { label: 'Email',        icon: Mail,          stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    phone_input:      { label: 'Phone',        icon: Phone,         stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    date_input:       { label: 'Date',         icon: Calendar,      stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    url_input:        { label: 'URL',          icon: Link,          stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    file_input:       { label: 'File Upload',  icon: Upload,        stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    buttons:          { label: 'Buttons',      icon: List,          stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    rating:           { label: 'Rating',       icon: Star,          stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    payment:          { label: 'Payment',      icon: CreditCard,    stripe: 'bg-orange-300 dark:bg-orange-600', iconBg: 'bg-orange-50 dark:bg-orange-950/60', iconColor: 'text-orange-500', category: 'Input'    },
    // Logic — purple
    condition:        { label: 'Condition',    icon: GitFork,       stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    set_variable:     { label: 'Set Variable', icon: ToggleLeft,    stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    redirect:         { label: 'Redirect',     icon: ArrowRight,    stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    script:           { label: 'Script',       icon: Code2,         stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    wait:             { label: 'Wait',         icon: Timer,         stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    ab_test:          { label: 'A/B Test',     icon: Shuffle,       stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    jump:             { label: 'Jump',         icon: Repeat,        stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    filter:           { label: 'Filter',       icon: Filter,        stripe: 'bg-purple-300 dark:bg-purple-600', iconBg: 'bg-purple-50 dark:bg-purple-950/60', iconColor: 'text-purple-500', category: 'Logic'    },
    // Triggers — emerald
    trigger:          { label: 'Start',        icon: Zap,           stripe: 'bg-emerald-300 dark:bg-emerald-600', iconBg: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-500', category: 'Trigger' },
    webhook_trigger:  { label: 'Webhook',      icon: Webhook,       stripe: 'bg-emerald-300 dark:bg-emerald-600', iconBg: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-500', category: 'Trigger' },
    schedule:         { label: 'Schedule',     icon: Calendar,      stripe: 'bg-emerald-300 dark:bg-emerald-600', iconBg: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-500', category: 'Trigger' },
    manual:           { label: 'Manual',       icon: PlayCircle,    stripe: 'bg-emerald-300 dark:bg-emerald-600', iconBg: 'bg-emerald-50 dark:bg-emerald-950/60', iconColor: 'text-emerald-500', category: 'Trigger' },
    // AI — violet
    ai_message:       { label: 'AI Message',   icon: Bot,           stripe: 'bg-violet-300 dark:bg-violet-600', iconBg: 'bg-violet-50 dark:bg-violet-950/60', iconColor: 'text-violet-500', category: 'AI'       },
    ai_agent:         { label: 'AI Agent',     icon: Sparkles,      stripe: 'bg-violet-300 dark:bg-violet-600', iconBg: 'bg-violet-50 dark:bg-violet-950/60', iconColor: 'text-violet-500', category: 'AI'       },
};

// ─── Content preview — Typebot-style text bubble ──────────────────────────────
function truncate(s: string, max = 52) {
    return !s ? '' : s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function BlockPreview({ data, blockType }: { data: any; blockType: string }) {
    const text = (() => {
        switch (blockType) {
            case 'text_bubble':  return data?.content?.trim() || null;
            case 'image_bubble': return data?.url?.trim() ? '🖼 ' + truncate(data.url, 40) : null;
            case 'video_bubble': return data?.url?.trim() ? '▶ ' + truncate(data.url, 40) : null;
            case 'audio_bubble': return data?.url?.trim() ? '🎵 ' + truncate(data.url, 40) : null;
            case 'text_input':   return data?.variableName ? `→ {{${data.variableName}}}` : null;
            case 'email_input':  return data?.variableName ? `→ {{${data.variableName}}}` : null;
            case 'phone_input':  return data?.variableName ? `→ {{${data.variableName}}}` : null;
            case 'number_input': return data?.variableName ? `→ {{${data.variableName}}}` : null;
            case 'date_input':   return data?.variableName ? `→ {{${data.variableName}}}` : null;
            case 'url_input':    return data?.variableName ? `→ {{${data.variableName}}}` : null;
            case 'file_input':   return data?.variableName ? `→ {{${data.variableName}}}` : null;
            case 'buttons': {
                const btns: any[] = data?.buttons ?? [];
                return btns.length ? btns.map((b: any) => b.label || b.value).join(' · ') : null;
            }
            case 'rating':       return `★ up to ${data?.maxStars ?? 5}`;
            case 'set_variable': return data?.variableName ? `{{${data.variableName}}} = ${truncate(data?.value ?? '', 28)}` : null;
            case 'redirect':     return data?.url?.trim() ? '↗ ' + truncate(data.url, 44) : null;
            case 'wait':         return data?.duration != null ? `⏱ ${data.duration} ${data?.unit ?? 's'}` : null;
            case 'ai_message':   return data?.model ? `Model: ${data.model}` : null;
            case 'ai_agent':     return data?.instructions ? truncate(data.instructions, 50) : null;
            case 'condition':
            case 'filter': {
                const rules: any[] = data?.rules ?? [];
                return rules.length ? `${rules.length} rule${rules.length !== 1 ? 's' : ''}` : null;
            }
            default: return null;
        }
    })();

    if (!text) return null;

    return (
        <div className="mt-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/50 px-2.5 py-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {truncate(text, 70)}
        </div>
    );
}

// ─── Sticky note ──────────────────────────────────────────────────────────────
const StickyNoteNode = memo(function StickyNoteNode({ data, selected }: { data: any; selected: boolean }) {
    return (
        <div className={cn(
            'relative w-52 min-h-20 rounded-xl border-2 shadow-sm p-3',
            'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700',
            'text-[12px] text-yellow-900 dark:text-yellow-100 leading-relaxed',
            selected && 'ring-2 ring-yellow-400 ring-offset-1',
        )}>
            <StickyNote className="h-3 w-3 text-yellow-400 mb-1.5 opacity-60" />
            {(data?.text as string) || <span className="opacity-40 italic">Add a note…</span>}
            <Handle type="target" position={Position.Left} className="opacity-0!" />
            <Handle type="source" position={Position.Right} id="output-main" className="opacity-0!" />
        </div>
    );
});

// ─── Handle styles ────────────────────────────────────────────────────────────
// Typebot-style: clean circle that turns orange on active/hover
const sourceHandle = [
    '!w-[14px] !h-[14px] !rounded-full',
    '!border-2 !bg-white dark:!bg-zinc-900',
    '!shadow-sm !transition-colors !cursor-crosshair',
    '!border-zinc-300 dark:!border-zinc-600',
    'hover:!border-orange-500',
].join(' ');

const targetHandle = [
    '!w-[14px] !h-[14px] !rounded-full',
    '!border-2 !bg-white dark:!bg-zinc-900',
    '!shadow-sm !transition-colors',
    '!border-zinc-300 dark:!border-zinc-600',
    'hover:!border-orange-500',
].join(' ');

// ─── Main node ────────────────────────────────────────────────────────────────
const SabFlowCustomNode = ({ id, data, type, selected }: NodeProps) => {
    const edges = useEdges();
    const { deleteElements } = useReactFlow();

    const validationErrors: ValidationError[] = useMemo(() => {
        try { return validateNode({ id, type, data } as any, edges); }
        catch { return []; }
    }, [id, type, data, edges]);

    const hasError   = validationErrors.some(e => e.type === 'error');
    const hasWarning = !hasError && validationErrors.some(e => e.type === 'warning');

    const blockType = (data?.blockType as string) ?? type ?? '';

    const def = useMemo((): BlockDef & { appIcon?: React.ComponentType<{ className?: string }> | null; appIconColor?: string } => {
        if (BLOCKS[blockType]) return BLOCKS[blockType];
        const app = sabnodeAppActions.find(a => a.appId === (data?.appId as string));
        if (app) {
            return {
                label:        (data?.name as string) || app.name,
                icon:         Settings2,
                stripe:       'bg-blue-300 dark:bg-blue-600',
                iconBg:       'bg-blue-50 dark:bg-blue-950/60',
                iconColor:    (app as any).iconColor ?? 'text-blue-500',
                category:     app.category || 'Integration',
                appIcon:      (app as any).icon ?? null,
                appIconColor: (app as any).iconColor ?? 'text-blue-500',
            };
        }
        return {
            label:     (data?.name as string) || 'Block',
            icon:      Settings2,
            stripe:    'bg-zinc-200 dark:bg-zinc-600',
            iconBg:    'bg-zinc-50 dark:bg-zinc-800',
            iconColor: 'text-zinc-400',
            category:  '',
        };
    }, [data, type, blockType]);

    const isTrigger   = def.category === 'Trigger';
    const isCondition = blockType === 'condition' || type === 'condition';

    const subtitle = useMemo(() => {
        if (data?.actionName) {
            const app = sabnodeAppActions.find(a => a.appId === (data?.appId as string));
            const action = (app as any)?.actions?.find((a: any) => a.name === data.actionName);
            return (action?.label as string) ?? null;
        }
        return null;
    }, [data]);

    const IconComp  = (def as any).appIcon ?? def.icon;
    const iconColor = (def as any).appIcon ? ((def as any).appIconColor ?? def.iconColor) : def.iconColor;

    const handleDelete = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        deleteElements({ nodes: [{ id }] });
    }, [id, deleteElements]);

    // ── Sticky note ─────────────────────────────────────────────────────────
    if (type === 'sticky_note' || blockType === 'sticky_note') {
        return <StickyNoteNode data={data as any} selected={!!selected} />;
    }

    return (
        // group/node — used for n8n toolbar hover trigger
        <div className="relative group/node select-none" data-node-id={id}>

            {/* ── n8n-style hover toolbar — absolute above the card ───────── */}
            <div className={cn(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10',
                'opacity-0 group-hover/node:opacity-100',
                'pointer-events-none group-hover/node:pointer-events-auto',
                'transition-opacity duration-100',
            )}>
                <div className={cn(
                    'flex items-center gap-0.5 rounded-lg border px-1.5 py-1',
                    'bg-white dark:bg-zinc-900 shadow-md',
                    'border-zinc-200 dark:border-zinc-700',
                )}>
                    <button
                        type="button"
                        onClick={handleDelete}
                        title="Delete node"
                        className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-md',
                            'text-zinc-400 hover:text-red-500',
                            'hover:bg-red-50 dark:hover:bg-red-950/40',
                            'transition-colors',
                        )}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700" />
                    <button
                        type="button"
                        title="Settings"
                        className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-md',
                            'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200',
                            'hover:bg-zinc-100 dark:hover:bg-zinc-800',
                            'transition-colors',
                        )}
                    >
                        <Settings className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>

            {/* ── "Start" badge above trigger nodes ── */}
            {isTrigger && (
                <div className="absolute -top-7 inset-x-0 flex justify-center pointer-events-none">
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.18em] uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400">
                        <Zap className="h-2.5 w-2.5" /> Start
                    </span>
                </div>
            )}

            {/* ── Validation badge ────────────────────────────────────────── */}
            {(hasError || hasWarning) && (
                <div className={cn(
                    'absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full',
                    'text-white shadow ring-2 ring-background',
                    hasError ? 'bg-red-500' : 'bg-amber-400',
                )}>
                    <AlertTriangle className="h-2.5 w-2.5" />
                    <div className="pointer-events-none absolute bottom-full right-0 mb-2 z-30 w-52 rounded-xl border border-border bg-popover p-2.5 text-xs shadow-xl opacity-0 transition-opacity group-hover/node:opacity-100">
                        <p className={cn('mb-1 font-semibold', hasError ? 'text-red-500' : 'text-amber-500')}>
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

            {/* ── Card — Typebot exact style ───────────────────────────────── */}
            <div className={cn(
                'relative flex w-[300px] overflow-hidden rounded-lg',
                'bg-white dark:bg-zinc-900',
                'transition-[border-color,border-width,box-shadow,margin] duration-100',
                selected
                    ? 'border-2 border-orange-500 -m-px shadow-md shadow-orange-500/10'
                    : 'border border-zinc-200 dark:border-zinc-700/80 hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-600',
            )}>

                {/* Left coloured stripe — Typebot signature */}
                <div className={cn('w-1 shrink-0 rounded-l-lg self-stretch', def.stripe)} />

                {/* Card body */}
                <div className="flex-1 min-w-0 px-3 py-2.5">

                    {/* Header: icon + category label */}
                    <div className="flex items-center gap-2 mb-1">
                        <div className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                            def.iconBg,
                        )}>
                            <IconComp className={cn('h-3.5 w-3.5', iconColor)} />
                        </div>

                        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400 dark:text-zinc-500">
                            {def.category || def.label}
                        </span>

                        {/* Block type label on far right */}
                        {def.category && (
                            <span className="ml-auto text-[10px] font-medium text-zinc-300 dark:text-zinc-600 truncate max-w-[70px]">
                                {def.label}
                            </span>
                        )}
                    </div>

                    {/* Node name */}
                    <p className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 leading-snug truncate">
                        {(data?.name as string) || def.label}
                    </p>

                    {/* Sub-label for integration action nodes */}
                    {subtitle && (
                        <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                            {subtitle}
                        </p>
                    )}

                    {/* Content preview bubble */}
                    <BlockPreview data={data} blockType={blockType} />
                </div>

                {/* ── Connection handles ─────────────────────────────────── */}

                {/* Target (in) — left */}
                {!isTrigger && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        className={targetHandle}
                        isConnectableStart={false}
                    />
                )}

                {/* Source (out) — Condition gets YES / NO, others get single */}
                {isCondition ? (
                    <div className="absolute -right-10 top-0 flex h-full flex-col items-start justify-around py-3">
                        {(['yes', 'no'] as const).map(branch => (
                            <div key={branch} className="flex items-center gap-1.5">
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`output-${branch}`}
                                    className={cn(
                                        '!relative !right-0 !top-0 !transform-none',
                                        '!w-[14px] !h-[14px] !rounded-full !border-2 !shadow-sm !transition-colors !cursor-crosshair',
                                        branch === 'yes'
                                            ? '!bg-white dark:!bg-zinc-900 !border-emerald-400 hover:!border-emerald-600'
                                            : '!bg-white dark:!bg-zinc-900 !border-red-400 hover:!border-red-600',
                                    )}
                                />
                                <span className={cn(
                                    'rounded px-1.5 py-px text-[8.5px] font-bold border',
                                    branch === 'yes'
                                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-700 text-emerald-600'
                                        : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-700 text-red-500',
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
                        className={sourceHandle}
                    />
                )}
            </div>
        </div>
    );
};

export default memo(SabFlowCustomNode);

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
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';

// ─── Category visual styles (Typebot-inspired colour coding) ─────────────────
const CATEGORY_STYLES = {
    bubble:      { bg: 'bg-zinc-50 dark:bg-zinc-800/70',     border: 'border-zinc-200 dark:border-zinc-700',          accent: 'bg-zinc-400',    icon: 'text-zinc-500 dark:text-zinc-400' },
    input:       { bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800/60',    accent: 'bg-orange-400',  icon: 'text-orange-500' },
    logic:       { bg: 'bg-purple-50 dark:bg-purple-950/40', border: 'border-purple-200 dark:border-purple-800/60',    accent: 'bg-purple-400',  icon: 'text-purple-500' },
    integration: { bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-200 dark:border-blue-800/60',        accent: 'bg-blue-400',    icon: 'text-blue-500'   },
    trigger:     { bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800/60', accent: 'bg-emerald-400', icon: 'text-emerald-500' },
    ai:          { bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800/60',    accent: 'bg-violet-400',  icon: 'text-violet-500' },
    default:     { bg: 'bg-card',                             border: 'border-border',                                  accent: 'bg-muted-foreground', icon: 'text-muted-foreground' },
} as const;

type Category = keyof typeof CATEGORY_STYLES;

// ─── Block registry (Typebot-style block types) ───────────────────────────────
const BLOCK_REGISTRY: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; category: Category; desc: string }> = {
    // Bubbles – gray
    text_bubble:    { label: 'Text',         icon: Type,          category: 'bubble',      desc: 'Send a text message'      },
    image_bubble:   { label: 'Image',        icon: Image,         category: 'bubble',      desc: 'Send an image'            },
    video_bubble:   { label: 'Video',        icon: Video,         category: 'bubble',      desc: 'Send a video'             },
    audio_bubble:   { label: 'Audio',        icon: Music,         category: 'bubble',      desc: 'Send audio'               },
    embed_bubble:   { label: 'Embed',        icon: Globe,         category: 'bubble',      desc: 'Embed a webpage'          },
    // Inputs – orange
    text_input:     { label: 'Text Input',   icon: MessageSquare, category: 'input',       desc: 'Collect text'             },
    number_input:   { label: 'Number',       icon: Hash,          category: 'input',       desc: 'Collect a number'         },
    email_input:    { label: 'Email',        icon: Mail,          category: 'input',       desc: 'Collect an email'         },
    phone_input:    { label: 'Phone',        icon: Phone,         category: 'input',       desc: 'Collect a phone number'   },
    date_input:     { label: 'Date',         icon: Calendar,      category: 'input',       desc: 'Collect a date'           },
    url_input:      { label: 'URL',          icon: Globe,         category: 'input',       desc: 'Collect a URL'            },
    file_input:     { label: 'File Upload',  icon: Upload,        category: 'input',       desc: 'Collect a file'           },
    buttons:        { label: 'Buttons',      icon: List,          category: 'input',       desc: 'Multiple choice'          },
    rating:         { label: 'Rating',       icon: Star,          category: 'input',       desc: 'Star rating'              },
    payment:        { label: 'Payment',      icon: CreditCard,    category: 'input',       desc: 'Collect payment'          },
    // Logic – purple
    condition:      { label: 'Condition',    icon: GitFork,       category: 'logic',       desc: 'Branch on conditions'     },
    set_variable:   { label: 'Set Variable', icon: ToggleLeft,    category: 'logic',       desc: 'Store a value'            },
    redirect:       { label: 'Redirect',     icon: ArrowRight,    category: 'logic',       desc: 'Redirect to URL'          },
    script:         { label: 'Script',       icon: Code2,         category: 'logic',       desc: 'Run custom code'          },
    wait:           { label: 'Wait',         icon: Timer,         category: 'logic',       desc: 'Pause the flow'           },
    ab_test:        { label: 'A/B Test',     icon: Shuffle,       category: 'logic',       desc: 'Split traffic'            },
    jump:           { label: 'Jump',         icon: Repeat,        category: 'logic',       desc: 'Jump to group'            },
    filter:         { label: 'Filter',       icon: Filter,        category: 'logic',       desc: 'Filter items'             },
    // Triggers – green
    trigger:        { label: 'Trigger',      icon: Zap,           category: 'trigger',     desc: 'Start of flow'            },
    webhook_trigger:{ label: 'Webhook',      icon: Webhook,       category: 'trigger',     desc: 'HTTP webhook'             },
    schedule:       { label: 'Schedule',     icon: Calendar,      category: 'trigger',     desc: 'Scheduled run'            },
    manual:         { label: 'Manual',       icon: PlayCircle,    category: 'trigger',     desc: 'Manual start'             },
    // AI – violet
    ai_message:     { label: 'AI Message',   icon: Bot,           category: 'ai',          desc: 'AI-generated reply'       },
    ai_agent:       { label: 'AI Agent',     icon: Sparkles,      category: 'ai',          desc: 'Run an AI agent'          },
    // Note
    sticky_note:    { label: 'Note',         icon: StickyNote,    category: 'default',     desc: 'Canvas annotation'        },
};

// ─── Sticky note ──────────────────────────────────────────────────────────────
const StickyNoteNode = ({ data }: { data: Record<string, unknown> }) => (
    <div className="w-56 min-h-[80px] bg-yellow-100 dark:bg-yellow-900/40 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-3 shadow-sm text-sm text-yellow-900 dark:text-yellow-100 leading-relaxed">
        {(data?.text as string) || 'Double-click to edit…'}
    </div>
);

// ─── Main node ────────────────────────────────────────────────────────────────
const SabFlowCustomNode = ({ id, data, type, selected }: NodeProps) => {
    const edges = useEdges();

    const validationErrors: ValidationError[] = useMemo(() => {
        try {
            // @ts-ignore – validateNode accepts a partial node shape
            return validateNode({ id, type, data }, edges);
        } catch {
            return [];
        }
    }, [id, type, data, edges]);

    const hasError   = validationErrors.some(e => e.type === 'error');
    const hasWarning = validationErrors.some(e => e.type === 'warning');

    // ── Resolve block definition ────────────────────────────────────────────
    const blockDef = useMemo(() => {
        const blockType = (data?.blockType as string) ?? type ?? '';

        if (BLOCK_REGISTRY[blockType]) return BLOCK_REGISTRY[blockType];

        // Fall back to app registry
        const app = sabnodeAppActions.find(a => a.appId === (data?.appId as string));
        if (app) {
            const catRaw = (app as any).category as string | undefined;
            const cat: Category = catRaw?.toLowerCase().includes('ai') ? 'ai' : 'integration';
            return {
                label: (data?.name as string) || app.name,
                icon:  (app as any).icon ?? Zap,
                category: cat,
                desc: (data?.actionName as string) || 'App action',
            };
        }

        return {
            label: (data?.name as string) || 'Block',
            icon:  Settings2 as React.ComponentType<{ className?: string }>,
            category: 'default' as Category,
            desc:  type ?? 'Node',
        };
    }, [data, type]);

    const style = CATEGORY_STYLES[blockDef.category];
    const Icon  = blockDef.icon;

    const isCondition = type === 'condition' || data?.blockType === 'condition';
    const isTrigger   = blockDef.category === 'trigger';

    // Action subtitle
    const subtitle = useMemo(() => {
        if (data?.actionName) {
            const app = sabnodeAppActions.find(a => a.appId === (data?.appId as string));
            const action = (app as any)?.actions?.find((a: any) => a.name === data.actionName);
            return (action?.label as string) ?? (data.actionName as string);
        }
        return blockDef.desc;
    }, [data, blockDef]);

    // ── Sticky note short-circuit ───────────────────────────────────────────
    if (type === 'sticky_note' || data?.blockType === 'sticky_note') {
        return <StickyNoteNode data={data as Record<string, unknown>} />;
    }

    return (
        <div className="relative group/node select-none" data-node-id={id}>

            {/* "Start" badge above trigger nodes */}
            {isTrigger && (
                <div className="absolute -top-7 inset-x-0 flex justify-center">
                    <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400">
                        Start
                    </span>
                </div>
            )}

            {/* Validation badge */}
            {(hasError || hasWarning) && (
                <>
                    <div className={cn(
                        'absolute -top-2 -right-2 z-20 w-5 h-5 rounded-full flex items-center justify-center',
                        'text-[10px] font-bold text-white shadow ring-2 ring-background',
                        hasError ? 'bg-red-500' : 'bg-orange-400',
                    )}>
                        !
                    </div>
                    {/* Error tooltip */}
                    <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 z-30 w-52 -translate-x-1/2 rounded-lg border border-border bg-popover p-2.5 text-xs shadow-xl opacity-0 transition-opacity group-hover/node:opacity-100">
                        <p className={cn('mb-1 font-semibold', hasError ? 'text-red-500' : 'text-orange-500')}>
                            {hasError ? 'Errors' : 'Warnings'}
                        </p>
                        <ul className="list-disc space-y-0.5 pl-3">
                            {validationErrors.map((e, i) => (
                                <li key={i} className={e.type === 'error' ? 'text-red-500' : 'text-orange-400'}>
                                    {e.message}
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}

            {/* ── Card ─────────────────────────────────────────────────── */}
            <div className={cn(
                'relative w-64 rounded-xl border-2 shadow-sm transition-all duration-150',
                style.bg, style.border,
                selected && 'ring-2 ring-primary ring-offset-1 shadow-md',
                'group-hover/node:shadow-md group-hover/node:-translate-y-px',
            )}>
                {/* Left accent stripe */}
                <div className={cn('absolute left-0 top-0 h-full w-[3px] rounded-l-[10px]', style.accent)} />

                {/* Body */}
                <div className="flex items-start gap-3 py-3 pl-4 pr-3">
                    {/* Icon bubble */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/70 dark:border-white/10 bg-white/60 dark:bg-black/20 shadow-sm">
                        <Icon className={cn('h-[18px] w-[18px]', style.icon)} />
                    </div>

                    {/* Labels */}
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                            {(data?.name as string) || blockDef.label}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {subtitle}
                        </p>
                    </div>
                </div>

                {/* ── Handles ────────────────────────────────────────────── */}

                {/* Target handle – left edge (hidden on triggers) */}
                {!isTrigger && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        className={cn(
                            '!absolute !-left-[7px] !top-1/2 !-translate-y-1/2',
                            '!h-3.5 !w-3.5 !rounded-full !border-2',
                            '!bg-background !border-muted-foreground/40',
                            'hover:!border-primary transition-colors',
                        )}
                        isConnectableStart={false}
                    />
                )}

                {/* Source handles – right edge */}
                {isCondition ? (
                    /* YES / NO dual outputs */
                    <div className="absolute -right-8 top-0 flex h-full flex-col items-start justify-around py-3">
                        {(['yes', 'no'] as const).map(branch => (
                            <div key={branch} className="flex items-center gap-1.5">
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={`output-${branch}`}
                                    className={cn(
                                        '!relative !right-0 !top-0 !transform-none',
                                        '!h-3.5 !w-3.5 !rounded-full !border-2 !border-background shadow-sm',
                                        branch === 'yes' ? '!bg-emerald-500' : '!bg-red-500',
                                    )}
                                />
                                <span className={cn(
                                    'rounded px-1 py-px text-[9px] font-bold border',
                                    branch === 'yes'
                                        ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-600'
                                        : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-600',
                                )}>
                                    {branch.toUpperCase()}
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
                            '!absolute !-right-[7px] !top-1/2 !-translate-y-1/2',
                            '!h-3.5 !w-3.5 !rounded-full !border-2',
                            '!bg-background !border-muted-foreground/40',
                            'hover:!border-primary transition-colors',
                        )}
                    />
                )}
            </div>
        </div>
    );
};

export default memo(SabFlowCustomNode);

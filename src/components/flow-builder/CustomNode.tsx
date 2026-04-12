import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { ALL_BLOCK_TYPES } from './Sidebar';
import {
    LuPlay,
    LuMessageSquare,
} from 'react-icons/lu';

const NodePreview = ({ data, type }: { data: any; type: string }) => {
    switch (type) {
        case 'text':
        case 'input':
            return <p className="whitespace-pre-wrap text-[10px] line-clamp-3 text-clay-ink-muted">{data.text || 'Enter message...'}</p>;
        case 'image':
        case 'video':
        case 'audio':
        case 'document':
        case 'sticker':
            return (
                <div className="space-y-1">
                    <div className="h-8 bg-clay-bg-2/50 rounded flex items-center justify-center text-[9px] text-clay-ink-muted uppercase">{type}</div>
                    {data.caption && <p className="text-[10px] truncate text-clay-ink-muted">{data.caption}</p>}
                </div>
            );
        case 'buttons':
            return (
                <div className="space-y-1">
                    <p className="text-[10px] line-clamp-1 text-clay-ink-muted">{data.text || 'Question text...'}</p>
                    {((data.buttons as any[]) || []).slice(0, 3).map((btn: any, i: number) => (
                        <div key={i} className="text-[9px] text-center bg-clay-bg-2/50 rounded px-1 py-0.5 truncate">{btn.text || `Button ${i + 1}`}</div>
                    ))}
                </div>
            );
        case 'listMessage':
            return <p className="text-[10px] text-clay-ink-muted">{data.buttonText || 'View Options'}</p>;
        case 'condition':
            return <p className="text-[10px] text-clay-ink-muted">{data.variable || 'Set condition...'} {data.operator || '='} {data.value || '?'}</p>;
        case 'delay':
            return <p className="text-[10px] text-clay-ink-muted">{data.duration || '5'} {data.unit || 'seconds'}</p>;
        case 'setVariable':
            return <p className="text-[10px] text-clay-ink-muted font-mono">{data.variableName || 'var'} = {data.variableValue || '...'}</p>;
        case 'sendTemplate':
            return <p className="text-[10px] text-clay-ink-muted">{data.templateName || 'Select template...'}</p>;
        case 'sendLocation':
            return <p className="text-[10px] text-clay-ink-muted">{data.name || 'Location'}</p>;
        case 'assignAgent':
            return <p className="text-[10px] text-clay-ink-muted">{data.agentName || 'Select agent...'}</p>;
        case 'addTag':
            return <p className="text-[10px] text-clay-ink-muted">{data.tagName || 'Select tag...'}</p>;
        case 'api':
        case 'webhook':
            return <p className="text-[10px] text-clay-ink-muted font-mono truncate">{data.url || 'https://...'}</p>;
        default:
            return null;
    }
};

const CustomNode = ({ data, type, selected }: NodeProps) => {
    const blockInfo = ALL_BLOCK_TYPES.find((b) => b.type === type);
    const Icon = blockInfo?.icon || (type === 'start' ? LuPlay : LuMessageSquare);
    const label = (data.label as string) || blockInfo?.label || type;
    const hasPreview = ['text', 'image', 'video', 'audio', 'document', 'sticker', 'buttons', 'listMessage',
        'input', 'condition', 'delay', 'setVariable', 'sendTemplate', 'sendLocation', 'assignAgent',
        'addTag', 'api', 'webhook'].includes(type);

    // Node color based on category
    const getColor = () => {
        if (type === 'start') return 'border-emerald-500/50 bg-emerald-500/5';
        if (type === 'condition') return 'border-amber-500/50 bg-amber-500/5';
        if (['delay', 'input', 'setVariable', 'triggerFlow'].includes(type)) return 'border-purple-500/50 bg-purple-500/5';
        if (['api', 'webhook', 'sendSms', 'sendEmail'].includes(type)) return 'border-blue-500/50 bg-blue-500/5';
        if (['createCrmLead', 'assignAgent', 'addTag', 'sendOrder', 'notification'].includes(type)) return 'border-orange-500/50 bg-orange-500/5';
        return 'border-clay-border bg-clay-surface';
    };

    return (
        <div className="relative">
            <div className={cn(
                'w-56 rounded-xl border shadow-sm transition-all',
                getColor(),
                selected && 'ring-2 ring-clay-accent shadow-md',
            )}>
                {/* Header */}
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                    <div className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        type === 'start' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-clay-bg-2 text-clay-ink-muted',
                    )}>
                        <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-[12px] font-semibold text-clay-ink truncate leading-tight">{label}</span>
                </div>

                {/* Preview */}
                {hasPreview && (
                    <div className="px-3 pb-2.5">
                        <div className="rounded-lg bg-white/50 dark:bg-black/10 p-2">
                            <NodePreview data={data} type={type} />
                        </div>
                    </div>
                )}

                {/* Handles */}
                {type !== 'start' && (
                    <Handle
                        type="target"
                        position={Position.Left}
                        className="!w-2.5 !h-2.5 !bg-clay-ink-muted !border-2 !border-white"
                    />
                )}

                {type === 'condition' ? (
                    <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 flex flex-col gap-4">
                        <div className="relative">
                            <Handle type="source" position={Position.Right} id="output-yes"
                                className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-white !right-0 !relative !transform-none" />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] font-bold text-emerald-600 bg-white px-1 rounded shadow-sm border">YES</span>
                        </div>
                        <div className="relative">
                            <Handle type="source" position={Position.Right} id="output-no"
                                className="!w-2.5 !h-2.5 !bg-red-500 !border-2 !border-white !right-0 !relative !transform-none" />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] font-bold text-red-600 bg-white px-1 rounded shadow-sm border">NO</span>
                        </div>
                    </div>
                ) : type === 'buttons' || type === 'listMessage' ? (
                    <div className="absolute -right-2.5 top-10 flex flex-col gap-1.5">
                        {((data.buttons as any[]) || []).slice(0, 5).map((_: any, i: number) => (
                            <Handle key={i} type="source" position={Position.Right} id={`btn-${i}`}
                                className="!w-2.5 !h-2.5 !bg-blue-500 !border-2 !border-white !right-0 !relative !transform-none" />
                        ))}
                        <Handle type="source" position={Position.Right} id="output-main"
                            className="!w-2.5 !h-2.5 !bg-clay-ink-muted !border-2 !border-white !right-0 !relative !transform-none" />
                    </div>
                ) : (
                    <Handle type="source" position={Position.Right} id="output-main"
                        className="!w-2.5 !h-2.5 !bg-clay-ink-muted !border-2 !border-white" />
                )}
            </div>
        </div>
    );
};

export default memo(CustomNode);

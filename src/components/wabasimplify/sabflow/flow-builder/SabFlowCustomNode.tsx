
import React, { memo, useMemo } from 'react';
import { Handle, Position, NodeProps, useEdges } from '@xyflow/react';
import { validateNode, ValidationError } from '@/lib/sabflow/validation';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
    Zap,
    GitFork,
    Check,
    X,
    Plus
} from 'lucide-react';
import { sabnodeAppActions } from '@/lib/sabflow/apps';
import {
    Calendar,
    PlayCircle,
    Webhook
} from 'lucide-react';

const triggers = [
    { id: 'webhook', name: 'Webhook', icon: Webhook },
    { id: 'manual', name: 'Manual', icon: PlayCircle },
    { id: 'schedule', name: 'Schedule', icon: Calendar },
    { id: 'app', name: 'App Trigger', icon: Zap },
];

const SabFlowCustomNode = ({ id, data, type, selected }: NodeProps) => {
    const edges = useEdges();

    const validationErrors = useMemo(() => {
        // We need to construct a partial node object that matches what validateNode expects
        const nodeForValidation = { id, type, data };
        // @ts-ignore - validateNode handles the structural typing
        return validateNode(nodeForValidation, edges);
    }, [id, data, type, edges]);

    const hasError = validationErrors.some(e => e.type === 'error');
    const hasWarning = validationErrors.some(e => e.type === 'warning');

    const nodeInfo = useMemo(() => {
        if (type === 'trigger') {
            const triggerType = triggers.find(t => t.id === data.triggerType);
            return {
                label: 'Trigger',
                subLabel: triggerType?.name || 'Select Trigger',
                icon: triggerType?.icon || Zap,
                color: 'text-primary'
            };
        }

        if (type === 'condition') {
            return {
                label: data.name || 'Condition',
                subLabel: 'Branching Logic',
                icon: GitFork,
                color: 'text-orange-500'
            };
        }

        // Action
        const appConfig = sabnodeAppActions.find(a => a.appId === data.appId);
        let actionLabel = 'Select action';

        if (appConfig) {
            if (data.actionName) {
                if (data.actionName === 'apiRequest') {
                    actionLabel = 'API Request';
                } else if (appConfig.actions && Array.isArray(appConfig.actions)) {
                    const action = appConfig.actions.find(a => a.name === data.actionName);
                    if (action) actionLabel = action.label;
                }
            }
        }

        return {
            label: data.name || (appConfig ? appConfig.name : 'Action'),
            subLabel: actionLabel,
            icon: appConfig?.icon || Zap,
            color: appConfig?.iconColor || 'text-primary'
        };

    }, [data, type]);

    const Icon = nodeInfo.icon;

    return (
        <div className="relative group/node">
            {type === 'trigger' && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest whitespace-nowrap">
                    Start of Flow
                </div>
            )}

            {(hasError || hasWarning) && (
                <div className={cn(
                    "absolute -top-2 -right-2 z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-background",
                    hasError ? "bg-destructive" : "bg-orange-500"
                )}>
                    {hasError ? "!" : "?"}
                </div>
            )}

            {/* Tooltip for errors */}
            {(hasError || hasWarning) && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover/node:opacity-100 transition-opacity pointer-events-none z-20 border">
                    <p className="font-semibold mb-1">{hasError ? 'Errors' : 'Warnings'}:</p>
                    <ul className="list-disc pl-3 space-y-0.5">
                        {validationErrors.map((e: ValidationError, i: number) => (
                            <li key={i} className={e.type === 'error' ? 'text-destructive' : 'text-orange-500'}>
                                {e.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <Card
                className={cn(
                    'w-64 shadow-md transition-all duration-200 border-2',
                    selected ? 'ring-2 ring-primary border-primary shadow-lg' : 'border-border hover:shadow-lg',
                    !selected && hasError && 'border-destructive/50',
                    !selected && hasWarning && !hasError && 'border-orange-400/50'
                )}
            >
                <CardHeader className="flex flex-row items-center gap-3 p-3 space-y-0">
                    <div className={cn("p-2 rounded-md bg-muted flex items-center justify-center h-10 w-10 shrink-0", selected && "bg-primary/10")}>
                        <Icon className={cn("h-6 w-6", nodeInfo.color)} />
                    </div>
                    <div className="overflow-hidden">
                        <CardTitle className="text-sm font-semibold leading-none truncate mb-1">
                            {nodeInfo.label}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground truncate">
                            {nodeInfo.subLabel}
                        </p>
                    </div>
                </CardHeader>

                {/* Handles */}
                {type !== 'trigger' && ( // Triggers don't have input handles
                    <Handle
                        type="target"
                        position={Position.Left}
                        className="w-3 h-3 bg-muted-foreground border-2 border-background"
                        isConnectableStart={false}
                    />
                )}

                {type === 'condition' ? (
                    <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex flex-col gap-6">
                        <div className="relative group">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="output-yes"
                                className="w-3 h-3 bg-green-500 border-2 border-background !right-0 !relative !transform-none hover:w-4 hover:h-4 transition-all"
                            />
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-green-600 bg-background px-1.5 py-0.5 rounded shadow-sm border border-green-200 pointer-events-none">
                                YES
                            </div>
                        </div>
                        <div className="relative group">
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="output-no"
                                className="w-3 h-3 bg-red-500 border-2 border-background !right-0 !relative !transform-none hover:w-4 hover:h-4 transition-all"
                            />
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 text-[10px] font-bold text-red-600 bg-background px-1.5 py-0.5 rounded shadow-sm border border-red-200 pointer-events-none">
                                NO
                            </div>
                        </div>
                    </div>
                ) : (
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="output-main"
                        className="w-3 h-3 bg-muted-foreground border-2 border-background"
                    />
                )}
            </Card>
        </div>
    );
};

export default memo(SabFlowCustomNode);

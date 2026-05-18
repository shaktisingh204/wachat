'use client';

import { ZoruBadge, ZoruButton, ZoruSwitch, ZoruTableCell, ZoruTableRow, cn } from '@/components/zoruui';
import {
  useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    Copy,
  GripVertical,
  Pencil,
  PlayCircle,
  Trash2,
  } from 'lucide-react';

/**
 * Sortable row inside the auto-reply rules table. Uses `@dnd-kit` so
 * users can drag rules to change their priority.
 */

import * as React from 'react';

import type { RuleRow } from '../_types';
import {
    actionLabel,
    triggerSummary,
} from './rule-helpers';

interface Props {
    rule: RuleRow;
    botName: string | null;
    onEdit: (rule: RuleRow) => void;
    onDuplicate: (rule: RuleRow) => void;
    onTest: (rule: RuleRow) => void;
    onDelete: (rule: RuleRow) => void;
    onToggle: (rule: RuleRow, next: boolean) => void;
    onOpenDetail: (rule: RuleRow) => void;
}

export function RuleTableRow({
    rule,
    botName,
    onEdit,
    onDuplicate,
    onTest,
    onDelete,
    onToggle,
    onOpenDetail,
}: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: rule._id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
    };

    return (
        <ZoruTableRow
            ref={setNodeRef}
            style={style}
            className={cn(isDragging && 'bg-muted/40')}
            data-rule-id={rule._id}
        >
            <ZoruTableCell className="w-8 pr-0">
                <button
                    type="button"
                    {...attributes}
                    {...listeners}
                    aria-label="Drag to reorder"
                    className="cursor-grab text-muted-foreground hover:text-foreground"
                >
                    <GripVertical className="h-4 w-4" />
                </button>
            </ZoruTableCell>
            <ZoruTableCell>
                <button
                    type="button"
                    onClick={() => onOpenDetail(rule)}
                    className="text-left font-medium hover:underline"
                >
                    {rule.name}
                </button>
                <div className="text-xs text-muted-foreground">
                    priority {rule.priority}
                </div>
            </ZoruTableCell>
            <ZoruTableCell className="max-w-[260px] truncate">
                <span className="text-sm text-foreground">
                    {triggerSummary(rule.trigger)}
                </span>
            </ZoruTableCell>
            <ZoruTableCell>
                <div className="flex flex-wrap gap-1">
                    {rule.actions.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                            (no actions)
                        </span>
                    )}
                    {rule.actions.slice(0, 3).map((a, i) => (
                        <ZoruBadge key={i} variant="secondary">
                            {actionLabel(a.kind)}
                        </ZoruBadge>
                    ))}
                    {rule.actions.length > 3 && (
                        <ZoruBadge variant="ghost">
                            +{rule.actions.length - 3}
                        </ZoruBadge>
                    )}
                </div>
            </ZoruTableCell>
            <ZoruTableCell className="text-sm">
                {botName ?? <span className="text-muted-foreground">All bots</span>}
            </ZoruTableCell>
            <ZoruTableCell>
                <ZoruSwitch
                    checked={rule.status === 'enabled'}
                    onCheckedChange={(v) => onToggle(rule, v)}
                    aria-label={`Toggle ${rule.name}`}
                />
            </ZoruTableCell>
            <ZoruTableCell className="text-sm tabular-nums">
                {rule.fired7d.toLocaleString()}
            </ZoruTableCell>
            <ZoruTableCell className="text-sm text-muted-foreground">
                {rule.lastRunAt
                    ? new Date(rule.lastRunAt).toLocaleString()
                    : 'Never'}
            </ZoruTableCell>
            <ZoruTableCell className="text-right">
                <div className="flex justify-end gap-1">
                    <ZoruButton
                        variant="ghost"
                        size="icon"
                        title="Edit"
                        onClick={() => onEdit(rule)}
                    >
                        <Pencil className="h-4 w-4" />
                    </ZoruButton>
                    <ZoruButton
                        variant="ghost"
                        size="icon"
                        title="Duplicate"
                        onClick={() => onDuplicate(rule)}
                    >
                        <Copy className="h-4 w-4" />
                    </ZoruButton>
                    <ZoruButton
                        variant="ghost"
                        size="icon"
                        title="Test"
                        onClick={() => onTest(rule)}
                    >
                        <PlayCircle className="h-4 w-4" />
                    </ZoruButton>
                    <ZoruButton
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => onDelete(rule)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </ZoruButton>
                </div>
            </ZoruTableCell>
        </ZoruTableRow>
    );
}

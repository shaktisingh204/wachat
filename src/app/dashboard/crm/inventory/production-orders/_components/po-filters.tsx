'use client';

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/sabcrm/20ui/compat';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  Download,
  Trash2,
  X } from 'lucide-react';

/**
 * Filter row + bulk bar for the production-orders list. Pure
 * presentation — parent owns state and forwards changes.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';

import type { PoStatusFilter } from './po-kpi-strip';

export type PoYieldBucket = 'all' | 'low' | 'mid' | 'high';

export type PoBulkOp =
    | 'delete'
    | 'status_planned'
    | 'status_released'
    | 'status_in_progress'
    | 'status_completed'
    | 'status_closed'
    | 'status_cancelled';

export interface PoFiltersRowProps {
    status: PoStatusFilter;
    onStatusChange: (v: PoStatusFilter) => void;
    bomFilter: string;
    onBomFilterChange: (v: string) => void;
    dateFrom: string;
    dateTo: string;
    onDateFromChange: (v: string) => void;
    onDateToChange: (v: string) => void;
    machineFilter: string;
    onMachineFilterChange: (v: string) => void;
    operatorFilter: string;
    onOperatorFilterChange: (v: string) => void;
    yieldBucket: PoYieldBucket;
    onYieldBucketChange: (v: PoYieldBucket) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function PoFiltersRow(props: PoFiltersRowProps) {
    return (
        <Card>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Status
                    </Label>
                    <EnumFilterField
                        enumName="productionOrderStatus"
                        value={props.status}
                        onChange={(v) => props.onStatusChange(v as PoStatusFilter)}
                        allLabel="All"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        BOM
                    </Label>
                    <Input
                        placeholder="BOM ref / code"
                        value={props.bomFilter}
                        onChange={(e) => props.onBomFilterChange(e.target.value)}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Date range
                    </Label>
                    <div className="flex items-center gap-1">
                        <Input
                            type="date"
                            value={props.dateFrom}
                            onChange={(e) => props.onDateFromChange(e.target.value)}
                        />
                        <Input
                            type="date"
                            value={props.dateTo}
                            onChange={(e) => props.onDateToChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Machine
                    </Label>
                    <Input
                        placeholder="Line / machine id"
                        value={props.machineFilter}
                        onChange={(e) => props.onMachineFilterChange(e.target.value)}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Operator
                    </Label>
                    <EntityFormField
                        entity="employee"
                        name="operatorFilter"
                        initialId={props.operatorFilter || null}
                        placeholder="Any operator"
                        onChange={(next) => props.onOperatorFilterChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Yield
                    </Label>
                    <Select
                        value={props.yieldBucket}
                        onValueChange={(v) => props.onYieldBucketChange(v as PoYieldBucket)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">Any yield</ZoruSelectItem>
                            <ZoruSelectItem value="low">Below 60%</ZoruSelectItem>
                            <ZoruSelectItem value="mid">60 – 90%</ZoruSelectItem>
                            <ZoruSelectItem value="high">90% +</ZoruSelectItem>
                        </ZoruSelectContent>
                    </Select>
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-6">
                        <Button variant="ghost" size="sm" onClick={props.onClear}>
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                    </div>
                ) : null}
            </ZoruCardContent>
        </Card>
    );
}

/* ─── Bulk bar ──────────────────────────────────────────────────── */

export interface PoBulkBarProps {
    count: number;
    onClear: () => void;
    onDelete: () => void;
    onExport: () => void;
    onChangeStatus: (op: PoBulkOp) => void;
}

export function PoBulkBar({
    count,
    onClear,
    onDelete,
    onExport,
    onChangeStatus,
}: PoBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{count} selected</Badge>
            <Select onValueChange={(v) => onChangeStatus(v as PoBulkOp)}>
                <ZoruSelectTrigger className="h-8 w-[180px]">
                    <ZoruSelectValue placeholder="Set status…" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                    <ZoruSelectItem value="status_planned">Planned</ZoruSelectItem>
                    <ZoruSelectItem value="status_released">Released</ZoruSelectItem>
                    <ZoruSelectItem value="status_in_progress">In progress</ZoruSelectItem>
                    <ZoruSelectItem value="status_completed">Completed</ZoruSelectItem>
                    <ZoruSelectItem value="status_closed">Closed</ZoruSelectItem>
                    <ZoruSelectItem value="status_cancelled">Cancelled</ZoruSelectItem>
                </ZoruSelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear}>
                Clear
            </Button>
        </div>
    );
}

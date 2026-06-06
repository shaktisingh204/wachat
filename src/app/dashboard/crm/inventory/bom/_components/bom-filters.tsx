'use client';

import { Badge, Button, Card, CardBody, Input, Label } from '@/components/sabcrm/20ui';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import {
  Archive,
  Download,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X } from 'lucide-react';

/**
 * Filters + bulk bar for the BOM list. Pure presentation — parent owns
 * the filter values and forwards via `onChange`-style props.
 */

import { EntityFormField } from '@/components/crm/entity-form-field';

export type BomStatusFilter = 'all' | 'active' | 'inactive' | 'draft' | 'archived';

export interface BomFiltersRowProps {
    status: BomStatusFilter;
    onStatusChange: (v: BomStatusFilter) => void;
    finishedGoodId: string;
    onFinishedGoodChange: (v: string) => void;
    versionMin: string;
    versionMax: string;
    onVersionMinChange: (v: string) => void;
    onVersionMaxChange: (v: string) => void;
    effectiveFrom: string;
    effectiveTo: string;
    onEffectiveFromChange: (v: string) => void;
    onEffectiveToChange: (v: string) => void;
    activeOnly: boolean;
    onActiveOnlyChange: (v: boolean) => void;
    hasActiveFilters: boolean;
    onClear: () => void;
}

export function BomFiltersRow(props: BomFiltersRowProps) {
    return (
        <Card>
            <CardBody className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-5">
                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Status
                    </Label>
                    <EnumFilterField
                        enumName="bomStatus"
                        value={props.status}
                        onChange={(v) => props.onStatusChange(v as BomStatusFilter)}
                        allLabel="All"
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Finished good
                    </Label>
                    <EntityFormField
                        entity="item"
                        name="finishedGoodFilter"
                        initialId={props.finishedGoodId || null}
                        placeholder="Any item"
                        onChange={(next) => props.onFinishedGoodChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Version
                    </Label>
                    <div className="flex items-center gap-1">
                        <Input
                            placeholder="Min"
                            value={props.versionMin}
                            onChange={(e) => props.onVersionMinChange(e.target.value)}
                        />
                        <Input
                            placeholder="Max"
                            value={props.versionMax}
                            onChange={(e) => props.onVersionMaxChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Effective date
                    </Label>
                    <div className="flex items-center gap-1">
                        <Input
                            type="date"
                            value={props.effectiveFrom}
                            onChange={(e) => props.onEffectiveFromChange(e.target.value)}
                        />
                        <Input
                            type="date"
                            value={props.effectiveTo}
                            onChange={(e) => props.onEffectiveToChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                        Active flag
                    </Label>
                    <Button
                        variant={props.activeOnly ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => props.onActiveOnlyChange(!props.activeOnly)}
                        className="w-full justify-start"
                    >
                        {props.activeOnly ? (
                            <ToggleRight className="h-3.5 w-3.5" />
                        ) : (
                            <ToggleLeft className="h-3.5 w-3.5" />
                        )}
                        {props.activeOnly ? 'Active only' : 'Include all'}
                    </Button>
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-5">
                        <Button variant="ghost" size="sm" onClick={props.onClear}>
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </Button>
                    </div>
                ) : null}
            </CardBody>
        </Card>
    );
}

/* ─── Bulk bar ──────────────────────────────────────────────────── */

export interface BomBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onActivate: () => void;
    onDeactivate: () => void;
    onExport: () => void;
}

export function BomBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onActivate,
    onDeactivate,
    onExport,
}: BomBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{count} selected</Badge>
            <Button size="sm" variant="outline" onClick={onActivate}>
                <ToggleRight className="h-3.5 w-3.5" /> Activate
            </Button>
            <Button size="sm" variant="outline" onClick={onDeactivate}>
                <ToggleLeft className="h-3.5 w-3.5" /> Deactivate
            </Button>
            <Button size="sm" variant="outline" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
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

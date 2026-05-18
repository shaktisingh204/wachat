'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
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
        <ZoruCard>
            <ZoruCardContent className="grid grid-cols-1 gap-3 pt-4 md:grid-cols-3 lg:grid-cols-5">
                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Status
                    </ZoruLabel>
                    <ZoruSelect
                        value={props.status}
                        onValueChange={(v) => props.onStatusChange(v as BomStatusFilter)}
                    >
                        <ZoruSelectTrigger>
                            <ZoruSelectValue />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All</ZoruSelectItem>
                            <ZoruSelectItem value="active">Active</ZoruSelectItem>
                            <ZoruSelectItem value="inactive">Inactive</ZoruSelectItem>
                            <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                            <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Finished good
                    </ZoruLabel>
                    <EntityFormField
                        entity="item"
                        name="finishedGoodFilter"
                        initialId={props.finishedGoodId || null}
                        placeholder="Any item"
                        onChange={(next) => props.onFinishedGoodChange(next ?? '')}
                    />
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Version
                    </ZoruLabel>
                    <div className="flex items-center gap-1">
                        <ZoruInput
                            placeholder="Min"
                            value={props.versionMin}
                            onChange={(e) => props.onVersionMinChange(e.target.value)}
                        />
                        <ZoruInput
                            placeholder="Max"
                            value={props.versionMax}
                            onChange={(e) => props.onVersionMaxChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Effective date
                    </ZoruLabel>
                    <div className="flex items-center gap-1">
                        <ZoruInput
                            type="date"
                            value={props.effectiveFrom}
                            onChange={(e) => props.onEffectiveFromChange(e.target.value)}
                        />
                        <ZoruInput
                            type="date"
                            value={props.effectiveTo}
                            onChange={(e) => props.onEffectiveToChange(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                        Active flag
                    </ZoruLabel>
                    <ZoruButton
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
                    </ZoruButton>
                </div>

                {props.hasActiveFilters ? (
                    <div className="flex items-end md:col-span-3 lg:col-span-5">
                        <ZoruButton variant="ghost" size="sm" onClick={props.onClear}>
                            <X className="h-3.5 w-3.5" /> Clear filters
                        </ZoruButton>
                    </div>
                ) : null}
            </ZoruCardContent>
        </ZoruCard>
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
            <ZoruBadge variant="info">{count} selected</ZoruBadge>
            <ZoruButton size="sm" variant="outline" onClick={onActivate}>
                <ToggleRight className="h-3.5 w-3.5" /> Activate
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onDeactivate}>
                <ToggleLeft className="h-3.5 w-3.5" /> Deactivate
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export CSV
            </ZoruButton>
            <ZoruButton size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>
            <ZoruButton size="sm" variant="ghost" onClick={onClear}>
                Clear
            </ZoruButton>
        </div>
    );
}

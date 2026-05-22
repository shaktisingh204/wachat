'use client';

import {
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Archive,
  MoreHorizontal,
  Trash2 } from 'lucide-react';

/**
 * <PoTable> — 11-column dense table per §1D.1 for production orders.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { CrmProductionOrderDoc } from '@/app/actions/crm-production-orders.actions';

export type PoStatusTarget =
    | 'released'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export interface PoTableProps {
    orders: CrmProductionOrderDoc[];
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onRowStatus: (id: string, status: PoStatusTarget) => void;
    onDelete: (id: string) => void;
}

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtNum(v: unknown): string {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return v.toLocaleString();
}

export function PoTable({
    orders,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onRowStatus,
    onDelete,
}: PoTableProps) {
    const allSelected =
        orders.length > 0 && orders.every((o) => selectedIds.has(o._id));
    const someSelected =
        !allSelected && orders.some((o) => selectedIds.has(o._id));

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                aria-label="Select all orders on this page"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>PO #</ZoruTableHead>
                        <ZoruTableHead>BOM ref</ZoruTableHead>
                        <ZoruTableHead>Finished good</ZoruTableHead>
                        <ZoruTableHead className="text-right">Planned</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actual yield</ZoruTableHead>
                        <ZoruTableHead className="text-right">Scrap</ZoruTableHead>
                        <ZoruTableHead>Start</ZoruTableHead>
                        <ZoruTableHead>End</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {orders.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={11}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No orders match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        orders.map((o) => {
                            const isSel = selectedIds.has(o._id);
                            const fgId =
                                o.finishedGoodId && typeof o.finishedGoodId !== 'string'
                                    ? (o.finishedGoodId as any).toString?.()
                                    : (o.finishedGoodId as string | undefined);
                            return (
                                <ZoruTableRow
                                    key={o._id}
                                    className={[
                                        'border-zoru-line transition-colors',
                                        isSel ? 'bg-zoru-surface-2/70' : '',
                                    ].join(' ')}
                                >
                                    <ZoruTableCell>
                                        <ZoruCheckbox
                                            aria-label={`Select ${o.orderNo}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(o._id)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/inventory/production-orders/${o._id}`}
                                            label={<span className="font-mono">{o.orderNo || o._id.slice(-6)}</span>}
                                            subtitle={o.finishedGoodName || undefined}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {o.bomRef || o.bomId || '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {fgId ? (
                                            <EntityPickerChip
                                                entity="item"
                                                id={fgId}
                                                fallback={o.finishedGoodName || '—'}
                                            />
                                        ) : (
                                            <span className="text-[13px] text-zoru-ink">
                                                {o.finishedGoodName || '—'}
                                            </span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {fmtNum(o.plannedQty)} {o.unit || ''}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {fmtNum(o.actualYield)} {o.unit || ''}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink-muted">
                                        {fmtNum(o.scrap)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(o.plannedStart)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(o.plannedEnd)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill label={o.status} tone={statusToTone(o.status)} />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruDropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${o.orderNo}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/inventory/production-orders/${o._id}`}
                                                    >
                                                        View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/inventory/production-orders/${o._id}/update-yield`}
                                                    >
                                                        Update yield
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'released')}
                                                >
                                                    Release
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'in_progress')}
                                                >
                                                    Start
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'completed')}
                                                >
                                                    Mark complete
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'cancelled')}
                                                >
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    Cancel
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onDelete(o._id)}
                                                    className="text-zoru-danger"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </ZoruDropdownMenu>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            );
                        })
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

export default PoTable;

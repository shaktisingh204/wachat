'use client';

import { Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
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


import type { CrmProductionOrderDoc } from '@/app/actions/crm-production-orders.actions.types';

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
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                        <Th className="w-[36px]">
                            <Checkbox
                                aria-label="Select all orders on this page"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </Th>
                        <Th>PO #</Th>
                        <Th>BOM ref</Th>
                        <Th>Finished good</Th>
                        <Th className="text-right">Planned</Th>
                        <Th className="text-right">Actual yield</Th>
                        <Th className="text-right">Scrap</Th>
                        <Th>Start</Th>
                        <Th>End</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {orders.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td
                                colSpan={11}
                                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                            >
                                No orders match the current filters.
                            </Td>
                        </Tr>
                    ) : (
                        orders.map((o) => {
                            const isSel = selectedIds.has(o._id);
                            const fgId =
                                o.finishedGoodId && typeof o.finishedGoodId !== 'string'
                                    ? (o.finishedGoodId as any).toString?.()
                                    : (o.finishedGoodId as string | undefined);
                            return (
                                <Tr
                                    key={o._id}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        const btn = document.getElementById(`po-actions-${o._id}`);
                                        if (btn) btn.click();
                                    }}
                                    className={[
                                        'border-[var(--st-border)] transition-colors',
                                        isSel ? 'bg-[var(--st-bg-muted)]/70' : '',
                                    ].join(' ')}
                                >
                                    <Td>
                                        <Checkbox
                                            aria-label={`Select ${o.orderNo}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(o._id)}
                                        />
                                    </Td>
                                    <Td>
                                        <EntityRowLink
                                            href={`/dashboard/crm/inventory/production-orders/${o._id}`}
                                            label={<span className="font-mono">{o.orderNo || o._id.slice(-6)}</span>}
                                            subtitle={o.finishedGoodName || undefined}
                                        />
                                    </Td>
                                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {o.bomRef || o.bomId || '—'}
                                    </Td>
                                    <Td>
                                        {fgId ? (
                                            <EntityPickerChip
                                                entity="item"
                                                id={fgId}
                                                fallback={o.finishedGoodName || '—'}
                                            />
                                        ) : (
                                            <span className="text-[13px] text-[var(--st-text)]">
                                                {o.finishedGoodName || '—'}
                                            </span>
                                        )}
                                    </Td>
                                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                                        {fmtNum(o.plannedQty)} {o.unit || ''}
                                    </Td>
                                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                                        {fmtNum(o.actualYield)} {o.unit || ''}
                                    </Td>
                                    <Td className="text-right text-[13px] text-[var(--st-text-secondary)]">
                                        {fmtNum(o.scrap)}
                                    </Td>
                                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {o.plannedStart ? new Date(o.plannedStart).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—'}
                                    </Td>
                                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {o.plannedEnd ? new Date(o.plannedEnd).toLocaleDateString('en-GB', { timeZone: 'UTC' }) : '—'}
                                    </Td>
                                    <Td>
                                        <StatusPill label={o.status} tone={statusToTone(o.status)} />
                                    </Td>
                                    <Td className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    id={`po-actions-${o._id}`}
                                                    type="button"
                                                    aria-label={`Actions for ${o.orderNo}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/inventory/production-orders/${o._id}`}
                                                    >
                                                        View
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/inventory/production-orders/${o._id}/update-yield`}
                                                    >
                                                        Update yield
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'released')}
                                                >
                                                    Release
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'in_progress')}
                                                >
                                                    Start
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'completed')}
                                                >
                                                    Mark complete
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => onRowStatus(o._id, 'cancelled')}
                                                >
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    Cancel
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(o._id)}
                                                    className="text-[var(--st-danger)]"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </Td>
                                </Tr>
                            );
                        })
                    )}
                </TBody>
            </Table>
        </div>
    );
}

export default PoTable;

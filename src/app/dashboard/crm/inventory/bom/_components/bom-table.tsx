'use client';

import { fmtDate } from '@/lib/utils';
import { Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
import {
  Archive,
  Copy,
  Edit,
  Factory,
  MoreHorizontal,
  Power,
  Trash2 } from 'lucide-react';
import { RowContextMenu } from './context-menu';

/**
 * <BomTable> — 10-column dense table per §1D.1: select · BOM code ·
 * finished good (chip) · version · output qty · components count · total
 * cost · effective date · status · actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import type { CrmBomDoc } from '@/app/actions/crm-bom.actions.types';

export interface BomTableProps {
    boms: (CrmBomDoc & { _id: string })[];
    loading: boolean;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onDuplicate: (id: string) => void;
    onToggleStatus: (id: string, active: boolean) => void;
}


function fmtNum(v: unknown): string {
    if (typeof v !== 'number' || !Number.isFinite(v)) return '—';
    return v.toLocaleString();
}

function fmtMoney(v: number | undefined): string {
    if (!Number.isFinite(v ?? NaN) || (v ?? 0) <= 0) return '—';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(v as number);
    } catch {
        return `INR ${v}`;
    }
}

export function BomTable({
    boms,
    loading,
    selectedIds,
    onToggleOne,
    onToggleAll,
    onArchive,
    onDelete,
    onDuplicate,
    onToggleStatus,
}: BomTableProps) {
    const allSelected =
        boms.length > 0 && boms.every((b) => selectedIds.has(String(b._id)));
    const someSelected =
        !allSelected && boms.some((b) => selectedIds.has(String(b._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                        <Th className="w-[36px]">
                            <Checkbox
                                aria-label="Select all BOMs on this page"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </Th>
                        <Th>BOM code</Th>
                        <Th>Finished good</Th>
                        <Th>Version</Th>
                        <Th className="text-right">Output qty</Th>
                        <Th className="text-right">Components</Th>
                        <Th className="text-right">Total cost</Th>
                        <Th>Effective</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Tr key={i} className="border-[var(--st-border)]">
                                <Td colSpan={10}>
                                    <Skeleton className="h-10 w-full" />
                                </Td>
                            </Tr>
                        ))
                    ) : boms.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                            >
                                No BOMs match the current filters.
                            </Td>
                        </Tr>
                    ) : (
                        boms.map((bom) => {
                            const id = String(bom._id);
                            const isSel = selectedIds.has(id);
                            const status = bom.status || 'draft';
                            const isActive = bom.active === true || status === 'active';
                            const fgId =
                                bom.finishedGoodId
                                    ? typeof bom.finishedGoodId === 'string'
                                        ? bom.finishedGoodId
                                        : (bom.finishedGoodId as { toString?: () => string })?.toString?.()
                                    : '';
                            return (
                                <RowContextMenu key={id} bomId={id}>
                                <Tr
                                    className={[
                                        'border-[var(--st-border)] transition-colors',
                                        status === 'archived' ? 'opacity-70' : '',
                                        isSel ? 'bg-[var(--st-bg-muted)]/70' : '',
                                    ].join(' ')}
                                >
                                    <Td>
                                        <Checkbox
                                            aria-label={`Select ${bom.bomNo}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </Td>
                                    <Td>
                                        <EntityRowLink
                                            href={`/dashboard/crm/inventory/bom/${id}`}
                                            label={<span className="font-mono">{bom.bomNo || id.slice(-6)}</span>}
                                            subtitle={bom.finishedGoodName || undefined}
                                        />
                                    </Td>
                                    <Td>
                                        {fgId ? (
                                            <EntityPickerChip
                                                entity="item"
                                                id={fgId}
                                                fallback={bom.finishedGoodName || fgId.slice(-6)}
                                            />
                                        ) : (
                                            <span className="text-[13px] text-[var(--st-text)]">
                                                {bom.finishedGoodName || '—'}
                                            </span>
                                        )}
                                    </Td>
                                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {bom.version || '—'}
                                    </Td>
                                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                                        {fmtNum(bom.outputQty)} {bom.unit || ''}
                                    </Td>
                                    <Td className="text-right text-[13px] text-[var(--st-text)]">
                                        {Array.isArray(bom.components) ? bom.components.length : 0}
                                    </Td>
                                    <Td className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                                        {fmtMoney(bom.totalCost)}
                                    </Td>
                                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                                        {fmtDate(bom.effectiveDate)}
                                    </Td>
                                    <Td>
                                        <StatusPill label={status} tone={statusToTone(status)} />
                                    </Td>
                                    <Td className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${bom.bomNo}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/inventory/bom/${id}`}>
                                                        View
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/inventory/bom/${id}/edit`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/inventory/production-orders/new?bomId=${id}`}
                                                    >
                                                        <Factory className="mr-1.5 h-3.5 w-3.5" />
                                                        Create production order
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onDuplicate(id)}>
                                                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                                                    Duplicate
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onToggleStatus(id, !isActive)}
                                                >
                                                    <Power className="mr-1.5 h-3.5 w-3.5" />
                                                    {isActive ? 'Deactivate' : 'Activate'}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => onArchive(id)}>
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    Archive
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => onDelete(id)}
                                                    className="text-[var(--st-danger)]"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </Td>
                                </Tr>
                                </RowContextMenu>
                            );
                        })
                    )}
                </TBody>
            </Table>
        </div>
    );
}

export default BomTable;

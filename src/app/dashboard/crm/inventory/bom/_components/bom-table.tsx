'use client';

import { fmtDate } from '@/lib/utils';
import {
  Checkbox,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
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
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <Table>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <Checkbox
                                aria-label="Select all BOMs on this page"
                                checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>BOM code</ZoruTableHead>
                        <ZoruTableHead>Finished good</ZoruTableHead>
                        <ZoruTableHead>Version</ZoruTableHead>
                        <ZoruTableHead className="text-right">Output qty</ZoruTableHead>
                        <ZoruTableHead className="text-right">Components</ZoruTableHead>
                        <ZoruTableHead className="text-right">Total cost</ZoruTableHead>
                        <ZoruTableHead>Effective</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <ZoruTableRow key={i} className="border-zoru-line">
                                <ZoruTableCell colSpan={10}>
                                    <Skeleton className="h-10 w-full" />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : boms.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No BOMs match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
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
                                <ZoruTableRow
                                    className={[
                                        'border-zoru-line transition-colors',
                                        status === 'archived' ? 'opacity-70' : '',
                                        isSel ? 'bg-zoru-surface-2/70' : '',
                                    ].join(' ')}
                                >
                                    <ZoruTableCell>
                                        <Checkbox
                                            aria-label={`Select ${bom.bomNo}`}
                                            checked={isSel}
                                            onCheckedChange={() => onToggleOne(id)}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <EntityRowLink
                                            href={`/dashboard/crm/inventory/bom/${id}`}
                                            label={<span className="font-mono">{bom.bomNo || id.slice(-6)}</span>}
                                            subtitle={bom.finishedGoodName || undefined}
                                        />
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        {fgId ? (
                                            <EntityPickerChip
                                                entity="item"
                                                id={fgId}
                                                fallback={bom.finishedGoodName || fgId.slice(-6)}
                                            />
                                        ) : (
                                            <span className="text-[13px] text-zoru-ink">
                                                {bom.finishedGoodName || '—'}
                                            </span>
                                        )}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {bom.version || '—'}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {fmtNum(bom.outputQty)} {bom.unit || ''}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                                        {Array.isArray(bom.components) ? bom.components.length : 0}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right font-mono text-[12.5px] text-zoru-ink">
                                        {fmtMoney(bom.totalCost)}
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                        {fmtDate(bom.effectiveDate)}
                                    </ZoruTableCell>
                                    <ZoruTableCell>
                                        <StatusPill label={status} tone={statusToTone(status)} />
                                    </ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <DropdownMenu>
                                            <ZoruDropdownMenuTrigger asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Actions for ${bom.bomNo}`}
                                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </button>
                                            </ZoruDropdownMenuTrigger>
                                            <ZoruDropdownMenuContent align="end">
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/inventory/bom/${id}`}>
                                                        View
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link href={`/dashboard/crm/inventory/bom/${id}/edit`}>
                                                        <Edit className="mr-1.5 h-3.5 w-3.5" />
                                                        Edit
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem asChild>
                                                    <Link
                                                        href={`/dashboard/crm/inventory/production-orders/new?bomId=${id}`}
                                                    >
                                                        <Factory className="mr-1.5 h-3.5 w-3.5" />
                                                        Create production order
                                                    </Link>
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem onClick={() => onDuplicate(id)}>
                                                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                                                    Duplicate
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onToggleStatus(id, !isActive)}
                                                >
                                                    <Power className="mr-1.5 h-3.5 w-3.5" />
                                                    {isActive ? 'Deactivate' : 'Activate'}
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuSeparator />
                                                <ZoruDropdownMenuItem onClick={() => onArchive(id)}>
                                                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                                                    Archive
                                                </ZoruDropdownMenuItem>
                                                <ZoruDropdownMenuItem
                                                    onClick={() => onDelete(id)}
                                                    className="text-zoru-danger"
                                                >
                                                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                                    Delete
                                                </ZoruDropdownMenuItem>
                                            </ZoruDropdownMenuContent>
                                        </DropdownMenu>
                                    </ZoruTableCell>
                                </ZoruTableRow>
                                </RowContextMenu>
                            );
                        })
                    )}
                </ZoruTableBody>
            </Table>
        </div>
    );
}

export default BomTable;

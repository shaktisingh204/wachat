'use client';

/**
 * Meta-style data table. Renders a row for each entity with a checkbox,
 * inline toggle, delivery badge, and metric columns. Used for campaigns,
 * ad sets and ads.
 */

import * as React from 'react';
import Link from 'next/link';
import {
    MoreHorizontal, ArrowUpDown, Circle, Copy, Trash2, Edit, Eye, AlertTriangle,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatMoney, formatNumber, formatPercent } from './constants';

export type MetaRow = {
    id: string;
    name: string;
    status: string;
    effective_status?: string;
    delivery?: string;
    budget?: number | string;
    bid_strategy?: string;
    objective?: string;
    results?: number;
    reach?: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    cpc?: number;
    cpm?: number;
    spend?: number;
    cost_per_result?: number;
    frequency?: number;
    link?: string;
    thumbnail?: string;
    issues?: number;
};

type ColumnDef = {
    id: keyof MetaRow | 'status' | 'name' | 'actions';
    label: string;
    align?: 'left' | 'right' | 'center';
    width?: string;
    formatter?: (v: any) => string;
};

const BASE_COLS: ColumnDef[] = [
    { id: 'status', label: '', width: '56px' },
    { id: 'name', label: 'Name' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'bid_strategy', label: 'Bid strategy' },
    { id: 'budget', label: 'Budget', align: 'right' },
    { id: 'results', label: 'Results', align: 'right', formatter: formatNumber },
    { id: 'reach', label: 'Reach', align: 'right', formatter: formatNumber },
    { id: 'impressions', label: 'Impressions', align: 'right', formatter: formatNumber },
    { id: 'cost_per_result', label: 'Cost/result', align: 'right', formatter: (v) => formatMoney(v) },
    { id: 'spend', label: 'Amount spent', align: 'right', formatter: (v) => formatMoney(v) },
    { id: 'ctr', label: 'CTR', align: 'right', formatter: formatPercent },
    { id: 'cpc', label: 'CPC (link)', align: 'right', formatter: (v) => formatMoney(v) },
    { id: 'frequency', label: 'Frequency', align: 'right', formatter: (v) => (v ? Number(v).toFixed(2) : '—') },
    { id: 'actions', label: '', width: '48px' },
];

export function deliveryLabel(row: MetaRow): { label: string; color: string; icon?: React.ReactNode } {
    const s = (row.effective_status || row.status || '').toUpperCase();
    if (s.includes('DISAPPROVED')) return { label: 'Rejected', color: 'text-red-600' };
    if (s.includes('PENDING')) return { label: 'In review', color: 'text-amber-600' };
    if (s.includes('DELETED')) return { label: 'Deleted', color: 'text-muted-foreground' };
    if (s.includes('ARCHIVED')) return { label: 'Archived', color: 'text-muted-foreground' };
    if (s === 'ACTIVE') return { label: 'Active', color: 'text-green-600' };
    if (s === 'PAUSED') return { label: 'Off', color: 'text-muted-foreground' };
    return { label: s || 'Unknown', color: 'text-muted-foreground' };
}

export function MetaDataTable({
    rows,
    onToggle,
    onRowClick,
    onDelete,
    onDuplicate,
    onEdit,
    selectedIds,
    setSelectedIds,
    level,
    linkBase,
}: {
    rows: MetaRow[];
    onToggle: (id: string, active: boolean) => void;
    onRowClick?: (row: MetaRow) => void;
    onDelete?: (id: string) => void;
    onDuplicate?: (id: string) => void;
    onEdit?: (id: string) => void;
    selectedIds: Set<string>;
    setSelectedIds: (ids: Set<string>) => void;
    level: 'campaign' | 'adset' | 'ad';
    linkBase?: string;
}) {
    const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
    const indeterminate = !allSelected && rows.some((r) => selectedIds.has(r.id));

    const toggleAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(rows.map((r) => r.id)));
    };

    const toggleOne = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    return (
        <div className="relative border rounded-lg bg-background overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-muted/60 sticky top-0 z-[1]">
                        <TableRow className="h-10">
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={allSelected ? true : indeterminate ? 'indeterminate' : false}
                                    onCheckedChange={toggleAll}
                                />
                            </TableHead>
                            {BASE_COLS.map((col) => (
                                <TableHead
                                    key={String(col.id)}
                                    className={cn(
                                        'text-[11px] uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap',
                                        col.align === 'right' && 'text-right',
                                    )}
                                    style={col.width ? { width: col.width } : undefined}
                                >
                                    <div
                                        className={cn(
                                            'inline-flex items-center gap-1 cursor-pointer select-none',
                                            col.align === 'right' && 'justify-end w-full',
                                        )}
                                    >
                                        {col.label}
                                        {col.label && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                                    </div>
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={BASE_COLS.length + 1} className="h-40 text-center text-muted-foreground">
                                    No {level === 'campaign' ? 'campaigns' : level === 'adset' ? 'ad sets' : 'ads'} to show.
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((row) => {
                                const selected = selectedIds.has(row.id);
                                const delivery = deliveryLabel(row);
                                const active = row.status === 'ACTIVE';
                                return (
                                    <TableRow
                                        key={row.id}
                                        className={cn(
                                            'cursor-pointer group',
                                            selected && 'bg-[#E7F0FE]/40 dark:bg-[#1877F2]/10',
                                        )}
                                    >
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <Checkbox checked={selected} onCheckedChange={() => toggleOne(row.id)} />
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()} className="py-2">
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={active}
                                                    onCheckedChange={(val) => onToggle(row.id, val)}
                                                    className="data-[state=checked]:bg-[#1877F2]"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell onClick={() => onRowClick?.(row)} className="py-2 max-w-[320px]">
                                            <div className="flex items-center gap-3">
                                                {row.thumbnail && (
                                                    <img
                                                        src={row.thumbnail}
                                                        alt=""
                                                        className="h-10 w-10 rounded object-cover border shrink-0"
                                                    />
                                                )}
                                                <div className="min-w-0">
                                                    {linkBase ? (
                                                        <Link
                                                            href={`${linkBase}/${row.id}`}
                                                            className="font-medium text-sm text-[#1877F2] hover:underline truncate block"
                                                        >
                                                            {row.name}
                                                        </Link>
                                                    ) : (
                                                        <span className="font-medium text-sm truncate block">{row.name}</span>
                                                    )}
                                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                                                        {row.objective && <span className="truncate">{row.objective}</span>}
                                                        {row.issues ? (
                                                            <span className="flex items-center gap-1 text-amber-600">
                                                                <AlertTriangle className="h-3 w-3" />
                                                                {row.issues} issue{row.issues > 1 ? 's' : ''}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className={cn('flex items-center gap-1.5 text-xs font-medium', delivery.color)}>
                                                <Circle className="h-2 w-2 fill-current" />
                                                {delivery.label}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {row.bid_strategy || '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm">
                                            {row.budget ? (
                                                <div>
                                                    <div>{formatMoney(row.budget)}</div>
                                                    <div className="text-[10px] text-muted-foreground">Daily</div>
                                                </div>
                                            ) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.results != null ? formatNumber(row.results) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.reach != null ? formatNumber(row.reach) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.impressions != null ? formatNumber(row.impressions) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.cost_per_result != null ? formatMoney(row.cost_per_result) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.spend != null ? formatMoney(row.spend) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.ctr != null ? formatPercent(row.ctr) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.cpc != null ? formatMoney(row.cpc) : '—'}
                                        </TableCell>
                                        <TableCell className="text-right text-sm tabular-nums">
                                            {row.frequency != null ? Number(row.frequency).toFixed(2) : '—'}
                                        </TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-60 hover:opacity-100">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => onEdit?.(row.id)}>
                                                        <Edit className="mr-2 h-4 w-4" /> Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onDuplicate?.(row.id)}>
                                                        <Copy className="mr-2 h-4 w-4" /> Duplicate
                                                    </DropdownMenuItem>
                                                    {row.link && (
                                                        <DropdownMenuItem asChild>
                                                            <a href={row.link} target="_blank" rel="noreferrer">
                                                                <Eye className="mr-2 h-4 w-4" /> View preview
                                                            </a>
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => onDelete?.(row.id)}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

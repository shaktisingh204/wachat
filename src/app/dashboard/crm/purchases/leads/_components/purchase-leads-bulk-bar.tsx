'use client';

import * as React from 'react';
import { Archive, Download, ListChecks, Trash2, X } from 'lucide-react';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui';

const STATUS_BULK_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'New', label: 'New' },
    { value: 'Contacted', label: 'Contacted' },
    { value: 'Qualified', label: 'Qualified' },
    { value: 'Unqualified', label: 'Unqualified' },
    { value: 'Won', label: 'Won' },
];

export interface PurchaseLeadsBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onStatusChange: (status: string) => void;
    onExportCsv: () => void;
    onExportXlsx: () => void;
}

export function PurchaseLeadsBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onStatusChange,
    onExportCsv,
    onExportXlsx,
}: PurchaseLeadsBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--st-text)]">
                {count} selected
            </span>
            <span className="flex-1" />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                        <ListChecks className="h-3.5 w-3.5" /> Set status
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>Set lead status</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {STATUS_BULK_OPTIONS.map((opt) => (
                        <DropdownMenuItem
                            key={opt.value}
                            onSelect={() => onStatusChange(opt.value)}
                        >
                            {opt.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                        <Download className="h-3.5 w-3.5" /> Export
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onExportCsv()}>
                        Export selected as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onExportXlsx()}>
                        Export selected as XLSX
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
            </Button>

            <Button
                size="sm"
                variant="outline"
                onClick={onDelete}
                className="text-[var(--st-danger)]"
            >
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>

            <Button size="sm" variant="ghost" onClick={onClear}>
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

export default PurchaseLeadsBulkBar;

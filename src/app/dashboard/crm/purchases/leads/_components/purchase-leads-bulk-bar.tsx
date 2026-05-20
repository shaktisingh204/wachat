'use client';

import * as React from 'react';
import { Archive, Download, ListChecks, Trash2, X } from 'lucide-react';

import {
    ZoruButton,
    ZoruDropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuLabel,
    ZoruDropdownMenuSeparator,
    ZoruDropdownMenuTrigger,
} from '@/components/zoruui';

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
            <span className="text-[13px] font-medium text-zoru-ink">
                {count} selected
            </span>
            <span className="flex-1" />

            <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton size="sm" variant="outline">
                        <ListChecks className="h-3.5 w-3.5" /> Set status
                    </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    <ZoruDropdownMenuLabel>Set lead status</ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuSeparator />
                    {STATUS_BULK_OPTIONS.map((opt) => (
                        <ZoruDropdownMenuItem
                            key={opt.value}
                            onSelect={() => onStatusChange(opt.value)}
                        >
                            {opt.label}
                        </ZoruDropdownMenuItem>
                    ))}
                </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>

            <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton size="sm" variant="outline">
                        <Download className="h-3.5 w-3.5" /> Export
                    </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end">
                    <ZoruDropdownMenuItem onSelect={() => onExportCsv()}>
                        Export selected as CSV
                    </ZoruDropdownMenuItem>
                    <ZoruDropdownMenuItem onSelect={() => onExportXlsx()}>
                        Export selected as XLSX
                    </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
            </ZoruDropdownMenu>

            <ZoruButton size="sm" variant="outline" onClick={onArchive}>
                <Archive className="h-3.5 w-3.5" /> Archive
            </ZoruButton>

            <ZoruButton
                size="sm"
                variant="outline"
                onClick={onDelete}
                className="text-zoru-danger-ink"
            >
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>

            <ZoruButton size="sm" variant="ghost" onClick={onClear}>
                <X className="h-3.5 w-3.5" />
            </ZoruButton>
        </div>
    );
}

export default PurchaseLeadsBulkBar;

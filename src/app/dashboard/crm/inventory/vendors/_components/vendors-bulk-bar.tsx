'use client';

import * as React from 'react';
import { Download, Tag, Trash2, X } from 'lucide-react';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/sabcrm/20ui/compat';

import type { VendorTypeOption } from './vendors-filters';

export interface VendorsBulkBarProps {
    count: number;
    vendorTypeOptions: ReadonlyArray<VendorTypeOption>;
    onClear: () => void;
    onDelete: () => void;
    onChangeVendorType: (vendorType: string) => void;
    onExportCsv: () => void;
    onExportXlsx: () => void;
}

export function VendorsBulkBar({
    count,
    vendorTypeOptions,
    onClear,
    onDelete,
    onChangeVendorType,
    onExportCsv,
    onExportXlsx,
}: VendorsBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--st-text)]">
                {count} selected
            </span>
            <span className="flex-1" />

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline">
                        <Tag className="h-3.5 w-3.5" /> Set type
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    <DropdownMenuLabel>Set vendor type</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {vendorTypeOptions.length === 0 ? (
                        <DropdownMenuItem disabled>No types available</DropdownMenuItem>
                    ) : (
                        vendorTypeOptions.map((opt) => (
                            <DropdownMenuItem
                                key={opt.value}
                                onSelect={() => onChangeVendorType(opt.value)}
                            >
                                {opt.label}
                            </DropdownMenuItem>
                        ))
                    )}
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

export default VendorsBulkBar;

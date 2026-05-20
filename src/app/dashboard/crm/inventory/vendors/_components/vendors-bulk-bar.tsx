'use client';

import * as React from 'react';
import { Download, Tag, Trash2, X } from 'lucide-react';

import {
    ZoruButton,
    ZoruDropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuLabel,
    ZoruDropdownMenuSeparator,
    ZoruDropdownMenuTrigger,
} from '@/components/zoruui';

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
            <span className="text-[13px] font-medium text-zoru-ink">
                {count} selected
            </span>
            <span className="flex-1" />

            <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                    <ZoruButton size="sm" variant="outline">
                        <Tag className="h-3.5 w-3.5" /> Set type
                    </ZoruButton>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                    <ZoruDropdownMenuLabel>Set vendor type</ZoruDropdownMenuLabel>
                    <ZoruDropdownMenuSeparator />
                    {vendorTypeOptions.length === 0 ? (
                        <ZoruDropdownMenuItem disabled>No types available</ZoruDropdownMenuItem>
                    ) : (
                        vendorTypeOptions.map((opt) => (
                            <ZoruDropdownMenuItem
                                key={opt.value}
                                onSelect={() => onChangeVendorType(opt.value)}
                            >
                                {opt.label}
                            </ZoruDropdownMenuItem>
                        ))
                    )}
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

export default VendorsBulkBar;

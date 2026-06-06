'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { Archive, Download, RefreshCw, Trash2 } from 'lucide-react';

import * as React from 'react';

interface BulkBarProps {
    selectedCount: number;
    onArchive: () => void;
    onActivate: () => void;
    onDelete: () => void;
    onExport: () => void;
    onClear: () => void;
    pending?: boolean;
}

export function VoucherBooksBulkBar({
    selectedCount,
    onArchive,
    onActivate,
    onDelete,
    onExport,
    onClear,
    pending,
}: BulkBarProps) {
    return (
        <div className="flex items-center justify-between gap-2 text-[13px] text-[var(--st-text)]">
            <div>
                <strong>{selectedCount}</strong> selected
                <button
                    type="button"
                    onClick={onClear}
                    className="ml-2 text-[var(--st-text-secondary)] underline-offset-2 hover:underline"
                >
                    clear
                </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={onArchive} disabled={pending}>
                    <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
                </Button>
                <Button variant="outline" size="sm" onClick={onActivate} disabled={pending}>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Activate
                </Button>
                <Button variant="outline" size="sm" onClick={onExport} disabled={pending}>
                    <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                </Button>
                <Button variant="destructive" size="sm" onClick={onDelete} disabled={pending}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
            </div>
        </div>
    );
}

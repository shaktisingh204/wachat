'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { Archive, BadgeDollarSign, Download, Trash2, X } from 'lucide-react';

/**
 * Bulk action bar for the Credit Notes list per §1D.1.
 */

interface CreditNoteBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onRefund: () => void;
    onExport: () => void;
}

export function CreditNoteBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onRefund,
    onExport,
}: CreditNoteBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-[var(--st-text)]">
                {count} selected
            </span>
            <span className="flex-1" />
            <Button size="sm" variant="outline" onClick={onRefund}>
                <BadgeDollarSign className="h-3.5 w-3.5" /> Mark refunded
            </Button>
            <Button size="sm" variant="outline" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export
            </Button>
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

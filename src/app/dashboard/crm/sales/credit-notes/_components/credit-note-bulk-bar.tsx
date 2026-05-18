'use client';

import { ZoruButton } from '@/components/zoruui';
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
            <span className="text-[13px] font-medium text-zoru-ink">
                {count} selected
            </span>
            <span className="flex-1" />
            <ZoruButton size="sm" variant="outline" onClick={onRefund}>
                <BadgeDollarSign className="h-3.5 w-3.5" /> Mark refunded
            </ZoruButton>
            <ZoruButton size="sm" variant="outline" onClick={onExport}>
                <Download className="h-3.5 w-3.5" /> Export
            </ZoruButton>
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

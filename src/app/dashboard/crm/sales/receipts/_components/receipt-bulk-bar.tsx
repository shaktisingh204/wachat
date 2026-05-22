'use client';

import { Button } from '@/components/zoruui';
import { Archive, CheckCircle2, Download, Trash2, X, XCircle } from 'lucide-react';

/**
 * Bulk action bar for the Payment Receipts list. Renders only when at
 * least one row is selected. Provides Archive, Delete, Export, and
 * status mutations (Mark Cleared / Mark Bounced) per §1D.1.
 */

interface ReceiptBulkBarProps {
    count: number;
    onClear: () => void;
    onArchive: () => void;
    onDelete: () => void;
    onMarkCleared: () => void;
    onMarkBounced: () => void;
    onExport: () => void;
}

export function ReceiptBulkBar({
    count,
    onClear,
    onArchive,
    onDelete,
    onMarkCleared,
    onMarkBounced,
    onExport,
}: ReceiptBulkBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-zoru-ink">
                {count} selected
            </span>
            <span className="flex-1" />
            <Button size="sm" variant="outline" onClick={onMarkCleared}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark cleared
            </Button>
            <Button size="sm" variant="outline" onClick={onMarkBounced}>
                <XCircle className="h-3.5 w-3.5" /> Mark bounced
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
                className="text-zoru-danger-ink"
            >
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={onClear}>
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    );
}

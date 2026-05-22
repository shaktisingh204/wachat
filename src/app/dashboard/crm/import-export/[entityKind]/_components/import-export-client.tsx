'use client';

import { Button, Card, useZoruToast } from '@/components/zoruui';
import { Download, Loader2 } from 'lucide-react';

/**
 * Client wrapper for the per-entity Import/Export page.
 *
 * Renders `<BulkImportWizard>` plus an "Export" action that calls
 * `exportEntityToCsv` and triggers a browser download.
 */

import * as React from 'react';

import { BulkImportWizard } from '@/components/crm/BulkImportWizard';

import { exportEntityToCsv } from '@/app/actions/crm-bulk-export.actions';

interface Props {
    entityKind: string;
}

export function ImportExportClient({ entityKind }: Props): React.ReactElement {
    const { toast } = useZoruToast();
    const [busy, setBusy] = React.useState(false);

    const handleExport = React.useCallback(async (): Promise<void> => {
        setBusy(true);
        try {
            const { csv, rowCount, capped, error } = await exportEntityToCsv(
                entityKind,
                {},
            );
            if (error || !csv) {
                toast({
                    title: 'Export failed',
                    description: error ?? 'Empty result.',
                    variant: 'destructive',
                });
                return;
            }
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${entityKind}-${new Date()
                .toISOString()
                .slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast({
                title: 'Export ready',
                description: capped
                    ? `Downloaded ${rowCount} rows (cap reached).`
                    : `Downloaded ${rowCount} rows.`,
            });
        } finally {
            setBusy(false);
        }
    }, [entityKind, toast]);

    return (
        <div className="flex w-full flex-col gap-4">
            <ZoruCard className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                    <h2 className="text-sm font-medium text-zoru-ink">Export</h2>
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        Download all {entityKind} rows in your tenant (capped
                        at 10,000).
                    </p>
                </div>
                <ZoruButton
                    type="button"
                    onClick={() => void handleExport()}
                    disabled={busy}
                >
                    {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Download className="h-3.5 w-3.5" />
                    )}
                    Download CSV
                </ZoruButton>
            </ZoruCard>

            <BulkImportWizard entityKind={entityKind} />
        </div>
    );
}

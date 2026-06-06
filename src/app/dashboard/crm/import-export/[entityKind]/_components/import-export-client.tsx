'use client';

import { Button, Card, useZoruToast } from '@/components/sabcrm/20ui/compat';
import { Download, Loader2 } from 'lucide-react';

/**
 * Client wrapper for the per-entity Import/Export page.
 *
 * Renders `<BulkImportWizard>` plus an "Export" action that calls
 * `exportEntityToCsv` and triggers a browser download.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';

import { BulkImportWizard } from '@/components/crm/BulkImportWizard';

import { exportEntityToCsv } from '@/app/actions/crm-bulk-export.actions';
import { logExportHistory } from './export-history.actions';

interface Props {
    entityKind: string;
    canImport: boolean;
    canExport: boolean;
    onExportSuccess?: () => void;
}

export function ImportExportClient({ entityKind, canImport, canExport, onExportSuccess }: Props): React.ReactElement {
    const { toast } = useZoruToast();
    const router = useRouter();
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
            
            await logExportHistory(entityKind, rowCount || 0);
            onExportSuccess?.();
            router.refresh();
            
            toast({
                title: 'Export ready',
                description: capped
                    ? `Downloaded ${rowCount} rows (cap reached).`
                    : `Downloaded ${rowCount} rows.`,
            });
        } finally {
            setBusy(false);
        }
    }, [entityKind, toast, onExportSuccess]);

    return (
        <div className="flex w-full flex-col gap-4">
            {canExport && (
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                    <h2 className="text-sm font-medium text-zoru-ink">Export</h2>
                    <p className="text-[12.5px] text-zoru-ink-muted">
                        Download all {entityKind} rows in your tenant (capped
                        at 10,000).
                    </p>
                </div>
                <Button
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
                </Button>
            </Card>
            )}

            {canImport ? (
                <BulkImportWizard entityKind={entityKind} />
            ) : (
                <Card className="p-4 text-center">
                    <p className="text-sm text-zoru-ink-muted">You do not have permission to run bulk imports.</p>
                </Card>
            )}
        </div>
    );
}

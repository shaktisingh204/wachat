/**
 * Per-entity Import/Export page — `/dashboard/crm/import-export/[entityKind]`.
 *
 * Wraps `<BulkImportWizard>` for the resolved entity kind plus a CSV
 * export button. Server component shell — the wizard does the heavy
 * lifting on the client.
 */



import { ImportExportClient } from './_components/import-export-client';
import { SUPPORTED_ENTITY_KINDS } from '@/lib/bulk-import/registry';
import { getExportHistory } from './_components/export-history.actions';
import { hasPermissionGroup } from '@/lib/permission-groups/check';
import { format } from 'date-fns';
import { Suspense } from 'react';
import {
    Breadcrumb,
    ZoruBreadcrumbItem,
    ZoruBreadcrumbLink,
    ZoruBreadcrumbList,
    ZoruBreadcrumbPage,
    ZoruBreadcrumbSeparator,
    Card,
    Table,
    ZoruTableHeader,
    ZoruTableRow,
    ZoruTableHead,
    ZoruTableBody,
    ZoruTableCell,
} from '@/components/sabcrm/20ui/compat';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ entityKind: string }>;
}

export default async function ImportExportEntityPage({
    params,
}: PageProps): Promise<React.ReactElement> {
    const { entityKind } = await params;
    if (
        !SUPPORTED_ENTITY_KINDS.includes(
            entityKind as (typeof SUPPORTED_ENTITY_KINDS)[number],
        )
    ) {
        throw new Error(`Unsupported entity kind: ${entityKind}`);
    }

    const canView = await hasPermissionGroup('import_export', 'view');
    const canImport = await hasPermissionGroup('import_export', 'create');

    if (!canView && !canImport) {
        throw new Error('You do not have permission to access Import & Export.');
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <Breadcrumb>
                <ZoruBreadcrumbList>
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/crm">CRM</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbLink href="/dashboard/crm/import-export">Import &amp; Export</ZoruBreadcrumbLink>
                    </ZoruBreadcrumbItem>
                    <ZoruBreadcrumbSeparator />
                    <ZoruBreadcrumbItem>
                        <ZoruBreadcrumbPage>{entityKind}</ZoruBreadcrumbPage>
                    </ZoruBreadcrumbItem>
                </ZoruBreadcrumbList>
            </Breadcrumb>
            <h1 className="text-lg font-semibold text-[var(--st-text)]">
                Import / Export — {entityKind}
            </h1>
            <ImportExportClient entityKind={entityKind} canImport={canImport} canExport={canView} />
            
            <div className="mt-6 flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-[var(--st-text)]">Recent Exports</h2>
                <Suspense fallback={<ExportHistorySkeleton />}>
                    <ExportHistoryList entityKind={entityKind} />
                </Suspense>
            </div>
        </div>
    );
}

async function ExportHistoryList({ entityKind }: { entityKind: string }) {
    const history = await getExportHistory(entityKind);

    return (
        <Card className="overflow-hidden">
            {history.length === 0 ? (
                <div className="p-4 text-sm text-[var(--st-text-secondary)]">No recent exports found.</div>
            ) : (
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead>Date</ZoruTableHead>
                            <ZoruTableHead>Rows Exported</ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {history.map(h => (
                            <ZoruTableRow key={h.id}>
                                <ZoruTableCell className="text-[12.5px] text-[var(--st-text)]">
                                    {format(new Date(h.createdAt), 'PPpp')}
                                </ZoruTableCell>
                                <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                                    {h.rowCount.toLocaleString()}
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))}
                    </ZoruTableBody>
                </Table>
            )}
        </Card>
    );
}

function ExportHistorySkeleton() {
    return (
        <Card className="overflow-hidden p-4">
            <div className="space-y-3">
                <div className="h-4 w-1/4 rounded bg-[var(--st-border)] animate-pulse" />
                <div className="h-4 w-full rounded bg-[var(--st-border)]/50 animate-pulse" />
                <div className="h-4 w-full rounded bg-[var(--st-border)]/50 animate-pulse" />
            </div>
        </Card>
    );
}

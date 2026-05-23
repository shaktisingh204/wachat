/**
 * Per-entity Import/Export page — `/dashboard/crm/import-export/[entityKind]`.
 *
 * Wraps `<BulkImportWizard>` for the resolved entity kind plus a CSV
 * export button. Server component shell — the wizard does the heavy
 * lifting on the client.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { ImportExportClient } from './_components/import-export-client';
import { SUPPORTED_ENTITY_KINDS } from '@/lib/bulk-import/registry';
import { getExportHistory } from './_components/export-history.actions';
import { hasPermissionGroup } from '@/lib/permission-groups/check';
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
} from '@/components/zoruui';

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
    if (!canView) {
        throw new Error('You do not have permission to access Import & Export.');
    }

    const history = await getExportHistory(entityKind);

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
            <h1 className="text-lg font-semibold text-zoru-ink">
                Import / Export — {entityKind}
            </h1>
            <ImportExportClient entityKind={entityKind} />
            
            <div className="mt-6 flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-zoru-ink">Recent Exports</h2>
                <Card className="overflow-hidden">
                    {history.length === 0 ? (
                        <div className="p-4 text-sm text-zoru-ink-muted">No recent exports found.</div>
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
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink">{h.createdAt.toLocaleString()}</ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">{h.rowCount.toLocaleString()}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))}
                            </ZoruTableBody>
                        </Table>
                    )}
                </Card>
            </div>
        </div>
    );
}

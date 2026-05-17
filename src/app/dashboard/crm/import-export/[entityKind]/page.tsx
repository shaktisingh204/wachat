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
        notFound();
    }

    return (
        <div className="flex w-full flex-col gap-4">
            <Link
                href="/dashboard/crm/import-export"
                className="inline-flex w-fit items-center gap-1 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> All entities
            </Link>
            <h1 className="text-lg font-semibold text-zoru-ink">
                Import / Export — {entityKind}
            </h1>
            <ImportExportClient entityKind={entityKind} />
        </div>
    );
}

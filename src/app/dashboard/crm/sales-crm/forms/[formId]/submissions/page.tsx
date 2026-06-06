import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
    getCrmFormById,
    getFormSubmissions,
    type FormSubmissionStatusFilter,
} from '@/app/actions/crm-forms.actions';
import { SubmissionsFilters } from './_components/submissions-filters';
import { SubmissionsTable } from './_components/submissions-table';
import { ExportButton } from './_components/export-button';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ formId: string }>;
    searchParams: Promise<{
        page?: string;
        q?: string;
        status?: string;
        from?: string;
        to?: string;
    }>;
}

function parseStatus(raw?: string): FormSubmissionStatusFilter {
    switch (raw) {
        case 'new':
        case 'processed':
        case 'spam':
        case 'archived':
            return raw;
        default:
            return 'all';
    }
}

export default async function FormSubmissionsPage({ params, searchParams }: PageProps) {
    const [{ formId }, sp] = await Promise.all([params, searchParams]);

    const page = Math.max(1, Number(sp.page) || 1);
    const q = (sp.q ?? '').trim();
    const status = parseStatus(sp.status);
    const from = sp.from ?? '';
    const to = sp.to ?? '';
    const limit = 100;

    const [form, listing] = await Promise.all([
        getCrmFormById(formId),
        getFormSubmissions({ formId, page, limit, q, status, from, to }),
    ]);

    if (!form) notFound();

    const fieldOrder: Array<{ name: string; label?: string }> = Array.isArray(form.fields)
        ? form.fields
              .map((f: any) => ({
                  name: typeof f?.name === 'string' ? f.name : typeof f?.id === 'string' ? f.id : '',
                  label: typeof f?.label === 'string' ? f.label : undefined,
              }))
              .filter((f) => f.name)
        : [];

    return (
        <EntityListShell
            title={`${form.name} — Submissions`}
            subtitle={`${listing.total} response${listing.total === 1 ? '' : 's'} captured.`}
            primaryAction={
                <div className="flex items-center gap-2">
                    <Button variant="ghost" asChild>
                        <Link href="/dashboard/crm/sales-crm/forms">
                            <ArrowLeft className="h-4 w-4" /> All forms
                        </Link>
                    </Button>
                    <ExportButton
                        formId={formId}
                        filters={{ q, status, from, to }}
                    />
                </div>
            }
            filters={
                <SubmissionsFilters
                    initialQuery={q}
                    initialStatus={status}
                    initialFrom={from}
                    initialTo={to}
                />
            }
        >
            <SubmissionsTable
                formId={formId}
                submissions={listing.items}
                fieldOrder={fieldOrder}
                page={listing.page}
                limit={limit}
                hasMore={listing.hasMore}
                total={listing.total}
            />
        </EntityListShell>
    );
}

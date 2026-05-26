/**
 * SabBigin contact detail — read-only summary card. Edits delegate to the
 * full CRM contact detail page so we don't duplicate the rich form.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';

import { Button, Card } from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { getCrmContactById } from '@/app/actions/crm.actions';

import { SabbiginNav } from '../../_components/sabbigin-shell';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ contactId: string }>;
}

export default async function SabbiginContactDetailPage({ params }: PageProps) {
    const { contactId } = await params;
    const contact = await getCrmContactById(contactId);
    if (!contact) notFound();

    return (
        <EntityListShell
            title={contact.name ?? 'Contact'}
            primaryAction={
                <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/crm/sales-crm/contacts/${contactId}`}>
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Edit in full CRM
                    </Link>
                </Button>
            }
        >
            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/contacts" />
                <Button asChild variant="ghost" size="sm" className="self-start">
                    <Link href="/dashboard/sabbigin/contacts">
                        <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                        Back to contacts
                    </Link>
                </Button>
                <Card className="p-5">
                    <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <Field label="Email" value={contact.email} />
                        <Field label="Phone" value={contact.phone} />
                        <Field label="Company" value={contact.company} />
                        <Field label="Job title" value={contact.jobTitle} />
                        <Field label="Status" value={String(contact.status ?? '')} />
                        <Field label="Source" value={contact.leadSource ?? contact.source} />
                    </dl>
                </Card>
            </div>
        </EntityListShell>
    );
}

function Field({ label, value }: { label: string; value?: string | null }) {
    return (
        <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-subtle">{label}</dt>
            <dd className="mt-1 text-sm text-zoru-ink">{value && value.length > 0 ? value : '—'}</dd>
        </div>
    );
}

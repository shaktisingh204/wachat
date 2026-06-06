/**
 * SabBigin contact detail, a read-only summary card. Edits delegate to the
 * full CRM contact detail page so we do not duplicate the rich form.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    CardHeader,
    CardTitle,
    CardBody,
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageActions,
} from '@/components/sabcrm/20ui';
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

    const statusValue = String(contact.status ?? '').trim();
    const sourceValue = contact.leadSource ?? contact.source;

    return (
        <div className="flex w-full flex-col gap-4">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin contact</PageEyebrow>
                    <PageTitle>{contact.name ?? 'Contact'}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link href={`/dashboard/crm/sales-crm/contacts/${contactId}`}>
                        <Button variant="outline" size="sm" iconLeft={Pencil}>
                            Edit in full CRM
                        </Button>
                    </Link>
                </PageActions>
            </PageHeader>

            <div className="flex flex-col gap-4">
                <SabbiginNav active="/dashboard/sabbigin/contacts" />
                <Link href="/dashboard/sabbigin/contacts" className="self-start">
                    <Button variant="ghost" size="sm" iconLeft={ArrowLeft}>
                        Back to contacts
                    </Button>
                </Link>
                <Card>
                    <CardHeader>
                        <CardTitle>Details</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                            <Field label="Email" value={contact.email} />
                            <Field label="Phone" value={contact.phone} />
                            <Field label="Company" value={contact.company} />
                            <Field label="Job title" value={contact.jobTitle} />
                            <Field
                                label="Status"
                                value={
                                    statusValue.length > 0 ? (
                                        <Badge tone="neutral">{statusValue}</Badge>
                                    ) : null
                                }
                            />
                            <Field label="Source" value={sourceValue} />
                        </dl>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}

function Field({ label, value }: { label: string; value?: ReactNode }) {
    const isEmpty =
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.length === 0);
    return (
        <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
                {label}
            </dt>
            <dd className="mt-1 text-sm text-[var(--st-text)]">
                {isEmpty ? <span className="text-[var(--st-text-tertiary)]">Not set</span> : value}
            </dd>
        </div>
    );
}

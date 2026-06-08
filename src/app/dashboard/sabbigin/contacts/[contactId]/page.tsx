/**
 * SabBigin contact detail, a read-only summary card. Edits delegate to the
 * full CRM contact detail page so we do not duplicate the rich form.
 */

import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
    ArrowLeft,
    Briefcase,
    Building2,
    Mail,
    Pencil,
    Phone,
    Radar,
    Tag,
} from 'lucide-react';

import {
    Avatar,
    Badge,
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

    const name = contact.name ?? 'Contact';
    const statusValue = String(contact.status ?? '').trim();
    const sourceValue = contact.leadSource ?? contact.source;

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin contact</PageEyebrow>
                    <PageTitle>{name}</PageTitle>
                </PageHeaderHeading>
                <PageActions>
                    <Link
                        href="/dashboard/sabbigin/contacts"
                        className="u-btn u-btn--ghost u-btn--sm"
                    >
                        <ArrowLeft size={13} aria-hidden="true" />
                        <span className="u-btn__label">Back</span>
                    </Link>
                    <Link
                        href={`/dashboard/crm/sales-crm/contacts/${contactId}`}
                        className="u-btn u-btn--primary u-btn--sm"
                    >
                        <Pencil size={13} aria-hidden="true" />
                        <span className="u-btn__label">Edit in full CRM</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <SabbiginNav active="/dashboard/sabbigin/contacts" />

            <Card padding="none" className="max-w-3xl">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Avatar name={name} size="md" shape="round" />
                        <div className="min-w-0">
                            <CardTitle>{name}</CardTitle>
                            {contact.company ? (
                                <p className="truncate text-xs text-[var(--st-text-secondary)]">
                                    {contact.company}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    {statusValue.length > 0 ? (
                        <Badge tone="neutral" kind="soft">
                            {statusValue}
                        </Badge>
                    ) : null}
                </CardHeader>
                <CardBody className="pt-0">
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                        <DetailField icon={Mail} label="Email" value={contact.email} />
                        <DetailField icon={Phone} label="Phone" value={contact.phone} />
                        <DetailField icon={Building2} label="Company" value={contact.company} />
                        <DetailField icon={Briefcase} label="Job title" value={contact.jobTitle} />
                        <DetailField icon={Tag} label="Status" value={statusValue || undefined} />
                        <DetailField icon={Radar} label="Source" value={sourceValue} />
                    </dl>
                </CardBody>
            </Card>
        </div>
    );
}

function DetailField({
    icon: Icon,
    label,
    value,
}: {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    label: string;
    value?: ReactNode;
}) {
    const isEmpty =
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.length === 0);
    return (
        <div>
            <dt className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {label}
            </dt>
            <dd className="mt-1 text-sm text-[var(--st-text)]">
                {isEmpty ? (
                    <span className="text-[var(--st-text-tertiary)]">Not set</span>
                ) : (
                    value
                )}
            </dd>
        </div>
    );
}

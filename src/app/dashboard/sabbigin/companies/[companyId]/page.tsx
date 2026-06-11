/**
 * SabBigin company detail — server shell.
 *
 * Loads the account + its related counts, then hands a serialised, plain
 * object to the client component which owns inline editing (via
 * `updateCrmAccount`) and the Overview / Contacts / Deals / Files tabs.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';
import {
    getCrmAccountById,
    getAccountRelatedCounts,
} from '@/app/actions/crm-accounts.actions';

import { CompanyDetailClient, type CompanyDetail } from './_components/company-detail-client';

export const dynamic = 'force-dynamic';

const COMPANIES_HREF = '/dashboard/sabbigin/companies';

interface PageProps {
    params: Promise<{ companyId: string }>;
}

export default async function SabbiginCompanyDetailPage({ params }: PageProps) {
    const { companyId } = await params;

    const account = await getCrmAccountById(companyId);
    if (!account) notFound();

    const counts = await getAccountRelatedCounts(companyId);

    const detail: CompanyDetail = {
        _id: String(account._id),
        name: account.name ?? '',
        industry: account.industry ?? '',
        website: account.website ?? '',
        phone: account.phone ?? '',
        address: account.address ?? '',
        city: account.city ?? '',
        country: account.country ?? '',
        gstin: account.gstin ?? '',
        pan: account.pan ?? '',
        annualRevenue: account.annualRevenue ?? null,
        employeeCount: account.employeeCount ?? null,
        currency: account.currency ?? 'INR',
        category: account.category ?? '',
        logoUrl: account.logoUrl ?? '',
        attachments: Array.isArray(account.attachments) ? account.attachments : [],
        status: account.status ?? 'active',
    };

    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin · Company</PageEyebrow>
                    <PageTitle>{detail.name || 'Company'}</PageTitle>
                    <PageDescription>
                        {detail.industry || 'No industry set'}
                        {detail.city ? ` · ${detail.city}` : ''}
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href={COMPANIES_HREF} className="u-btn u-btn--secondary u-btn--sm">
                        <ArrowLeft size={13} aria-hidden="true" />
                        <span className="u-btn__label">Back to companies</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <CompanyDetailClient initial={detail} counts={counts} />
        </div>
    );
}

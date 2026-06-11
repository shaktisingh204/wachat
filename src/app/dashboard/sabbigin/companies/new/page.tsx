/**
 * SabBigin company create — server shell.
 *
 * Renders the page header + the client form island. The form posts through
 * the existing `addCrmAccount` server action (useActionState-shaped), so we
 * get the exact same validation + RBAC + webhook fan-out the full CRM uses.
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import {
    PageHeader,
    PageHeaderHeading,
    PageEyebrow,
    PageTitle,
    PageDescription,
    PageActions,
} from '@/components/sabcrm/20ui';

import { CompanyForm } from './_components/company-form';

export const dynamic = 'force-dynamic';

const COMPANIES_HREF = '/dashboard/sabbigin/companies';

export default function SabbiginNewCompanyPage() {
    return (
        <div className="20ui flex w-full flex-col gap-5">
            <PageHeader>
                <PageHeaderHeading>
                    <PageEyebrow>SabBigin</PageEyebrow>
                    <PageTitle>New company</PageTitle>
                    <PageDescription>
                        Add a company to your account book. Only the essentials —
                        you can fill in the rest later.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href={COMPANIES_HREF} className="u-btn u-btn--secondary u-btn--sm">
                        <ArrowLeft size={13} aria-hidden="true" />
                        <span className="u-btn__label">Back to companies</span>
                    </Link>
                </PageActions>
            </PageHeader>

            <CompanyForm />
        </div>
    );
}

/**
 * `/dashboard/crm/accounts/[accountId]/edit` (§1D.3).
 *
 * Server shell — hydrates the existing account via the dual-impl
 * `getCrmAccountById` action, then renders the shared `<AccountForm>`
 * with `mode="edit"`. The form posts to `updateCrmAccount`.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2 } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { AccountForm } from '../../_components/accounts-form';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ accountId: string }>;
}

export default async function EditAccountPage({ params }: PageProps) {
    const { accountId } = await params;
    const account = await getCrmAccountById(accountId);
    if (!account) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <div>
                <Link
                    href={`/dashboard/crm/accounts/${accountId}`}
                    className="inline-flex items-center gap-1.5 text-[12.5px] text-zoru-ink-muted hover:text-zoru-ink"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to account
                </Link>
            </div>

            <CrmPageHeader
                title="Edit account"
                subtitle={`Update ${account.name}.`}
                icon={Building2}
            />

            <AccountForm mode="edit" initial={account} />
        </div>
    );
}

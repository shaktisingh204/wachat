/**
 * `/dashboard/crm/accounts/[accountId]/edit` (§1D.3).
 *
 * Server shell — hydrates the existing account via the dual-impl
 * `getCrmAccountById` action, then renders the shared `<AccountForm>`
 * with `mode="edit"`. The form posts to `updateCrmAccount`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { AccountForm } from '../../_components/accounts-form';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import { AccountIntelligence } from './_components/account-intelligence';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ accountId: string }>;
}

export default async function EditAccountPage({ params }: PageProps) {
    const { accountId } = await params;
    const account = await getCrmAccountById(accountId);
    
    if (!account) {
        notFound();
    }

    return (
        <EntityDetailShell
            eyebrow="ACCOUNT"
            title={`Edit · ${account.name}`}
            back={{ href: `/dashboard/crm/accounts/${accountId}`, label: 'Back to account' }}
            rightRail={<AccountIntelligence />}
        >
            <AccountForm mode="edit" initial={account} />
        </EntityDetailShell>
    );
}

/**
 * Account activity (audit log) — server route.
 *
 * Linked from the account detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'account'`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';

interface PageProps {
    params: Promise<{ accountId: string }>;
}

export default async function AccountActivityPage({ params }: PageProps) {
    const { accountId } = await params;
    const account = await getCrmAccountById(accountId);
    if (!account) notFound();

    return (
        <div className="space-y-6">
            <CrmPageHeader
                title={`${account.name} — Activity`}
                subtitle="Audit trail of changes made to this account."
            />
            <EntityDetailShell
                title={account.name}
                eyebrow="ACCOUNT ACTIVITY"
                back={{
                    href: `/dashboard/crm/accounts/${accountId}`,
                    label: 'Back to account',
                }}
            >
                <EntityAuditTimeline entityKind="account" entityId={accountId} />
            </EntityDetailShell>
        </div>
    );
}

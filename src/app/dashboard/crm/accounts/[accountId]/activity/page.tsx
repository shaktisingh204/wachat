/**
 * Account activity (audit log) — server route.
 *
 * Linked from the account detail page. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'account'`.
 */

import { notFound } from 'next/navigation';

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
        <EntityDetailShell
            eyebrow="ACCOUNT ACTIVITY"
            title={`${account.name} — Activity`}
            back={{
                href: `/dashboard/crm/accounts/${accountId}`,
                label: 'Back to account',
            }}
        >
            <EntityAuditTimeline entityKind="account" entityId={accountId} />
        </EntityDetailShell>
    );
}

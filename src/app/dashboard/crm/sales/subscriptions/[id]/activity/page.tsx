/**
 * Subscription activity (audit log) — server route.
 *
 * Mirrors `accounts/[accountId]/activity/page.tsx`. Renders the shared
 * <EntityAuditTimeline> for `entityKind: 'subscription'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getSubscriptionById } from '@/app/actions/crm-subscriptions.actions';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function SubscriptionActivityPage({ params }: PageProps) {
    const { id } = await params;
    const subscription = await getSubscriptionById(id);
    if (!subscription) notFound();

    const title =
        ((subscription as any).planName as string) ||
        `Subscription ${id.slice(-6)}`;

    return (
        <EntityDetailShell
            title={title}
            eyebrow="SUBSCRIPTION ACTIVITY"
            back={{
                href: `/dashboard/crm/sales/subscriptions/${id}`,
                label: 'Back to subscription',
            }}
        >
            <EntityAuditTimeline entityKind="subscription" entityId={id} />
        </EntityDetailShell>
    );
}

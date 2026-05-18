/**
 * Contact activity (audit log) — server route.
 *
 * Mirrors the accounts/[accountId]/activity pattern. Renders the
 * shared <EntityAuditTimeline> for `entityKind: 'contact'`.
 */

import { notFound } from 'next/navigation';

import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';
import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getCrmContactById } from '@/app/actions/crm.actions';

export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ contactId: string }>;
}

export default async function ContactActivityPage({ params }: PageProps) {
    const { contactId } = await params;
    const contact = await getCrmContactById(contactId);
    if (!contact) notFound();

    return (
        <EntityDetailShell
            title={contact.name || contact.email || 'Contact'}
            eyebrow="CONTACT ACTIVITY"
            back={{
                href: `/dashboard/crm/sales-crm/contacts/${contactId}`,
                label: 'Back to contact',
            }}
        >
            <EntityAuditTimeline
                entityKind="contact"
                entityId={contactId}
            />
        </EntityDetailShell>
    );
}

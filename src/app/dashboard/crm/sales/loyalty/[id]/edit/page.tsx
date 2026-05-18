/**
 * Edit loyalty program — `/dashboard/crm/sales/loyalty/[id]/edit`.
 *
 * Server component: fetches the program and passes it to the client
 * form, which submits `updateLoyaltyProgram`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { getLoyaltyProgramById } from '@/app/actions/crm-loyalty.actions';
import { EditLoyaltyForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditLoyaltyProgramPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const result = await getLoyaltyProgramById(id);
    if (!result) notFound();
    const program: Record<string, any> = result!;

    return (
        <EntityDetailShell
            eyebrow="LOYALTY PROGRAM"
            title={`Edit ${program.name ?? 'loyalty program'}`}
            back={{ href: '/dashboard/crm/sales/loyalty', label: 'Loyalty' }}
        >
            <EditLoyaltyForm loyaltyId={id} initial={program} />
        </EntityDetailShell>
    );
}

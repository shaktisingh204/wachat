/**
 * Edit loyalty program — `/dashboard/crm/sales/loyalty/[id]/edit`.
 *
 * Server component: fetches the program and passes it to the client
 * form, which submits `updateLoyaltyProgram`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit ${program.name ?? 'loyalty program'}`}
                subtitle="Update earn/redemption rules and lifecycle settings."
            />
            <EditLoyaltyForm loyaltyId={id} initial={program} />
        </div>
    );
}

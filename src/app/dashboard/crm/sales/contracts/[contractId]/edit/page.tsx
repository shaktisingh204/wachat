/**
 * Edit contract — `/dashboard/crm/sales/contracts/[contractId]/edit`.
 *
 * Server component: fetches the contract via `getContractById` and
 * passes data to a client form that submits `updateContract`. The form
 * mirrors the field set of `/contracts/new`.
 */

import { notFound } from 'next/navigation';

import { CrmPageHeader } from '../../../../_components/crm-page-header';
import { getContractById } from '@/app/actions/crm-contracts.actions';
import { EditContractForm } from './edit-form';

export const dynamic = 'force-dynamic';

export default async function EditContractPage({
    params,
}: {
    params: Promise<{ contractId: string }>;
}) {
    const { contractId } = await params;
    const contract = await getContractById(contractId);
    if (!contract) notFound();

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title={`Edit ${(contract as any).title ?? 'contract'}`}
                subtitle="Update contract terms, parties, and lifecycle."
            />
            <EditContractForm contractId={contractId} initial={contract as any} />
        </div>
    );
}

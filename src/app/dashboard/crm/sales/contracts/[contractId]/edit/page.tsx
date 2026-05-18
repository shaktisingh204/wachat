/**
 * Edit contract — `/dashboard/crm/sales/contracts/[contractId]/edit`.
 *
 * Server component: fetches the contract via `getContractById` and
 * passes data to a client form that submits `updateContract`. The form
 * mirrors the field set of `/contracts/new`.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
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
        <EntityDetailShell
            eyebrow="CONTRACT"
            title={`Edit ${(contract as any).title ?? 'contract'}`}
            back={{ href: `/dashboard/crm/sales/contracts/${contractId}`, label: 'Contract' }}
        >
            <EditContractForm contractId={contractId} initial={contract as any} />
        </EntityDetailShell>
    );
}

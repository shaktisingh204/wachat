/**
 * Edit Contract — server wrapper that fetches by id and hands the doc
 * to the client form. Mirrors the contracts list dialog's FormData
 * contract so the same `saveContract` action accepts it.
 */

import { notFound } from 'next/navigation';

import { getContractById } from '@/app/actions/crm-services.actions';
import type { HrContract } from '@/lib/hr-types';
import { EditContractForm } from './edit-contract-form';

interface PageProps {
  params: Promise<{ contractId: string }>;
}

type ContractDoc = HrContract & {
  _id: string;
  attachments?: string[];
  attachmentNames?: string[];
  signers?: Array<{
    name?: string;
    email?: string;
    role?: string;
    order?: number;
  }>;
  notes?: string;
  autoRenew?: boolean;
  renewalNoticeDays?: number;
};

function toDateString(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && value.length > 0) return value.slice(0, 10);
  return '';
}

export default async function EditContractPage({ params }: PageProps) {
  const { contractId } = await params;
  const contract = (await getContractById(contractId)) as ContractDoc | null;
  if (!contract) notFound();

  const attachments: Array<{ id: string; name: string }> = Array.isArray(
    contract.attachments,
  )
    ? contract.attachments.map((id, idx) => ({
        id,
        name: contract.attachmentNames?.[idx] ?? `Attachment ${idx + 1}`,
      }))
    : [];

  const signers: Array<{ name: string; email: string; role: string }> =
    Array.isArray(contract.signers)
      ? contract.signers.map((s) => ({
          name: s.name ?? '',
          email: s.email ?? '',
          role: s.role ?? '',
        }))
      : [];

  const initial = {
    _id: contract._id.toString(),
    title: contract.title ?? '',
    status: contract.status ?? 'draft',
    clientId: (contract.clientId as unknown as string) ?? null,
    clientName: contract.clientName ?? '',
    value: contract.value ?? null,
    currency: contract.currency ?? 'INR',
    startDate: toDateString(contract.startDate),
    endDate: toDateString(contract.endDate),
    body: contract.body ?? '',
    notes: contract.notes ?? '',
    autoRenew: Boolean(contract.autoRenew),
    renewalNoticeDays: contract.renewalNoticeDays ?? 30,
    esignProvider: contract.esignProvider ?? 'internal',
    attachments,
    signers,
  };

  return <EditContractForm initial={initial} />;
}

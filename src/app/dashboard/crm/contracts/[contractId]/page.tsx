/**
 * Contract detail — `/dashboard/crm/contracts/[contractId]`.
 *
 * Server component per CRM_REBUILD_PLAN §1D.2. Composes:
 *   - Header: status pill + 10 actions (via <ContractDetailActions>).
 *   - Body: Overview · Parties · Terms & body · Signature audit trail ·
 *     Notes (via <ContractDetailBody>).
 *   - Right rail: LineageRail (chain doc — deal → contract → invoice) ·
 *     Status card · Parties chips · Related stub · Term card.
 *   - Audit footer via `<EntityAuditTimeline>` (through EntityDetailShell).
 *
 * Self-signature flow lives at `/dashboard/crm/contracts/[contractId]/sign`
 * (rendered via the public `/share/[token]` link). This page focuses on
 * the operator view.
 */

import { notFound } from 'next/navigation';

import { EntityDetailShell, type EntityStatusTone } from '@/components/crm/entity-detail-shell';
import { LineageRail } from '@/components/crm/lineage-rail';
import { getContractById } from '@/app/actions/crm-services.actions';
import type { HrContract } from '@/lib/hr-types';
import type { LineageKind, LineageRef } from '@/lib/definitions';

import { ContractDetailActions } from '../_components/contract-detail-actions';
import { ContractDetailBody } from '../_components/contract-detail-body';
import { ContractRelatedRail } from '../_components/contract-related-rail';
import { EntityAuditTimeline } from '@/components/crm/entity-audit-timeline';

export const dynamic = 'force-dynamic';

type ContractDoc = HrContract & {
  _id: string;
  lineage?: LineageRef[];
  notes?: string;
  signers?: Array<{
    name?: string;
    email?: string;
    role?: string;
    order?: number;
    signedAt?: string | Date;
    signatureMethod?: string;
  }>;
  sentAt?: string | Date;
  voidedAt?: string | Date;
  voidReason?: string;
  renewedAt?: string | Date;
  signedAt?: string | Date;
};

function statusTone(status?: string): EntityStatusTone {
  const s = (status || '').toLowerCase();
  if (s === 'signed') return 'green';
  if (s === 'draft') return 'neutral';
  if (s === 'expired' || s === 'terminated') return 'red';
  return 'amber';
}

interface PageProps {
  params: Promise<{ contractId: string }>;
}

export default async function ContractDetailPage({ params }: PageProps) {
  const { contractId } = await params;
  const contract = (await getContractById(contractId)) as ContractDoc | null;
  if (!contract) notFound();

  const status = contract.status || 'draft';
  const clientEmail: string | null =
    contract.signedByEmail ??
    (Array.isArray(contract.signers) ? contract.signers[0]?.email ?? null : null);
  const endDateRaw: unknown = contract.endDate;
  let endDateStr = '';
  if (endDateRaw instanceof Date) {
    endDateStr = endDateRaw.toISOString().slice(0, 10);
  } else if (typeof endDateRaw === 'string' && endDateRaw.length > 0) {
    endDateStr = endDateRaw.slice(0, 10);
  }

  return (
    <EntityDetailShell
      title={contract.title || 'Contract'}
      eyebrow="CONTRACT"
      status={{ label: status, tone: statusTone(status) }}
      back={{ href: '/dashboard/crm/contracts', label: 'Back to contracts' }}
      actions={
        <ContractDetailActions
          contractId={contractId}
          status={status}
          contactEmail={clientEmail}
          endDate={endDateStr}
          pendingSigners={
            Array.isArray(contract.signers)
              ? contract.signers
                  .filter((s) => s?.email && !s?.signedAt)
                  .map((s) => ({
                    email: String(s.email),
                    name: s.name ?? null,
                  }))
              : []
          }
        />
      }
      audit={<EntityAuditTimeline entityKind="contract" entityId={contractId} />}
      rightRail={
        <>
          {Array.isArray(contract.lineage) && contract.lineage.length > 0 ? (
            <LineageRail
              // Contract isn't a LineageKind, so render the rail in the
              // context of the upstream deal (chain: Lead → Deal → … → Invoice).
              current={{
                kind: 'deal' as LineageKind,
                id:
                  contract.lineage.find((r) => r.kind === 'deal')?.id ??
                  contractId,
                no: contract.title,
                status,
              }}
              lineage={contract.lineage as LineageRef[]}
            />
          ) : null}
          <ContractRelatedRail
            contractId={contractId}
            status={status}
            startDate={contract.startDate as unknown as string}
            endDate={contract.endDate as unknown as string}
            clientName={contract.clientName}
            value={contract.value}
            currency={contract.currency}
          />
        </>
      }
    >
      <ContractDetailBody contract={contract} />
    </EntityDetailShell>
  );
}

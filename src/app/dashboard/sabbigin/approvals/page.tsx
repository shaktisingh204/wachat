/**
 * SabBigin · Approvals.
 *
 * Server page that seeds the client inbox with the current pending approvals.
 * Approval routing is a SabBigin differentiator — Bigin has no equivalent.
 */

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
} from '@/components/sabcrm/20ui';

import { ApprovalsInbox } from '@/components/sabbigin/approvals/approvals-inbox';
import { listSabbiginApprovals } from '@/app/actions/sabbigin-approvals.actions';

export const dynamic = 'force-dynamic';

export default async function SabbiginApprovalsPage() {
  const pending = await listSabbiginApprovals('pending');

  return (
    <div className="20ui flex w-full flex-col gap-5">
      <PageHeader>
        <PageHeaderHeading>
          <PageEyebrow>SabBigin · Approvals</PageEyebrow>
          <PageTitle>Approvals inbox</PageTitle>
          <PageDescription>
            Deals trying to enter a gated stage pause here until an approver
            clears them. Approve to release the move, or reject to keep the deal
            where it is.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <ApprovalsInbox initialPending={pending} />
    </div>
  );
}

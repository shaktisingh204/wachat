/**
 * /dashboard/sabflow/invites — workspace invite inbox + outbox.
 *
 * Thin server shell: the SabflowPage frame + Suspense; all data loading and
 * interaction live in ./_components/invites-client.tsx, backed by
 * GET /api/sabflow/workspaces/invites.
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { MailPlus } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';
import { SabflowPage, SABFLOW_CRUMBS } from '../_components/sabflow-page';
import { InvitesClient, InvitesSkeleton } from './_components/invites-client';

export const dynamic = 'force-dynamic';

export default function SabFlowInvitesPage() {
  return (
    <SabflowPage
      breadcrumb={[...SABFLOW_CRUMBS, { label: 'Invites' }]}
      title="Invites"
      description="Workspace invites sent to you, and ones you have sent out."
      actions={
        <Button asChild variant="primary">
          <Link href="/dashboard/sabflow/workspaces">
            <MailPlus aria-hidden="true" />
            Send invite
          </Link>
        </Button>
      }
    >
      <Suspense fallback={<InvitesSkeleton />}>
        <InvitesClient />
      </Suspense>
    </SabflowPage>
  );
}

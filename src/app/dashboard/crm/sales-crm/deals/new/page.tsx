/**
 * New Deal — `/dashboard/crm/sales-crm/deals/new`.
 *
 * Server entry point. Renders the shared <DealForm /> client island; the
 * form itself is responsible for reading `?fromKind=lead&fromId=...` and
 * pre-filling title / amount / source. Per CRM_REBUILD_PLAN §1D.3.
 */

import { Trophy } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { DealForm } from '../_components/deal-form';
import { getSession } from '@/app/actions/user.actions';

export const dynamic = 'force-dynamic';

export default async function NewDealPage() {
  const session = await getSession();
  const userId = session?.user?._id ? String(session.user._id) : null;
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New deal"
        subtitle="Capture a sales opportunity in your pipeline."
        icon={Trophy}
        breadcrumbs={[
          { label: 'CRM', href: '/dashboard/crm' },
          { label: 'Sales CRM', href: '/dashboard/crm/sales-crm' },
          { label: 'Deals', href: '/dashboard/crm/sales-crm/deals' },
          { label: 'New' },
        ]}
      />
      <DealForm currentUserId={userId} />
    </div>
  );
}

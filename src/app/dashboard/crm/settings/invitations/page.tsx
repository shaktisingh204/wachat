import { UserPlus } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { listInvitations } from '@/app/actions/worksuite/chat.actions';
import type { WsUserInvitation } from '@/lib/worksuite/chat-types';
import { InvitationsManager } from './_components/invitations-manager';

export default async function InvitationsPage() {
  const invitations = (await listInvitations()) as (WsUserInvitation & {
    _id: string;
  })[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="User Invitations"
        subtitle="Invite teammates to your workspace."
        icon={UserPlus}
      />
      <InvitationsManager initialInvitations={invitations} />
    </div>
  );
}

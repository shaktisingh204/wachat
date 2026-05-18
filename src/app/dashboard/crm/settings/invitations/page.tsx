import { EntityListShell } from '@/components/crm/entity-list-shell';
import { listInvitations } from '@/app/actions/worksuite/chat.actions';
import type { WsUserInvitation } from '@/lib/worksuite/chat-types';
import { InvitationsManager } from './_components/invitations-manager';

export default async function InvitationsPage() {
  const invitations = (await listInvitations()) as (WsUserInvitation & {
    _id: string;
  })[];

  return (
    <EntityListShell
      title="User Invitations"
      subtitle="Invite teammates to your workspace."
    >
      <InvitationsManager initialInvitations={invitations} />
    </EntityListShell>
  );
}

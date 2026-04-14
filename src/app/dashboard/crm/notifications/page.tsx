import { Bell } from 'lucide-react';

import { CrmPageHeader } from '../_components/crm-page-header';
import { getMyNotifications } from '@/app/actions/worksuite/chat.actions';
import type { WsNotification } from '@/lib/worksuite/chat-types';
import { NotificationsInbox } from './_components/notifications-inbox';

export default async function NotificationsPage() {
  const notifications = (await getMyNotifications()) as (WsNotification & {
    _id: string;
  })[];

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Notifications"
        subtitle="System + teammate notifications addressed to you."
        icon={Bell}
      />
      <NotificationsInbox initialNotifications={notifications} />
    </div>
  );
}

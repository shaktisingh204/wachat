import { Bell } from 'lucide-react';

import {
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from '@/components/zoruui';
import { getMyNotifications } from '@/app/actions/worksuite/chat.actions';
import type { WsNotification } from '@/lib/worksuite/chat-types';
import { NotificationsInbox } from './_components/notifications-inbox';

export default async function NotificationsPage() {
  const notifications = (await getMyNotifications()) as (WsNotification & {
    _id: string;
  })[];

  return (
    <div className="flex w-full flex-col gap-6">
      <ZoruPageHeader>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zoru-surface-2">
            <Bell className="h-5 w-5 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <ZoruPageHeading>
            <ZoruPageTitle>Notifications</ZoruPageTitle>
            <ZoruPageDescription>
              System + teammate notifications addressed to you.
            </ZoruPageDescription>
          </ZoruPageHeading>
        </div>
      </ZoruPageHeader>
      <NotificationsInbox initialNotifications={notifications} />
    </div>
  );
}

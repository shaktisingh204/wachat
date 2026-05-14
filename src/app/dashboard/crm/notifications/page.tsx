import { getMyNotifications } from '@/app/actions/worksuite/chat.actions';
import type { WsNotification } from '@/lib/worksuite/chat-types';
import { NotificationsBrowser } from './_components/notifications-browser';

export default async function NotificationsPage() {
  const notifications = (await getMyNotifications()) as (WsNotification & { _id: string })[];
  return <NotificationsBrowser initialNotifications={notifications} />;
}

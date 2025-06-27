
'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getNotifications, markNotificationAsRead, type NotificationWithProject } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '../ui/skeleton';

export function Notifications() {
  const [notifications, setNotifications] = useState<WithId<NotificationWithProject>[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const fetchNotifs = useCallback(() => {
    startTransition(async () => {
      const fetchedNotifications = await getNotifications();
      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedNotifications.filter(n => !n.isRead).length);
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchNotifs();
  }, [fetchNotifs]);
  
  const handleNotificationClick = async (notification: WithId<NotificationWithProject>) => {
    if (!notification.isRead) {
      startTransition(async () => {
        const result = await markNotificationAsRead(notification._id.toString());
        if (result.success) {
          fetchNotifs(); // Refetch to ensure sync
        } else {
          toast({ title: "Error", description: "Failed to mark notification as read.", variant: "destructive" });
        }
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  if (!isClient) {
    return (
       <Skeleton className="h-9 w-9 rounded-full" />
    );
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchNotifs()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs rounded-full">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">View Notifications</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
            {isPending ? (
            <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
            ) : notifications.length > 0 ? (
            notifications.map(notification => (
                <DropdownMenuItem
                key={notification._id.toString()}
                onSelect={() => handleNotificationClick(notification)}
                className={cn("cursor-pointer items-start gap-3 p-3")}
                >
                <div className={cn("mt-1 h-2 w-2 rounded-full flex-shrink-0", !notification.isRead ? 'bg-primary' : 'bg-transparent')} />
                <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold text-primary">{notification.projectName || 'System Notification'}</p>
                    <p className={cn("whitespace-normal flex-grow text-sm", !notification.isRead && "font-semibold")}>{notification.message}</p>
                    <p className="text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</p>
                </div>
                </DropdownMenuItem>
            ))
            ) : (
            <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
            )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

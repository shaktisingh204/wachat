
'use client';

import React, { useEffect, useState, useTransition, useCallback } from 'react';
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
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '../ui/skeleton';

export function Notifications() {
  const [notifications, setNotifications] = useState<WithId<NotificationWithProject>[]>([]);
  const [groupedNotifications, setGroupedNotifications] = useState<Record<string, WithId<NotificationWithProject>[]>>({});
  const [unreadCount, setUnreadCount] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const humanizeEventType = (eventType: string = "general") => {
    return eventType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
  };

  const fetchNotifs = useCallback(() => {
    startTransition(async () => {
      const fetchedNotifications = await getNotifications();
      setNotifications(fetchedNotifications);
      setUnreadCount(fetchedNotifications.filter(n => !n.isRead).length);

      const grouped = fetchedNotifications.reduce((acc, notif) => {
        const eventType = notif.eventType || 'general';
        if (!acc[eventType]) {
          acc[eventType] = [];
        }
        acc[eventType].push(notif);
        return acc;
      }, {} as Record<string, WithId<NotificationWithProject>[]>);
      setGroupedNotifications(grouped);
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchNotifs();
  }, [fetchNotifs]);

  useEffect(() => {
    if (!isClient) return;

    const interval = setInterval(() => {
        fetchNotifs();
    }, 15000); // Poll for new notifications every 15 seconds

    return () => clearInterval(interval);
  }, [isClient, fetchNotifs]);
  
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
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
            {isPending && notifications.length === 0 ? (
              <div className="p-2">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : notifications.length > 0 ? (
              Object.entries(groupedNotifications).map(([eventType, notifs]) => (
                <React.Fragment key={eventType}>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs uppercase text-muted-foreground px-3 py-2">
                    {humanizeEventType(eventType)}
                  </DropdownMenuLabel>
                  {notifs.map(notification => (
                      <DropdownMenuItem
                        key={notification._id.toString()}
                        onSelect={() => handleNotificationClick(notification)}
                        className={cn("cursor-pointer items-start gap-3 p-3")}
                      >
                        <div className={cn("mt-1.5 h-2 w-2 rounded-full flex-shrink-0", !notification.isRead ? 'bg-primary' : 'bg-transparent')} />
                        <div className="flex flex-col gap-1 w-full">
                            <p className="text-xs font-bold text-primary">{notification.projectName || 'System Notification'}</p>
                            <p className={cn("whitespace-normal flex-grow text-sm", !notification.isRead && "font-semibold")}>{notification.message}</p>
                            <p className="text-xs text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</p>
                        </div>
                      </DropdownMenuItem>
                  ))}
                </React.Fragment>
              ))
            ) : (
            <DropdownMenuItem disabled className="text-center">No new notifications</DropdownMenuItem>
            )}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
            <Link href="/dashboard/notifications" className="justify-center cursor-pointer font-semibold">
                View All Notifications
            </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

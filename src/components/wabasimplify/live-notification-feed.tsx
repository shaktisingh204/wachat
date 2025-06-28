
'use client';

import React, { useEffect, useState, useTransition, useCallback } from 'react';
import { getNotifications, markNotificationAsRead, type NotificationWithProject } from '@/app/actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { BellRing, X } from 'lucide-react';

export function LiveNotificationFeed() {
  const [notifications, setNotifications] = useState<WithId<NotificationWithProject>[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchNotifs = useCallback(() => {
    startTransition(async () => {
      const fetchedNotifications = await getNotifications();
      setNotifications(fetchedNotifications);
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
    }, 10000); // Poll for new notifications every 10 seconds

    return () => clearInterval(interval);
  }, [isClient, fetchNotifs]);
  
  const handleNotificationClick = async (notification: WithId<NotificationWithProject>) => {
    if (!notification.isRead) {
      startTransition(async () => {
        const result = await markNotificationAsRead(notification._id.toString());
        if (result.success) {
          setNotifications(prev => prev.map(n => n._id.toString() === notification._id.toString() ? {...n, isRead: true} : n));
        } else {
          toast({ title: "Error", description: "Failed to mark notification as read.", variant: "destructive" });
        }
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const humanizeEventType = (eventType: string = "general") => {
    return eventType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
  };

  if (!isClient || !isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm p-4 pointer-events-none">
      <Card className="shadow-2xl bg-background/80 backdrop-blur-sm h-full flex flex-col pointer-events-auto">
        <CardHeader className="flex flex-row items-center justify-between p-4">
          <div className="space-y-1">
             <CardTitle className="text-base">Live Notifications</CardTitle>
             <CardDescription className="text-xs">Real-time events from your projects.</CardDescription>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
            <span className="sr-only">Close notifications</span>
          </button>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-2 space-y-2">
              {isPending && notifications.length === 0 ? (
                <div className="h-full flex items-center justify-center p-4 text-sm text-muted-foreground">
                    Loading notifications...
                </div>
              ) : notifications.length > 0 ? (
                notifications.map(notification => (
                  <div
                    key={notification._id.toString()}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "p-3 rounded-md border cursor-pointer transition-colors hover:bg-muted",
                      !notification.isRead ? "bg-primary/10 border-primary/20" : "bg-transparent border-border/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <BellRing className={cn("h-4 w-4 mt-1 flex-shrink-0", !notification.isRead && "text-primary")} />
                      <div className="flex-1 space-y-1">
                        <p className={cn("text-sm", !notification.isRead && "font-semibold")}>
                            {notification.projectName ? `${notification.projectName}: ` : ''}
                            {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {humanizeEventType(notification.eventType)} - {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center p-4 text-sm text-muted-foreground">
                  No recent notifications.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
         <CardFooter className="p-2 border-t">
            <Button asChild variant="link" className="w-full h-8 text-xs text-muted-foreground">
                <Link href="/dashboard/notifications">View All &rarr;</Link>
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


'use client';

import React, { useEffect, useState, useTransition, useCallback } from 'react';
import { getNotifications, getInvitationsForUser, markNotificationAsRead, handleRespondToInvite, type NotificationWithProject, type Invitation } from '@/app/actions';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { BellRing, Mail, Check, X } from 'lucide-react';

export function LiveNotificationFeed() {
  const [notifications, setNotifications] = useState<WithId<NotificationWithProject>[]>([]);
  const [invitations, setInvitations] = useState<WithId<Invitation>[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const [fetchedNotifications, fetchedInvitations] = await Promise.all([
          getNotifications(),
          getInvitationsForUser()
      ]);
      setNotifications(fetchedNotifications);
      setInvitations(fetchedInvitations);
    });
  }, [startTransition]);

  useEffect(() => {
    setIsClient(true);
    fetchData(); // Initial fetch
    
    const interval = setInterval(() => {
        fetchData(); // Polling fetch
    }, 10000); 

    return () => clearInterval(interval);
  }, [fetchData]);
  
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

  const handleInviteResponse = (invitationId: string, accepted: boolean) => {
    startTransition(async () => {
      const result = await handleRespondToInvite(invitationId, accepted);
      if (result.success) {
        toast({ title: "Success", description: `Invitation ${accepted ? 'accepted' : 'declined'}.`});
        fetchData(); // Refresh list
        router.refresh(); // Full refresh to get new project list
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
      }
    });
  };

  const humanizeEventType = (eventType: string = "general") => {
    return eventType
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
  };

  if (!isClient) {
    return null; 
  }
  
  const allItems = [
    ...invitations.map(item => ({ ...item, type: 'invitation' as const })),
    ...notifications.map(item => ({ ...item, type: 'notification' as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <Card className="shadow-none rounded-none border-none bg-transparent h-full flex flex-col">
    <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <div className="space-y-1">
            <CardTitle className="text-base">Live Notifications</CardTitle>
            <CardDescription className="text-xs">Real-time events from your projects.</CardDescription>
        </div>
    </CardHeader>
    <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
        <div className="p-2 space-y-2">
            {isPending && allItems.length === 0 ? (
            <div className="h-full flex items-center justify-center p-4 text-sm text-muted-foreground">
                Loading...
            </div>
            ) : allItems.length > 0 ? (
            allItems.map(item => (
                item.type === 'invitation' ? (
                <div key={item._id.toString()} className="p-3 rounded-md border bg-primary/10 border-primary/20">
                     <div className="flex items-start gap-3">
                        <Mail className="h-4 w-4 mt-1 flex-shrink-0 text-primary" />
                        <div className="flex-1 space-y-2">
                            <p className="text-sm font-semibold">
                                {item.inviterName} invited you to join "{item.projectName}" as a {item.role}.
                            </p>
                             <div className="flex items-center gap-2">
                                <Button size="sm" className="h-7" onClick={() => handleInviteResponse(item._id.toString(), true)}><Check className="h-4 w-4 mr-1"/>Accept</Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => handleInviteResponse(item._id.toString(), false)}><X className="h-4 w-4 mr-1"/>Decline</Button>
                             </div>
                        </div>
                    </div>
                </div>
                ) : (
                <div
                    key={item._id.toString()}
                    onClick={() => handleNotificationClick(item)}
                    className={cn(
                        "p-3 rounded-md border cursor-pointer transition-colors hover:bg-muted",
                        !item.isRead ? "bg-muted/50 border-border" : "bg-transparent border-border/50"
                    )}
                    >
                    <div className="flex items-start gap-3">
                        <BellRing className={cn("h-4 w-4 mt-1 flex-shrink-0", !item.isRead && "text-primary")} />
                        <div className="flex-1 space-y-1">
                        <p className={cn("text-sm", !item.isRead && "font-semibold")}>
                            {item.projectName ? `${item.projectName}: ` : ''}
                            {item.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                            {humanizeEventType(item.eventType)} - {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        </div>
                    </div>
                </div>
                )
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
  );
}

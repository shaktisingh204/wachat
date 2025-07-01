
'use client';

import { useCallback, useEffect, useState, useTransition } from "react";
import { getAllNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '@/app/actions';
import type { NotificationWithProject } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useRouter } from 'next/navigation';

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, Bell, BellRing, Eye, LoaderCircle, RefreshCw, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const NOTIFICATIONS_PER_PAGE = 20;

const eventTypes = [
    { value: 'messages', label: 'Messages' },
    { value: 'message_template_status_update', label: 'Template Status' },
    { value: 'phone_number_quality_update', label: 'Phone Quality' },
    { value: 'account_review_update', label: 'Account Review' },
    { value: 'account_update', label: 'Account Updates' },
];

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<WithId<NotificationWithProject>[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, startRefreshTransition] = useTransition();
    const [isMarkingRead, startMarkingReadTransition] = useTransition();
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [filter, setFilter] = useState('');
    const { toast } = useToast();
    const router = useRouter();

    const fetchNotifications = useCallback(async (page: number, currentFilter: string, showToast = false) => {
        startRefreshTransition(async () => {
            try {
                const { notifications: newNotifications, total } = await getAllNotifications(page, NOTIFICATIONS_PER_PAGE, currentFilter);
                setNotifications(newNotifications);
                setTotalPages(Math.ceil(total / NOTIFICATIONS_PER_PAGE));
                if (showToast) {
                    toast({ title: "Refreshed", description: "Notifications have been updated." });
                }
            } catch (error) {
                toast({ title: "Error", description: "Failed to fetch notifications.", variant: "destructive" });
            }
        });
    }, [toast]);

    useEffect(() => {
        document.title = 'All Notifications | Wachat';
        setLoading(true);
        fetchNotifications(currentPage, filter).finally(() => setLoading(false));
    }, [currentPage, filter, fetchNotifications]);
    
    const handleFilterChange = (newFilter: string) => {
        setFilter(newFilter === 'ALL' ? '' : newFilter);
        setCurrentPage(1);
    };

    const handleNotificationClick = async (notification: WithId<NotificationWithProject>) => {
        if (!notification.isRead) {
          startRefreshTransition(async () => {
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

    const handleMarkAllRead = () => {
        startMarkingReadTransition(async () => {
            const result = await markAllNotificationsAsRead();
            if (result.success) {
                toast({
                    title: "Success",
                    description: result.updatedCount > 0 
                        ? `${result.updatedCount} notification(s) marked as read.`
                        : 'No new notifications to mark as read.'
                });
                if (result.updatedCount > 0) {
                    fetchNotifications(1, filter);
                    setCurrentPage(1);
                }
            } else {
                toast({
                    title: "Error",
                    description: "Failed to mark all notifications as read.",
                    variant: "destructive"
                });
            }
        });
    };

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">All Notifications</h1>
                    <p className="text-muted-foreground">A complete history of all automated events and alerts.</p>
                </div>
                 <div className="flex flex-wrap items-center gap-2">
                    <Select onValueChange={handleFilterChange} defaultValue="ALL">
                        <SelectTrigger className="w-full sm:w-auto min-w-[180px] gap-2">
                            <Filter className="h-4 w-4" />
                            <SelectValue placeholder="Filter by event type..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Events</SelectItem>
                            {eventTypes.map(et => <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleMarkAllRead} disabled={isRefreshing || isMarkingRead} variant="outline" size="sm">
                        {isMarkingRead ? (
                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <BadgeCheck className="mr-2 h-4 w-4" />
                        )}
                        Mark all as read
                    </Button>
                    <Button onClick={() => fetchNotifications(currentPage, filter, true)} disabled={isRefreshing || isMarkingRead} variant="outline" size="sm">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="p-4">
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            ))
                        ) : notifications.length > 0 ? (
                            notifications.map((notification) => (
                                <div key={notification._id.toString()}
                                    className={cn("flex items-start gap-4 p-4", !notification.isRead && "bg-muted/50")}
                                >
                                    <div className="mt-1">
                                        {notification.isRead ? <Bell className="h-5 w-5 text-muted-foreground" /> : <BellRing className="h-5 w-5 text-primary" />}
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium leading-none">
                                                {notification.projectName ? `Project: ${notification.projectName}` : 'System Notification'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(notification.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                                        <Badge variant="outline" className="font-mono text-xs">{humanizeEventType(notification.eventType)}</Badge>
                                    </div>
                                    <Button variant="outline" size="sm" onClick={() => handleNotificationClick(notification)}>
                                        <Eye className="mr-2 h-4 w-4" /> View
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="h-24 text-center flex items-center justify-center text-muted-foreground">
                                No notifications found {filter ? `for type "${filter}"` : ''}.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <div className="flex items-center justify-end space-x-2">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p - 1)}
                        disabled={currentPage <= 1 || isRefreshing}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage >= totalPages || isRefreshing}
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect, useTransition } from 'react';
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Bell, Check, Loader2, MessageSquare, Briefcase, Globe, Cpu, Info } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getAllNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/notification.actions';
import type { NotificationWithProject } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import Link from 'next/link';

interface NotificationPopoverProps {
    className?: string;
}

export function NotificationPopover({ className }: NotificationPopoverProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("all");
    const [notifications, setNotifications] = useState<WithId<NotificationWithProject>[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const { notifications: data } = await getAllNotifications(1, 100); // Fetch more to filter client-side for now
            setNotifications(data);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchNotifications();
        }
    }, [open]);

    const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await markNotificationAsRead(id);
            setNotifications(prev => prev.map(n => n._id.toString() === id ? { ...n, isRead: true } : n));
        } catch (error) {
            toast({ title: "Error", description: "Failed to mark as read", variant: "destructive" });
        }
    };

    const handleMarkAllRead = async () => {
        startTransition(async () => {
            try {
                await markAllNotificationsAsRead();
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                toast({ title: "Success", description: "All notifications marked as read" });
            } catch (error) {
                toast({ title: "Error", description: "Failed to mark all as read", variant: "destructive" });
            }
        });
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const getFilteredNotifications = (tab: string) => {
        if (tab === 'all') return notifications;
        if (tab === 'system') return notifications.filter(n => !n.sourceApp || n.sourceApp === 'system');
        return notifications.filter(n => n.sourceApp === tab);
    };

    const categories = [
        { id: 'all', label: 'All', icon: Bell },
        { id: 'wachat', label: 'WaChat', icon: MessageSquare },
        { id: 'crm', label: 'CRM', icon: Briefcase },
        { id: 'ad-manager', label: 'Ads', icon: Globe },
        { id: 'sabchat', label: 'SabChat', icon: Cpu },
        { id: 'system', label: 'System', icon: Info },
    ];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className={cn("relative h-10 w-10 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground", className)}>
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600 ring-2 ring-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="start" side="right" sideOffset={20}>
                <div className="flex items-center justify-between p-4 border-b">
                    <h4 className="font-semibold">Notifications</h4>
                    {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={isPending} className="text-xs h-6 px-2 py-0">
                            {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                            Mark all read
                        </Button>
                    )}
                </div>

                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <ScrollArea className="max-w-full border-b bg-muted/30">
                        <TabsList className="w-full justify-start rounded-none h-12 bg-transparent p-0 px-2 overflow-x-auto">
                            {categories.map(cat => (
                                <TabsTrigger
                                    key={cat.id}
                                    value={cat.id}
                                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 pb-2 pt-3 text-xs"
                                >
                                    <cat.icon className="h-3.5 w-3.5 mr-1.5 opacity-70" />
                                    {cat.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </ScrollArea>

                    <TabsContent value={activeTab} className="m-0 focus-visible:ring-0 focus-visible:outline-none">
                        <ScrollArea className="h-[400px]">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <p className="text-sm">Loading updates...</p>
                                </div>
                            ) : getFilteredNotifications(activeTab).length > 0 ? (
                                <div className="divide-y">
                                    {getFilteredNotifications(activeTab).map((notification) => (
                                        <div
                                            key={notification._id.toString()}
                                            className={cn(
                                                "p-4 hover:bg-muted/50 transition-colors cursor-pointer group relative",
                                                !notification.isRead ? "bg-muted/30" : ""
                                            )}
                                            onClick={() => {
                                                if (!notification.isRead) handleMarkAsRead(notification._id.toString(), { stopPropagation: () => { } } as any);
                                                if (notification.link) {
                                                    setOpen(false);
                                                    router.push(notification.link);
                                                }
                                            }}
                                        >
                                            <div className="flex gap-3">
                                                <div className={cn(
                                                    "mt-1 h-2 w-2 rounded-full shrink-0",
                                                    !notification.isRead ? "bg-blue-600" : "bg-transparent"
                                                )} />
                                                <div className="space-y-1 flex-1">
                                                    <p className={cn("text-sm leading-snug", !notification.isRead && "font-medium")}>
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                        <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                                                        <span>•</span>
                                                        <span className="capitalize">{notification.sourceApp || 'System'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {!notification.isRead && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => handleMarkAsRead(notification._id.toString(), e)}
                                                    title="Mark as read"
                                                >
                                                    <Check className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center p-4">
                                    <Bell className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="text-sm font-medium">No notifications</p>
                                    <p className="text-xs text-muted-foreground/70 mt-1">
                                        You're all caught up!
                                    </p>
                                </div>
                            )}
                        </ScrollArea>
                        <div className="p-2 border-t bg-muted/10 text-center">
                            <Link
                                href="/dashboard/notifications"
                                className="text-xs text-primary hover:underline"
                                onClick={() => setOpen(false)}
                            >
                                View full history
                            </Link>
                        </div>
                    </TabsContent>
                </Tabs>
            </PopoverContent>
        </Popover>
    );
}

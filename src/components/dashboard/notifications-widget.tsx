'use client';

import { useState, useEffect, useTransition, useRef } from 'react';
import * as React from 'react';
import { Button } from "@/components/ui/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Bell, Check, Loader2, Briefcase, Globe, Cpu, Info, Megaphone, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { WhatsAppIcon, MetaIcon } from '@/components/wabasimplify/custom-sidebar-components';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { getAllNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/notification.actions';
import type { NotificationWithProject } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";

export function NotificationsWidget() {
    const [activeTab, setActiveTab] = useState("all");
    const [notifications, setNotifications] = useState<WithId<NotificationWithProject>[]>([]);
    const [loading, setLoading] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const { notifications: data } = await getAllNotifications(1, 100);
            setNotifications(data);
        } catch (error) {
            console.error("Failed to fetch notifications", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

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
        { id: 'wachat', label: 'WaChat', icon: WhatsAppIcon },
        { id: 'facebook', label: 'Meta Suite', icon: MetaIcon },
        { id: 'ad-manager', label: 'Ads', icon: Megaphone },
        { id: 'crm', label: 'CRM', icon: Briefcase },
        { id: 'sabchat', label: 'SabChat', icon: Cpu },
        { id: 'system', label: 'System', icon: Info },
    ];

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 150;
            const newScrollLeft = direction === 'left'
                ? scrollContainerRef.current.scrollLeft - scrollAmount
                : scrollContainerRef.current.scrollLeft + scrollAmount;
            scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
        }
    };

    return (
        <div className="w-full animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Notifications
                    {unreadCount > 0 && (
                        <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                            {unreadCount} New
                        </span>
                    )}
                </h2>
                {unreadCount > 0 && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleMarkAllRead}
                        disabled={isPending}
                        className="text-xs h-8"
                    >
                        {isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                        Mark all as read
                    </Button>
                )}
            </div>

            <Card className="border-border/40 bg-background/60 backdrop-blur-xl shadow-sm overflow-hidden">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="border-b bg-muted/20 relative flex items-center px-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 absolute left-0 z-10 bg-background/50 backdrop-blur-sm rounded-none border-r shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); scroll('left'); }}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        <div
                            ref={scrollContainerRef}
                            className="flex overflow-x-auto no-scrollbar scroll-smooth w-full px-2"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            <TabsList className="w-auto inline-flex justify-start h-12 bg-transparent p-0 gap-4">
                                {categories.map(cat => (
                                    <TabsTrigger
                                        key={cat.id}
                                        value={cat.id}
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 pb-3 pt-3 text-sm whitespace-nowrap flex-shrink-0 gap-2 transition-all hover:text-foreground/80"
                                    >
                                        <cat.icon className="h-4 w-4 opacity-70" />
                                        {cat.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </div>

                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 absolute right-0 z-10 bg-background/50 backdrop-blur-sm rounded-none border-l shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); scroll('right'); }}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <TabsContent value={activeTab} className="m-0 focus-visible:ring-0 focus-visible:outline-none">
                        <ScrollArea className="h-[300px]">
                            {loading && notifications.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <p className="text-sm">Loading updates...</p>
                                </div>
                            ) : getFilteredNotifications(activeTab).length > 0 ? (
                                <div className="divide-y divide-border/40">
                                    {getFilteredNotifications(activeTab).map((notification) => (
                                        <div
                                            key={notification._id.toString()}
                                            className={cn(
                                                "p-4 hover:bg-muted/40 transition-all cursor-pointer group relative flex items-start gap-4",
                                                !notification.isRead ? "bg-primary/5 hover:bg-primary/10" : ""
                                            )}
                                            onClick={() => {
                                                if (!notification.isRead) handleMarkAsRead(notification._id.toString(), { stopPropagation: () => { } } as any);
                                                if (notification.link) {
                                                    router.push(notification.link);
                                                }
                                            }}
                                        >
                                            <div className={cn(
                                                "mt-2 h-2.5 w-2.5 rounded-full shrink-0 shadow-sm",
                                                !notification.isRead ? "bg-primary animate-pulse" : "bg-muted"
                                            )} />

                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={cn("text-sm leading-relaxed truncate pr-8", !notification.isRead ? "font-semibold text-foreground" : "text-muted-foreground")}>
                                                        {notification.message}
                                                    </p>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                                                        {new Date(notification.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded-md border text-[10px] uppercase tracking-wider font-medium",
                                                        "bg-background border-border/50"
                                                    )}>
                                                        {notification.sourceApp || 'System'}
                                                    </span>
                                                    {notification.projectName && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="flex items-center gap-1">
                                                                <Briefcase className="h-3 w-3" />
                                                                {notification.projectName}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {(!notification.isRead || notification.link) && (
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm p-1 rounded-lg border shadow-sm">
                                                    {!notification.isRead && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:text-green-600 hover:bg-green-50"
                                                            onClick={(e) => handleMarkAsRead(notification._id.toString(), e)}
                                                            title="Mark as read"
                                                        >
                                                            <Check className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {notification.link && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 hover:text-primary hover:bg-primary/10"
                                                            title="Go to link"
                                                        >
                                                            <ExternalLink className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-center p-4">
                                    <div className="h-16 w-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
                                        <Bell className="h-8 w-8 opacity-40" />
                                    </div>
                                    <p className="text-base font-medium text-foreground/80">All caught up!</p>
                                    <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                                        You have zero new notifications. We'll verify content here when meaningful events occur.
                                    </p>
                                </div>
                            )}
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </Card>
        </div>
    );
}

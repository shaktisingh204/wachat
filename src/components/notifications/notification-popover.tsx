'use client';

import { useState, useEffect, useTransition } from 'react';
import * as React from 'react';
import {
    Button,
    IconButton,
    Badge,
    EmptyState,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    ScrollArea,
    cn,
} from '@/components/sabcrm/20ui';
import {
    Bell,
    Check,
    CheckCheck,
    Loader2,
    Info,
    Target,
    ChevronLeft,
    ChevronRight,
    MessageCircle,
    Facebook,
    Users,
    MessagesSquare,
    type LucideIcon,
} from 'lucide-react';
import { getAllNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/app/actions/notification.actions';
import type { NotificationWithProject } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface NotificationPopoverProps {
    className?: string;
}

export function NotificationPopover({ className }: NotificationPopoverProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
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
            console.error('Failed to fetch notifications', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial fetch on mount
        fetchNotifications();

        // Poll every 60 seconds
        const interval = setInterval(() => {
            fetchNotifications();
        }, 60000);

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (open) {
            fetchNotifications();
        }
    }, [open]);

    const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        try {
            await markNotificationAsRead(id);
            setNotifications((prev) => prev.map((n) => (n._id.toString() === id ? { ...n, isRead: true } : n)));
        } catch (error) {
            toast({ title: 'Failed to mark as read', tone: 'danger' });
        }
    };

    const handleMarkAllRead = async () => {
        startTransition(async () => {
            try {
                await markAllNotificationsAsRead();
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                toast({ title: 'All notifications marked as read', tone: 'success' });
            } catch (error) {
                toast({ title: 'Failed to mark all as read', tone: 'danger' });
            }
        });
    };

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    const getFilteredNotifications = (tab: string) => {
        if (tab === 'all') return notifications;
        if (tab === 'system') return notifications.filter((n) => !n.sourceApp || n.sourceApp === 'system');
        return notifications.filter((n) => n.sourceApp === tab);
    };

    const categories: { id: string; label: string; icon: LucideIcon }[] = [
        { id: 'all', label: 'All', icon: Bell },
        { id: 'wachat', label: 'WaChat', icon: MessageCircle },
        { id: 'facebook', label: 'Meta Suite', icon: Facebook },
        { id: 'ad-manager', label: 'Ads', icon: Target },
        { id: 'crm', label: 'CRM', icon: Users },
        { id: 'sabchat', label: 'SabChat', icon: MessagesSquare },
        { id: 'system', label: 'System', icon: Info },
    ];

    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 150;
            const newScrollLeft =
                direction === 'left'
                    ? scrollContainerRef.current.scrollLeft - scrollAmount
                    : scrollContainerRef.current.scrollLeft + scrollAmount;

            scrollContainerRef.current.scrollTo({
                left: newScrollLeft,
                behavior: 'smooth',
            });
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <span className={cn('relative inline-flex', className)}>
                    <IconButton
                        label="Notifications"
                        icon={Bell}
                        variant="ghost"
                        className="h-10 w-10 rounded-[var(--st-radius)]"
                    />
                    {unreadCount > 0 && (
                        <span
                            aria-hidden="true"
                            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--st-accent)] ring-2 ring-[var(--st-bg)]"
                        />
                    )}
                </span>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="start" side="right" sideOffset={20}>
                <div className="flex items-center justify-between p-4 border-b border-[var(--st-border)]">
                    <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-[var(--st-text)]">Notifications</h4>
                        {unreadCount > 0 && (
                            <Badge tone="accent" kind="soft">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllRead}
                            disabled={isPending}
                            iconLeft={isPending ? Loader2 : CheckCheck}
                            className={cn(isPending && '[&_svg]:animate-spin')}
                        >
                            Mark all read
                        </Button>
                    )}
                </div>

                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <div className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] relative flex items-center">
                        <IconButton
                            label="Scroll categories left"
                            icon={ChevronLeft}
                            variant="ghost"
                            size="sm"
                            className="absolute left-0 z-10 h-8 w-8 rounded-none border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)] backdrop-blur-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                scroll('left');
                            }}
                        />

                        <div
                            ref={scrollContainerRef}
                            className="flex overflow-x-auto scroll-smooth px-8 w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                        >
                            <TabsList className="w-auto inline-flex justify-start rounded-none h-12 bg-transparent p-0 border-0">
                                {categories.map((cat) => {
                                    const Icon = cat.icon;
                                    return (
                                        <TabsTrigger
                                            key={cat.id}
                                            value={cat.id}
                                            className="rounded-none px-3 pb-2 pt-3 text-xs whitespace-nowrap flex-shrink-0"
                                        >
                                            <span className="inline-flex items-center gap-1.5">
                                                <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                                                {cat.label}
                                            </span>
                                        </TabsTrigger>
                                    );
                                })}
                            </TabsList>
                        </div>

                        <IconButton
                            label="Scroll categories right"
                            icon={ChevronRight}
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 z-10 h-8 w-8 rounded-none border-l border-[var(--st-border)] bg-[var(--st-bg-secondary)] backdrop-blur-sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                scroll('right');
                            }}
                        />
                    </div>

                    <TabsContent value={activeTab} className="m-0 focus-visible:outline-none">
                        <ScrollArea className="h-[400px]">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-48 text-[var(--st-text-secondary)] gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                                    <p className="text-sm">Loading updates...</p>
                                </div>
                            ) : getFilteredNotifications(activeTab).length > 0 ? (
                                <div className="divide-y divide-[var(--st-border)]">
                                    {getFilteredNotifications(activeTab).map((notification) => (
                                        <div
                                            key={notification._id.toString()}
                                            role="button"
                                            tabIndex={0}
                                            className={cn(
                                                'p-4 hover:bg-[var(--st-bg-secondary)] transition-colors cursor-pointer group relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-accent)]',
                                                !notification.isRead ? 'bg-[var(--st-bg-secondary)]' : '',
                                            )}
                                            onClick={() => {
                                                if (!notification.isRead) handleMarkAsRead(notification._id.toString());
                                                if (notification.link) {
                                                    setOpen(false);
                                                    router.push(notification.link);
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    if (!notification.isRead) handleMarkAsRead(notification._id.toString());
                                                    if (notification.link) {
                                                        setOpen(false);
                                                        router.push(notification.link);
                                                    }
                                                }
                                            }}
                                        >
                                            <div className="flex gap-3">
                                                <span
                                                    aria-hidden="true"
                                                    className={cn(
                                                        'mt-1 h-2 w-2 rounded-full shrink-0',
                                                        !notification.isRead ? 'bg-[var(--st-accent)]' : 'bg-transparent',
                                                    )}
                                                />
                                                <div className="space-y-1 flex-1">
                                                    <p
                                                        className={cn(
                                                            'text-sm leading-snug text-[var(--st-text)]',
                                                            !notification.isRead && 'font-medium',
                                                        )}
                                                    >
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                                                        <span>{new Date(notification.createdAt).toLocaleDateString()}</span>
                                                        <span aria-hidden="true">·</span>
                                                        <span className="capitalize">{notification.sourceApp || 'System'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {!notification.isRead && (
                                                <IconButton
                                                    label="Mark as read"
                                                    icon={Check}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={(e) => handleMarkAsRead(notification._id.toString(), e)}
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-48 p-4">
                                    <EmptyState
                                        icon={Bell}
                                        size="sm"
                                        title="No notifications"
                                        description="You're all caught up."
                                    />
                                </div>
                            )}
                        </ScrollArea>
                        <div className="p-2 border-t border-[var(--st-border)] text-center">
                            <Link
                                href="/dashboard/notifications"
                                className="text-xs text-[var(--st-text)] hover:underline"
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

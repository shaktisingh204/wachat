"use client";

/**
 * ZoruNotificationPopover — global header bell.
 *
 * Renders an icon button with an unread count badge. Clicking opens a
 * popover with the recent items, a "Mark all read" action, a category
 * filter (segmented buttons — no tab UI), and a "See all" link to
 * `/dashboard/notifications`.
 *
 * Polls `getAllNotifications` every 60s and refreshes when the popover
 * opens. Designed to mount once at the app shell level so every page
 * inside `ZoruHomeShell` (or `WachatShell`) gets the same surface.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Briefcase,
  Check,
  Cpu,
  Globe,
  Inbox,
  Info,
  Loader2,
  Megaphone,
  MessageSquare,
} from "lucide-react";

import {
  getAllNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/app/actions/notification.actions";
import { getMyMentionNotifications } from "@/app/actions/mentions.actions";
import type { NotificationWithProject } from "@/lib/definitions";
import type { WithId } from "mongodb";

import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Popover, ZoruPopoverContent, ZoruPopoverTrigger } from "./popover";
import { ScrollArea } from "./scroll-area";
import { useZoruToast } from "./use-zoru-toast";
import { cn } from "./lib/cn";

type CategoryId =
  | "all"
  | "wachat"
  | "facebook"
  | "ad-manager"
  | "crm"
  | "sabchat"
  | "system";

const CATEGORIES: Array<{
  id: CategoryId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "all", label: "All", icon: <Bell /> },
  { id: "wachat", label: "WaChat", icon: <MessageSquare /> },
  { id: "facebook", label: "Meta", icon: <Globe /> },
  { id: "ad-manager", label: "Ads", icon: <Megaphone /> },
  { id: "crm", label: "CRM", icon: <Briefcase /> },
  { id: "sabchat", label: "SabChat", icon: <Cpu /> },
  { id: "system", label: "System", icon: <Info /> },
];

export interface ZoruNotificationPopoverProps {
  /** Pixel offset between trigger and popover. Defaults to 8. */
  sideOffset?: number;
  /** Where the popover anchors. Defaults to "end". */
  align?: "start" | "center" | "end";
  /** Override class on the trigger button. */
  triggerClassName?: string;
}

export function ZoruNotificationPopover({
  sideOffset = 8,
  align = "end",
  triggerClassName,
}: ZoruNotificationPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [activeCategory, setActiveCategory] = React.useState<CategoryId>("all");
  const [notifications, setNotifications] = React.useState<
    WithId<NotificationWithProject>[]
  >([]);
  const [loading, setLoading] = React.useState(false);
  const [markingAll, setMarkingAll] = React.useState(false);
  const router = useRouter();
  const { toast } = useZoruToast();

  const fetchNotifications = React.useCallback(async () => {
    setLoading(true);
    try {
      const [{ notifications: data }, mentions] = await Promise.all([
        getAllNotifications(1, 100),
        getMyMentionNotifications(20).catch(() => []),
      ]);
      // Merge in user-scoped @-mention notifications. These don't carry
      // a projectId, so they appear under the CRM category.
      const mentionRows: WithId<NotificationWithProject>[] = mentions.map((m) => ({
        _id: m._id,
        projectId: m._id,
        wabaId: '',
        message: m.message,
        link: m.link,
        isRead: m.isRead,
        createdAt: new Date(m.createdAt),
        eventType: 'mention',
        sourceApp: 'crm',
      } as unknown as WithId<NotificationWithProject>));
      setNotifications([...mentionRows, ...data]);
    } catch (e) {
      console.error("Failed to fetch notifications", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 60s + refresh on open.
  React.useEffect(() => {
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(id);
  }, [fetchNotifications]);

  React.useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filtered = React.useMemo(() => {
    if (activeCategory === "all") return notifications;
    if (activeCategory === "system") {
      return notifications.filter(
        (n) => !n.sourceApp || n.sourceApp === "system",
      );
    }
    return notifications.filter((n) => n.sourceApp === activeCategory);
  }, [notifications, activeCategory]);

  const handleMarkOne = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id.toString() === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark as read",
        variant: "destructive",
      });
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast({ title: "All notifications marked as read" });
    } catch {
      toast({
        title: "Error",
        description: "Failed to mark all as read",
        variant: "destructive",
      });
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ZoruPopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={
            unreadCount > 0
              ? `Notifications, ${unreadCount} unread`
              : "Notifications"
          }
          className={cn("relative", triggerClassName)}
        >
          <Bell />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zoru-danger px-1 text-[9px] text-zoru-danger-foreground ring-2 ring-zoru-bg"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </ZoruPopoverTrigger>
      <ZoruPopoverContent
        align={align}
        sideOffset={sideOffset}
        className="w-[380px] p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zoru-line px-4 py-3">
          <div className="flex flex-col">
            <p className="text-sm text-zoru-ink">Notifications</p>
            <p className="text-[11px] text-zoru-ink-muted">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              disabled={markingAll}
              className="text-xs"
            >
              {markingAll ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Mark all read
            </Button>
          )}
        </div>

        {/* Category filter — segmented buttons, NOT tabs */}
        <div className="border-b border-zoru-line bg-zoru-surface px-2 py-2">
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-[var(--zoru-radius-sm)] px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "bg-zoru-ink text-zoru-on-primary"
                      : "text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink",
                  )}
                >
                  <span className="[&_svg]:size-3.5">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <ScrollArea className="h-[360px]">
          {loading && notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-zoru-ink-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xs">Loading…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6">
              <EmptyState
                icon={<Inbox />}
                title="Nothing here"
                description="No notifications in this category."
                compact
              />
            </div>
          ) : (
            <ul className="divide-y divide-zoru-line">
              {filtered.map((n) => {
                const id = n._id.toString();
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!n.isRead) void handleMarkOne(id);
                        if (n.link) {
                          setOpen(false);
                          router.push(n.link);
                        }
                      }}
                      className={cn(
                        "group relative flex w-full gap-3 px-4 py-3 text-left transition-colors",
                        "hover:bg-zoru-surface focus-visible:bg-zoru-surface focus-visible:outline-none",
                        !n.isRead && "bg-zoru-surface/60",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          !n.isRead ? "bg-zoru-ink" : "bg-transparent",
                        )}
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <p
                          className={cn(
                            "text-sm leading-snug text-zoru-ink",
                            n.isRead && "text-zoru-ink-muted",
                          )}
                        >
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-zoru-ink-subtle">
                          <span>
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                          <span>·</span>
                          <span className="capitalize">
                            {n.sourceApp || "System"}
                          </span>
                        </div>
                      </div>
                      {!n.isRead && (
                        <span
                          role="button"
                          aria-label="Mark as read"
                          tabIndex={-1}
                          onClick={(e) => handleMarkOne(id, e)}
                          className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-[4px] text-zoru-ink-muted opacity-0 transition-opacity hover:bg-zoru-surface-2 hover:text-zoru-ink group-hover:opacity-100"
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t border-zoru-line bg-zoru-surface px-4 py-2 text-center">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/notifications");
            }}
            className="text-xs text-zoru-ink-muted hover:text-zoru-ink"
          >
            View all notifications →
          </button>
        </div>
      </ZoruPopoverContent>
    </Popover>
  );
}

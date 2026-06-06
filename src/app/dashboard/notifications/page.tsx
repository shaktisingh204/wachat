"use client";
import { fmtDate } from "@/lib/utils";

import {
  cn,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  BellRing,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Globe,
  Inbox,
  Loader2,
  RefreshCw,
  Settings,
  } from "lucide-react";

import { useProject } from "@/context/project-context";

import {
  getAllNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  } from "@/app/actions/notification.actions";
import type { NotificationWithProject } from "@/lib/definitions";
import type { WithId } from "mongodb";

/**
 * /dashboard/notifications — full notification history.
 *
 * Linked from the global header `ZoruNotificationPopover` via its
 * "View all notifications →" footer. Same server actions
 * (`getAllNotifications`, `markNotificationAsRead`,
 * `markAllNotificationsAsRead`) and pagination contract as before.
 * Visual layer fully Zoru: no clay, no `@/components/ui/*`,
 * no `@/hooks/use-toast`, no tab UI, neutral palette only.
 */

import * as React from "react";

const NOTIFICATIONS_PER_PAGE = 20;

const eventTypes = [
  { value: "messages", label: "Messages" },
  { value: "message_template_status_update", label: "Template Status" },
  { value: "phone_number_quality_update", label: "Phone Quality" },
  { value: "account_review_update", label: "Account Review" },
  { value: "account_update", label: "Account Updates" },
];

function humanizeEventType(eventType = "general"): string {
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<
    WithId<NotificationWithProject>[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, startRefreshTransition] = useTransition();
  const [isMarkingRead, startMarkingReadTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [filter, setFilter] = useState("");
  const [appFilter, setAppFilter] = useState("ALL");
  const [readFilter, setReadFilter] = useState("ALL");
  const { toast } = useZoruToast();
  const router = useRouter();
  const { activeProjectId } = useProject();

  useEffect(() => {
    document.title = "All Notifications · SabNode";
  }, []);

  const fetchNotifications = useCallback(
    async (page: number, currentFilter: string, currentAppFilter: string, currentReadFilter: string, showToast = false) => {
      startRefreshTransition(async () => {
        try {
          const { notifications: next, total } = await getAllNotifications(
            page,
            NOTIFICATIONS_PER_PAGE,
            currentFilter,
            activeProjectId,
            currentAppFilter,
            currentReadFilter
          );
          setNotifications(next);
          setTotalPages(Math.ceil(total / NOTIFICATIONS_PER_PAGE));
          if (showToast) {
            toast({
              title: "Refreshed",
              description: "Notifications have been updated.",
            });
          }
        } catch {
          toast({
            title: "Error",
            description: "Failed to fetch notifications.",
            variant: "destructive",
          });
        }
      });
    },
    [activeProjectId, toast],
  );

  useEffect(() => {
    setLoading(true);
    fetchNotifications(currentPage, filter, appFilter, readFilter).finally(() => setLoading(false));
  }, [currentPage, filter, appFilter, readFilter, fetchNotifications]);

  const handleEventFilterChange = (next: string) => {
    setFilter(next === "ALL" ? "" : next);
    setCurrentPage(1);
  };

  const handleNotificationClick = async (
    notification: WithId<NotificationWithProject>,
  ) => {
    if (!notification.isRead) {
      startRefreshTransition(async () => {
        const result = await markNotificationAsRead(notification._id.toString());
        if (result.success) {
          setNotifications((prev) =>
            prev.map((n) =>
              n._id.toString() === notification._id.toString()
                ? { ...n, isRead: true }
                : n,
            ),
          );
        } else {
          toast({
            title: "Error",
            description: "Failed to mark notification as read.",
            variant: "destructive",
          });
        }
      });
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  const handleMarkAllRead = () => {
    startMarkingReadTransition(async () => {
      const result = await markAllNotificationsAsRead();
      if (result.success) {
        const count = result.updatedCount || 0;
        toast({
          title: "Marked as read",
          description:
            count > 0
              ? `${count} notification(s) marked as read.`
              : "No new notifications to mark as read.",
        });
        if (count > 0) {
          fetchNotifications(1, filter, appFilter, readFilter);
          setCurrentPage(1);
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to mark all as read.",
          variant: "destructive",
        });
      }
    });
  };

  const filteredNotifications = notifications;

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Notifications</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>All Notifications</ZoruPageTitle>
          <ZoruPageDescription>
            A complete history of automated events and alerts.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <Select
            defaultValue="ALL"
            onValueChange={(v) => {
              setAppFilter(v);
              setCurrentPage(1);
            }}
          >
            <ZoruSelectTrigger className="w-[160px]">
              <Globe className="h-4 w-4 text-zoru-ink-muted" />
              <ZoruSelectValue placeholder="App source" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="ALL">All Apps</ZoruSelectItem>
              <ZoruSelectItem value="wachat">WaChat</ZoruSelectItem>
              <ZoruSelectItem value="facebook">Meta Suite</ZoruSelectItem>
              <ZoruSelectItem value="ad-manager">Ad Manager</ZoruSelectItem>
              <ZoruSelectItem value="crm">CRM</ZoruSelectItem>
              <ZoruSelectItem value="sabchat">SabChat</ZoruSelectItem>
              <ZoruSelectItem value="system">System</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>

          <Select defaultValue="ALL" onValueChange={handleEventFilterChange}>
            <ZoruSelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 text-zoru-ink-muted" />
              <ZoruSelectValue placeholder="Event type" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="ALL">All events</ZoruSelectItem>
              {eventTypes.map((et) => (
                <ZoruSelectItem key={et.value} value={et.value}>
                  {et.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>

          <Select
            defaultValue="ALL"
            onValueChange={(v) => {
              setReadFilter(v);
              setCurrentPage(1);
            }}
          >
            <ZoruSelectTrigger className="w-[140px]">
              <Bell className="h-4 w-4 text-zoru-ink-muted" />
              <ZoruSelectValue placeholder="Read status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="ALL">All status</ZoruSelectItem>
              <ZoruSelectItem value="unread">Unread</ZoruSelectItem>
              <ZoruSelectItem value="read">Read</ZoruSelectItem>
            </ZoruSelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/dashboard/notification-preferences")}
          >
            <Settings />
            Preferences
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isRefreshing || isMarkingRead}
          >
            {isMarkingRead ? (
              <Loader2 className="animate-spin" />
            ) : (
              <BadgeCheck />
            )}
            Mark all read
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNotifications(currentPage, filter, appFilter, readFilter, true)}
            disabled={isRefreshing || isMarkingRead}
          >
            <RefreshCw
              className={cn(isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </ZoruPageActions>
      </PageHeader>

      <Card className="overflow-hidden p-0">
        <ul className="divide-y divide-zoru-line">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <li key={i} className="p-4">
                <Skeleton className="h-12 w-full" />
              </li>
            ))
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((n) => (
              <li
                key={n._id.toString()}
                className={cn(
                  "flex items-start gap-4 p-4 transition-colors hover:bg-zoru-surface",
                  !n.isRead && "bg-zoru-surface/60",
                )}
              >
                <div className="mt-1">
                  {n.isRead ? (
                    <Bell className="h-5 w-5 text-zoru-ink-muted" />
                  ) : (
                    <BellRing className="h-5 w-5 text-zoru-ink" />
                  )}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={cn(
                        "text-sm leading-none text-zoru-ink",
                        !n.isRead && "text-zoru-ink-strong",
                      )}
                    >
                      {n.projectName
                        ? `Project: ${n.projectName}`
                        : "System Notification"}
                    </p>
                    <p className="text-[11px] text-zoru-ink-muted">
                      {fmtDate(n.createdAt)}
                    </p>
                  </div>
                  <p className="text-sm leading-snug text-zoru-ink-muted">
                    {n.message}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="font-mono">
                      {humanizeEventType(n.eventType)}
                    </Badge>
                    <Badge variant="secondary" className="uppercase">
                      {n.sourceApp || "System"}
                    </Badge>
                    {!n.isRead && (
                      <Badge variant="info">Unread</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNotificationClick(n)}
                >
                  <Eye />
                  View
                </Button>
              </li>
            ))
          ) : (
            <li className="p-8">
              <EmptyState
                icon={<Inbox />}
                title="No notifications"
                description={
                  filter
                    ? `Nothing matches the "${humanizeEventType(filter)}" filter.`
                    : "You're all caught up. New events will appear here."
                }
                compact
              />
            </li>
          )}
        </ul>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-zoru-ink-muted">
            Page {currentPage} of {Math.max(totalPages, 1)}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            onClick={() => setCurrentPage((p) => p - 1)}
            disabled={currentPage <= 1 || isRefreshing}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={currentPage >= totalPages || isRefreshing}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}

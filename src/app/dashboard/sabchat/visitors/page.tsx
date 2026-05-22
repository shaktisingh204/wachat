"use client";

import {
  cn,
  useZoruToast,
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
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from "react";
import {
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Users,
  } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { getLiveVisitors } from "@/app/actions/sabchat.actions";
import type { WithId,
  SabChatSession } from "@/lib/definitions";

/**
 * /dashboard/sabchat/visitors — live visitor list.
 *
 * Same `getLiveVisitors` server action and 10-second polling as before.
 * Visual layer fully Zoru.
 */

function VisitorTableSkeleton() {
  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <ZoruSkeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </ZoruCard>
  );
}

export default function SabChatVisitorsPage() {
  const [visitors, setVisitors] = useState<WithId<SabChatSession>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const { toast } = useZoruToast();

  const fetchData = useCallback(
    (showToast = false) => {
      startLoading(async () => {
        try {
          const data = await getLiveVisitors();
          setVisitors(data);
          if (showToast) {
            toast({
              title: "Refreshed",
              description: "Visitor list has been updated.",
            });
          }
        } catch {
          toast({
            title: "Error",
            description: "Failed to fetch live visitors.",
            variant: "destructive",
          });
        } finally {
          setDidInitialLoad(true);
        }
      });
    },
    [toast],
  );

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(() => fetchData(), 10000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Live Visitors</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Live visitors</ZoruPageTitle>
          <ZoruPageDescription>
            Real-time visitors currently on your website.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Refresh
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {!didInitialLoad && visitors.length === 0 ? (
        <VisitorTableSkeleton />
      ) : visitors.length === 0 ? (
        <ZoruEmptyState
          icon={<Users />}
          title="No live visitors right now"
          description="When visitors land on your site, they will appear here in real time."
        />
      ) : (
        <ZoruCard className="overflow-hidden p-0">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Visitor</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Last seen</ZoruTableHead>
                <ZoruTableHead>Location</ZoruTableHead>
                <ZoruTableHead className="text-right">Action</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {visitors.map((visitor) => {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const isOnline =
                  new Date(visitor.updatedAt) > fiveMinutesAgo;
                const name = visitor.visitorInfo?.name || "Visitor";
                const email = visitor.visitorInfo?.email;

                return (
                  <ZoruTableRow key={visitor._id.toString()}>
                    <ZoruTableCell>
                      <div className="flex flex-col">
                        <span className="text-zoru-ink">{name}</span>
                        {email && (
                          <span className="text-xs text-zoru-ink-muted">
                            {email}
                          </span>
                        )}
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge
                        variant={isOnline ? "success" : "secondary"}
                        className={cn(
                          "gap-1.5",
                          !isOnline && "text-zoru-ink-muted",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            isOnline
                              ? "bg-zoru-success"
                              : "bg-zoru-ink-subtle",
                          )}
                        />
                        {isOnline ? "Online" : "Offline"}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-zoru-ink-muted">
                      {formatDistanceToNow(new Date(visitor.updatedAt), {
                        addSuffix: true,
                      })}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs text-zoru-ink">
                          {visitor.visitorInfo?.ip}
                        </span>
                        <span
                          className="max-w-[200px] truncate text-xs text-zoru-ink-muted"
                          title={visitor.visitorInfo?.page}
                        >
                          {visitor.visitorInfo?.page}
                        </span>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruButton
                        asChild
                        variant="outline"
                        size="sm"
                      >
                        <a
                          href={`/dashboard/sabchat/inbox?conversationId=${visitor._id.toString()}`}
                        >
                          <MessageSquare />
                          Chat
                        </a>
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </ZoruTable>
        </ZoruCard>
      )}
    </div>
  );
}

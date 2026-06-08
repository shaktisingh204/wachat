"use client";

import {
  cn,
  useToast,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  IconButton,
  Card,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeading,
  PageTitle,
  Skeleton,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Input,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/sabcrm/20ui";
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  RefreshCw,
  Users,
  Search,
  Laptop,
  Smartphone,
  Globe,
  MapPin,
  Clock,
  ExternalLink,
  Filter,
  Send,
  MoreHorizontal,
  History,
  Wifi,
  MousePointerClick,
} from "lucide-react";

import { getLiveVisitors } from "@/app/actions/sabchat.actions";
import type { WithId, SabChatSession } from "@/lib/definitions";

/**
 * /dashboard/sabchat/visitors — live visitor list.
 */

function VisitorTableSkeleton() {
  return (
    <Card padding="none" className="overflow-hidden">
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} height={64} width="100%" />
        ))}
      </div>
    </Card>
  );
}

export default function SabChatVisitorsPage() {
  const [visitors, setVisitors] = useState<WithId<SabChatSession>[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [didInitialLoad, setDidInitialLoad] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();
  const router = useRouter();

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
              tone: "success",
            });
          }
        } catch {
          toast.error({
            title: "Error",
            description: "Failed to fetch live visitors.",
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

  const filteredVisitors = visitors.filter((v) => {
    if (!searchQuery) return true;
    const s = searchQuery.toLowerCase();
    return (
      v.visitorInfo?.name?.toLowerCase().includes(s) ||
      v.visitorInfo?.email?.toLowerCase().includes(s) ||
      v.visitorInfo?.ip?.includes(s) ||
      v.visitorInfo?.page?.toLowerCase().includes(s)
    );
  });

  // Derived KPIs from the live session list (5-minute activity window).
  const activeCutoff = Date.now() - 5 * 60 * 1000;
  const onlineCount = visitors.filter(
    (v) => new Date(v.updatedAt).getTime() > activeCutoff,
  ).length;
  const identifiedCount = visitors.filter(
    (v) => v.visitorInfo?.email || v.visitorInfo?.name,
  ).length;
  const pagesInView = new Set(
    visitors.map((v) => v.visitorInfo?.page).filter(Boolean),
  ).size;

  return (
    <div className="20ui mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/sabchat/inbox">
              SabChat
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Live Visitors</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader>
        <PageHeading>
          <div className="flex items-center gap-3">
            <PageTitle>Live visitors</PageTitle>
            <Badge variant="success" className="animate-pulse">
              {filteredVisitors.length} Online
            </Badge>
          </div>
          <PageDescription>
            Real-time tracking of visitors currently active on your website.
          </PageDescription>
        </PageHeading>
        <PageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isLoading}
            iconLeft={isLoading ? LoaderCircle : RefreshCw}
            className={isLoading ? "[&_svg]:animate-spin" : undefined}
          >
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      <section
        aria-label="Visitor summary"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Visitors on site"
          value={visitors.length}
          icon={Users}
          accent="#6366f1"
        />
        <StatCard
          label="Active now"
          value={onlineCount}
          icon={Wifi}
          accent="#10b981"
        />
        <StatCard label="Identified" value={identifiedCount} icon={History} />
        <StatCard
          label="Pages in view"
          value={pagesInView}
          icon={MousePointerClick}
          accent="#0ea5e9"
        />
      </section>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <Tabs defaultValue="all" className="w-[400px]">
          <TabsList>
            <TabsTrigger value="all">All Visitors</TabsTrigger>
            <TabsTrigger value="active">Active Now</TabsTrigger>
            <TabsTrigger value="returning">Returning</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="w-full sm:w-64">
            <Input
              inputSize="sm"
              placeholder="Search visitors..."
              aria-label="Search visitors"
              iconLeft={Search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" iconLeft={Filter}>
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by Location</DropdownMenuLabel>
              <DropdownMenuItem>North America</DropdownMenuItem>
              <DropdownMenuItem>Europe</DropdownMenuItem>
              <DropdownMenuItem>Asia</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter by Device</DropdownMenuLabel>
              <DropdownMenuItem iconLeft={Laptop}>Desktop</DropdownMenuItem>
              <DropdownMenuItem iconLeft={Smartphone}>Mobile</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!didInitialLoad && visitors.length === 0 ? (
        <VisitorTableSkeleton />
      ) : visitors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No live visitors right now"
          description="When visitors land on your site, they will appear here in real time with rich analytics."
        />
      ) : (
        <Card padding="none" className="overflow-hidden">
          <Table>
            <THead>
              <Tr>
                <Th>Visitor</Th>
                <Th>Status &amp; Time</Th>
                <Th>Location &amp; Device</Th>
                <Th>Current Page &amp; Source</Th>
                <Th align="right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filteredVisitors.map((visitor) => {
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
                const isOnline = new Date(visitor.updatedAt) > fiveMinutesAgo;
                const name = visitor.visitorInfo?.name || "Visitor";
                const email = visitor.visitorInfo?.email;

                // Mocks for new features
                const isReturning = Math.random() > 0.5;
                const timeOnSite = Math.floor(Math.random() * 15) + 1; // 1-15 mins
                const isMobile = Math.random() > 0.7;
                const source = Math.random() > 0.5 ? "Google Search" : "Direct";

                return (
                  <Tr key={visitor._id.toString()} className="group">
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[var(--st-text)]">
                            {name}
                          </span>
                          {isReturning && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-wider">
                              Returning
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--st-text-secondary)]">
                            {email ||
                              `ID: ${visitor._id.toString().slice(-6)}`}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-2">
                        <Badge
                          variant={isOnline ? "success" : "secondary"}
                          className={cn(
                            "w-fit gap-1.5",
                            !isOnline && "text-[var(--st-text-secondary)]",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isOnline
                                ? "bg-[var(--st-status-ok)]"
                                : "bg-[var(--st-text-tertiary)]",
                            )}
                          />
                          {isOnline ? "Online Now" : "Idle"}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>{timeOnSite}m on site</span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-sm text-[var(--st-text)]">
                          <MapPin
                            className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                          />
                          New York, US
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--st-text-secondary)]">
                          <span className="flex items-center gap-1">
                            {isMobile ? (
                              <Smartphone className="h-3 w-3" aria-hidden="true" />
                            ) : (
                              <Laptop className="h-3 w-3" aria-hidden="true" />
                            )}
                            {isMobile ? "iOS" : "Mac OS"}
                          </span>
                          <span className="font-mono text-[10px]">
                            {visitor.visitorInfo?.ip || "Unknown IP"}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Globe
                            className="h-3.5 w-3.5 text-[var(--st-text-secondary)]"
                            aria-hidden="true"
                          />
                          <span
                            className="max-w-[200px] truncate text-sm font-medium text-[var(--st-text)]"
                            title={visitor.visitorInfo?.page}
                          >
                            {visitor.visitorInfo?.page || "/"}
                          </span>
                          <ExternalLink
                            className="h-3 w-3 text-[var(--st-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                          <span className="rounded bg-[var(--st-bg-muted)] px-1.5 py-0.5 text-[10px]">
                            Source
                          </span>
                          {source}
                        </div>
                      </div>
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <IconButton
                                label="View journey"
                                icon={History}
                                variant="ghost"
                                size="sm"
                              />
                            </TooltipTrigger>
                            <TooltipContent>View Journey</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <Button
                          variant="secondary"
                          size="sm"
                          iconLeft={Send}
                          onClick={() =>
                            router.push(
                              `/dashboard/sabchat/inbox?conversationId=${visitor._id.toString()}`,
                            )
                          }
                        >
                          Invite
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              label="More actions"
                              icon={MoreHorizontal}
                              variant="ghost"
                              size="sm"
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              View full profile
                            </DropdownMenuItem>
                            <DropdownMenuItem>Block IP Address</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="danger">
                              Delete session
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

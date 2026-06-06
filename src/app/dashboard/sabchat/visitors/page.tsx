"use client";

import { cn, useToast, Badge, Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, Card, EmptyState, PageActions, PageDescription, PageHeader, PageHeading, PageTitle, Skeleton, Table, TBody, Td, Th, THead, Tr, Input, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, Tabs, TabsList, TabsTrigger } from '@/components/sabcrm/20ui/compat';
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
  Search,
  Laptop,
  Smartphone,
  Globe,
  MapPin,
  Clock,
  ExternalLink,
  Filter,
  ArrowUpDown,
  Send,
  MoreHorizontal,
  History
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { getLiveVisitors } from "@/app/actions/sabchat.actions";
import type { WithId, SabChatSession } from "@/lib/definitions";

/**
 * /dashboard/sabchat/visitors — live visitor list.
 */

function VisitorTableSkeleton() {
  return (
    <Card className="overflow-hidden p-0">
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
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

  const filteredVisitors = visitors.filter(v => {
    if (!searchQuery) return true;
    const s = searchQuery.toLowerCase();
    return v.visitorInfo?.name?.toLowerCase().includes(s) || 
           v.visitorInfo?.email?.toLowerCase().includes(s) || 
           v.visitorInfo?.ip?.includes(s) || 
           v.visitorInfo?.page?.toLowerCase().includes(s);
  });

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
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
            <Badge variant="secondary" className="px-2 py-0.5 animate-pulse bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)]/40 dark:text-[var(--st-text-secondary)]">
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
          >
            {isLoading ? (
              <LoaderCircle className="animate-spin mr-2 h-4 w-4" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs defaultValue="all" className="w-[400px]">
          <TabsList>
            <TabsTrigger value="all">All Visitors</TabsTrigger>
            <TabsTrigger value="active">Active Now</TabsTrigger>
            <TabsTrigger value="returning">Returning</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
            <Input 
              placeholder="Search visitors..." 
              className="pl-9 h-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3">
                <Filter className="h-4 w-4 mr-2" />
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
              <DropdownMenuItem><Laptop className="h-4 w-4 mr-2"/> Desktop</DropdownMenuItem>
              <DropdownMenuItem><Smartphone className="h-4 w-4 mr-2"/> Mobile</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {!didInitialLoad && visitors.length === 0 ? (
        <VisitorTableSkeleton />
      ) : visitors.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title="No live visitors right now"
          description="When visitors land on your site, they will appear here in real time with rich analytics."
        />
      ) : (
        <Card className="overflow-hidden p-0 shadow-sm">
          <Table>
            <THead className="bg-[var(--st-bg-muted)]/50">
              <Tr>
                <Th>Visitor</Th>
                <Th>Status & Time</Th>
                <Th>Location & Device</Th>
                <Th>Current Page & Source</Th>
                <Th className="text-right">Actions</Th>
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
                          <span className="font-semibold text-[var(--st-text)]">{name}</span>
                          {isReturning && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-wider text-[var(--st-text)] border-[var(--st-border)] bg-[var(--st-bg-muted)]">
                              Returning
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[var(--st-text-secondary)]">
                            {email || `ID: ${visitor._id.toString().slice(-6)}`}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-2">
                        <Badge
                          variant={isOnline ? "success" : "secondary"}
                          className={cn("w-fit gap-1.5", !isOnline && "text-[var(--st-text-secondary)]")}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isOnline ? "bg-[var(--st-status-ok)]" : "bg-[var(--st-text-tertiary)]",
                            )}
                          />
                          {isOnline ? "Online Now" : "Idle"}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                          <Clock className="h-3 w-3" />
                          <span>{timeOnSite}m on site</span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-sm text-[var(--st-text)]">
                          <MapPin className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                          New York, US
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[var(--st-text-secondary)]">
                          <span className="flex items-center gap-1">
                            {isMobile ? <Smartphone className="h-3 w-3" /> : <Laptop className="h-3 w-3" />}
                            {isMobile ? "iOS" : "Mac OS"}
                          </span>
                          <span className="font-mono text-[10px]">{visitor.visitorInfo?.ip || "Unknown IP"}</span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                          <span
                            className="max-w-[200px] truncate text-sm text-[var(--st-text)] font-medium"
                            title={visitor.visitorInfo?.page}
                          >
                            {visitor.visitorInfo?.page || "/"}
                          </span>
                          <ExternalLink className="h-3 w-3 text-[var(--st-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                          <span className="px-1.5 py-0.5 bg-[var(--st-bg-muted)] rounded text-[10px]">Source</span>
                          {source}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">
                                <History className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View Journey</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        
                        <Button
                          asChild
                          variant="secondary"
                          size="sm"
                          className="font-medium"
                        >
                          <a href={`/dashboard/sabchat/inbox?conversationId=${visitor._id.toString()}`}>
                            <Send className="mr-1.5 h-3.5 w-3.5" />
                            Invite
                          </a>
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-[var(--st-text-secondary)]">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View full profile</DropdownMenuItem>
                            <DropdownMenuItem>Block IP Address</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-[var(--st-text)]">Delete session</DropdownMenuItem>
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

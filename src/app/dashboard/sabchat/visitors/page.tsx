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
  Input,
  ZoruTooltip,
  ZoruTooltipContent,
  ZoruTooltipProvider,
  ZoruTooltipTrigger,
  ZoruDropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  Tabs,
  ZoruTabsList,
  ZoruTabsTrigger,
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
      </Breadcrumb>

      <PageHeader>
        <ZoruPageHeading>
          <div className="flex items-center gap-3">
            <ZoruPageTitle>Live visitors</ZoruPageTitle>
            <Badge variant="secondary" className="px-2 py-0.5 animate-pulse bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              {filteredVisitors.length} Online
            </Badge>
          </div>
          <ZoruPageDescription>
            Real-time tracking of visitors currently active on your website.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
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
        </ZoruPageActions>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs defaultValue="all" className="w-[400px]">
          <ZoruTabsList>
            <ZoruTabsTrigger value="all">All Visitors</ZoruTabsTrigger>
            <ZoruTabsTrigger value="active">Active Now</ZoruTabsTrigger>
            <ZoruTabsTrigger value="returning">Returning</ZoruTabsTrigger>
          </ZoruTabsList>
        </Tabs>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zoru-ink-muted" />
            <Input 
              placeholder="Search visitors..." 
              className="pl-9 h-9" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <ZoruDropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end">
              <ZoruDropdownMenuLabel>Filter by Location</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuItem>North America</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem>Europe</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem>Asia</ZoruDropdownMenuItem>
              <ZoruDropdownMenuSeparator />
              <ZoruDropdownMenuLabel>Filter by Device</ZoruDropdownMenuLabel>
              <ZoruDropdownMenuItem><Laptop className="h-4 w-4 mr-2"/> Desktop</ZoruDropdownMenuItem>
              <ZoruDropdownMenuItem><Smartphone className="h-4 w-4 mr-2"/> Mobile</ZoruDropdownMenuItem>
            </ZoruDropdownMenuContent>
          </ZoruDropdownMenu>
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
            <ZoruTableHeader className="bg-zoru-surface-2/50">
              <ZoruTableRow>
                <ZoruTableHead>Visitor</ZoruTableHead>
                <ZoruTableHead>Status & Time</ZoruTableHead>
                <ZoruTableHead>Location & Device</ZoruTableHead>
                <ZoruTableHead>Current Page & Source</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
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
                  <ZoruTableRow key={visitor._id.toString()} className="group">
                    <ZoruTableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zoru-ink">{name}</span>
                          {isReturning && (
                            <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-wider text-purple-600 border-purple-200 bg-purple-50">
                              Returning
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-zoru-ink-muted">
                            {email || `ID: ${visitor._id.toString().slice(-6)}`}
                          </span>
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-col gap-2">
                        <Badge
                          variant={isOnline ? "success" : "secondary"}
                          className={cn("w-fit gap-1.5", !isOnline && "text-zoru-ink-muted")}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              isOnline ? "bg-zoru-success" : "bg-zoru-ink-subtle",
                            )}
                          />
                          {isOnline ? "Online Now" : "Idle"}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-zoru-ink-muted">
                          <Clock className="h-3 w-3" />
                          <span>{timeOnSite}m on site</span>
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5 text-sm text-zoru-ink">
                          <MapPin className="h-3.5 w-3.5 text-zoru-ink-muted" />
                          New York, US
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zoru-ink-muted">
                          <span className="flex items-center gap-1">
                            {isMobile ? <Smartphone className="h-3 w-3" /> : <Laptop className="h-3 w-3" />}
                            {isMobile ? "iOS" : "Mac OS"}
                          </span>
                          <span className="font-mono text-[10px]">{visitor.visitorInfo?.ip || "Unknown IP"}</span>
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3.5 w-3.5 text-zoru-ink-muted" />
                          <span
                            className="max-w-[200px] truncate text-sm text-zoru-ink font-medium"
                            title={visitor.visitorInfo?.page}
                          >
                            {visitor.visitorInfo?.page || "/"}
                          </span>
                          <ExternalLink className="h-3 w-3 text-zoru-ink-muted opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-zoru-ink-muted">
                          <span className="px-1.5 py-0.5 bg-zoru-surface-2 rounded text-[10px]">Source</span>
                          {source}
                        </div>
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <ZoruTooltipProvider>
                          <ZoruTooltip>
                            <ZoruTooltipTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-zoru-ink-muted hover:text-zoru-ink">
                                <History className="h-4 w-4" />
                              </Button>
                            </ZoruTooltipTrigger>
                            <ZoruTooltipContent>View Journey</ZoruTooltipContent>
                          </ZoruTooltip>
                        </ZoruTooltipProvider>
                        
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

                        <ZoruDropdownMenu>
                          <ZoruDropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-zoru-ink-muted">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </ZoruDropdownMenuTrigger>
                          <ZoruDropdownMenuContent align="end">
                            <ZoruDropdownMenuItem>View full profile</ZoruDropdownMenuItem>
                            <ZoruDropdownMenuItem>Block IP Address</ZoruDropdownMenuItem>
                            <ZoruDropdownMenuSeparator />
                            <ZoruDropdownMenuItem className="text-red-600">Delete session</ZoruDropdownMenuItem>
                          </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })}
            </ZoruTableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  MessageSquare,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  Settings,
  Download,
  Trash2,
  UserCircle,
  Edit3,
  Activity,
} from "lucide-react";

import {
  PageHeader,
  PageHeaderHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  StatCard,
  Card,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  type BadgeTone,
  Avatar,
  Spinner,
  EmptyState,
  Pagination,
} from "@/components/sabcrm/20ui";

// --- Types ---
type TicketStatus = "open" | "pending" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface Ticket {
  id: string;
  subject: string;
  requester: string;
  requesterEmail: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  lastUpdated: string;
  tags: string[];
  replies: number;
  slaBreach: boolean;
  satisfaction: number | null;
}

// --- Data ---
import { listTickets } from "@/app/actions/crm/tickets.actions";

// --- Helpers ---

const STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  open: "info",
  pending: "warning",
  resolved: "success",
  closed: "neutral",
};

const PRIORITY_TONE: Record<TicketPriority, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "danger",
};

const StatusBadge = ({ status }: { status: TicketStatus }) => (
  <Badge tone={STATUS_TONE[status]} dot className="capitalize">
    {status}
  </Badge>
);

const PriorityBadge = ({ priority }: { priority: TicketPriority }) => (
  <span className="inline-flex items-center gap-1.5">
    <AlertCircle
      className="w-4 h-4 text-[var(--st-text-secondary)]"
      aria-hidden="true"
    />
    <Badge tone={PRIORITY_TONE[priority]} kind="soft" className="capitalize">
      {priority}
    </Badge>
  </span>
);

export default function MyTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">(
    "all",
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [page, setPage] = useState(1);
  const itemsPerPage = 50;

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTickets() {
      setIsLoading(true);
      try {
        const res = await listTickets({ limit: 100 });
        if (res.tickets) {
          setTickets(
            res.tickets.map((t) => ({
              id: String(t._id),
              subject: t.subject || "No Subject",
              requester: t.requesterId || "Unknown",
              requesterEmail: "unknown@example.com",
              status: (t.status || "open") as TicketStatus,
              priority: (t.priority || "medium") as TicketPriority,
              createdAt: t.createdAt || new Date().toISOString(),
              lastUpdated: t.updatedAt || new Date().toISOString(),
              tags: [],
              replies: 0,
              slaBreach: false,
              satisfaction: null,
            })),
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchTickets();
  }, []);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        t.subject.toLowerCase().includes(search.toLowerCase()) ||
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.requester.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || t.status === statusFilter;
      const matchPriority =
        priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchStatus && matchPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  const paginatedTickets = useMemo(() => {
    return filteredTickets.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  }, [filteredTickets, page, itemsPerPage]);

  const pageCount = Math.max(
    1,
    Math.ceil(filteredTickets.length / itemsPerPage),
  );

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedTickets.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  // --- Metrics ---
  const metrics = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    urgent: tickets.filter((t) => t.priority === "urgent").length,
    slaBreaches: tickets.filter((t) => t.slaBreach).length,
  };

  return (
    <div className="20ui dark min-h-screen bg-[var(--st-bg)] text-[var(--st-text)] flex flex-col">
      {/* Header section */}
      <div className="sticky top-0 z-20 bg-[var(--st-bg)] border-b border-[var(--st-border)] px-6 py-4">
        <PageHeader bordered={false} compact className="items-center">
          <div className="flex items-center gap-4">
            <span
              className="w-10 h-10 rounded-[var(--st-radius-lg)] bg-[var(--st-accent)] flex items-center justify-center text-[var(--st-text-inverted)]"
              aria-hidden="true"
            >
              <UserCircle className="w-6 h-6" />
            </span>
            <PageHeaderHeading>
              <PageEyebrow>Workspace</PageEyebrow>
              <PageTitle>My Workspace</PageTitle>
              <PageDescription>
                Manage your assigned tickets and tasks.
              </PageDescription>
            </PageHeaderHeading>
          </div>

          <PageActions>
            <Button variant="secondary" iconLeft={Download}>
              Export Data
            </Button>
            <Button variant="primary" iconLeft={Plus}>
              New Ticket
            </Button>
          </PageActions>
        </PageHeader>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
          <StatCard
            label="Total Assigned"
            value={metrics.total}
            icon={Activity}
            accent="var(--st-accent)"
          />
          <StatCard
            label="Open Tickets"
            value={metrics.open}
            icon={Clock}
            accent="var(--st-status-ok)"
          />
          <StatCard
            label="Urgent Priority"
            value={metrics.urgent}
            icon={AlertCircle}
            accent="var(--st-danger)"
          />
          <StatCard
            label="SLA Breaches"
            value={metrics.slaBreaches}
            icon={AlertCircle}
            accent="var(--st-warn)"
          />
        </div>

        {/* Toolbar */}
        <Card
          variant="outlined"
          padding="sm"
          className="flex flex-col sm:flex-row items-center gap-4 justify-between shrink-0"
        >
          <div className="flex items-center gap-2 flex-1 w-full">
            <div className="flex-1 max-w-md w-full">
              <Input
                type="text"
                iconLeft={Search}
                placeholder="Search tickets by ID, subject, or requester..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search tickets"
              />
            </div>

            <div className="h-8 w-px bg-[var(--st-border)] hidden sm:block mx-2" />

            <div className="hidden sm:block w-40">
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as TicketStatus | "all")}
              >
                <SelectTrigger aria-label="Filter by status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="hidden sm:block w-40">
              <Select
                value={priorityFilter}
                onValueChange={(v) =>
                  setPriorityFilter(v as TicketPriority | "all")
                }
              >
                <SelectTrigger aria-label="Filter by priority">
                  <SelectValue placeholder="All Priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm font-medium text-[var(--st-accent)]">
                  {selectedIds.size} selected
                </span>
                <div className="h-4 w-px bg-[var(--st-border)] mx-1" />
                <IconButton
                  label="Bulk edit selected tickets"
                  icon={Edit3}
                  variant="ghost"
                />
                <IconButton
                  label="Delete selected tickets"
                  icon={Trash2}
                  variant="danger"
                />
              </div>
            )}

            <div className="flex items-center gap-1">
              <IconButton
                label="List view"
                icon={List}
                variant={viewMode === "list" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              />
              <IconButton
                label="Grid view"
                icon={LayoutGrid}
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
              />
            </div>

            <IconButton label="Filters" icon={Filter} variant="secondary" />
            <IconButton label="Settings" icon={Settings} variant="secondary" />
          </div>
        </Card>

        {/* Main Content Area */}
        <Card
          variant="outlined"
          padding="none"
          className="flex-1 overflow-hidden flex flex-col relative min-h-[500px]"
        >
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--st-bg)]/70 z-10">
              <div className="flex flex-col items-center gap-4">
                <Spinner size="lg" label="Loading your workspace" />
                <p className="text-[var(--st-text-secondary)] font-medium">
                  Loading your workspace...
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-auto">
            {filteredTickets.length === 0 ? (
              <div className="h-full flex items-center justify-center p-12">
                <EmptyState
                  icon={Search}
                  title="No tickets found"
                  description="Try adjusting your search or filters to find what you're looking for."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  }
                />
              </div>
            ) : viewMode === "list" ? (
              <Table hover stickyHeader>
                <THead>
                  <Tr>
                    <Th align="center" width={48}>
                      <Checkbox
                        checked={
                          selectedIds.size === paginatedTickets.length &&
                          paginatedTickets.length > 0
                        }
                        onChange={toggleSelectAll}
                        aria-label="Select all tickets"
                      />
                    </Th>
                    <Th>Ticket</Th>
                    <Th>Requester</Th>
                    <Th>Status</Th>
                    <Th>Priority</Th>
                    <Th className="hidden xl:table-cell">Tags</Th>
                    <Th className="hidden lg:table-cell">Activity</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {paginatedTickets.map((ticket) => (
                    <Tr
                      key={ticket.id}
                      selected={selectedIds.has(ticket.id)}
                      className="group cursor-pointer"
                      onClick={() => toggleSelect(ticket.id)}
                    >
                      <Td
                        align="center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(ticket.id)}
                          onChange={() => toggleSelect(ticket.id)}
                          aria-label={`Select ticket ${ticket.id}`}
                        />
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-[var(--st-text-tertiary)]">
                              {ticket.id}
                            </span>
                            {ticket.slaBreach && (
                              <Badge tone="danger" kind="soft">
                                SLA Breach
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm font-medium text-[var(--st-text)] group-hover:text-[var(--st-accent)] line-clamp-1">
                            {ticket.subject}
                          </span>
                        </div>
                      </Td>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar
                            name={ticket.requester}
                            size="sm"
                            shape="round"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-[var(--st-text)]">
                              {ticket.requester}
                            </span>
                            <span className="text-xs text-[var(--st-text-tertiary)]">
                              {ticket.requesterEmail}
                            </span>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <StatusBadge status={ticket.status} />
                      </Td>
                      <Td>
                        <PriorityBadge priority={ticket.priority} />
                      </Td>
                      <Td className="hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                          {ticket.tags.slice(0, 2).map((tag) => (
                            <Badge key={tag} tone="neutral" kind="outline">
                              {tag}
                            </Badge>
                          ))}
                          {ticket.tags.length > 2 && (
                            <Badge tone="neutral" kind="outline">
                              +{ticket.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </Td>
                      <Td className="hidden lg:table-cell">
                        <div className="flex flex-col gap-1 text-xs text-[var(--st-text-secondary)]">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {new Date(ticket.lastUpdated).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare
                              className="w-3 h-3"
                              aria-hidden="true"
                            />
                            {ticket.replies} replies
                          </div>
                        </div>
                      </Td>
                      <Td align="right">
                        <div
                          className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <IconButton
                            label={`Edit ticket ${ticket.id}`}
                            icon={Edit3}
                            variant="ghost"
                            size="sm"
                          />
                          <IconButton
                            label={`More actions for ticket ${ticket.id}`}
                            icon={MoreHorizontal}
                            variant="ghost"
                            size="sm"
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedTickets.map((ticket) => (
                  <Card
                    key={ticket.id}
                    variant="interactive"
                    padding="md"
                    className="flex flex-col group relative overflow-hidden"
                  >
                    {ticket.slaBreach && (
                      <div
                        className="absolute top-0 left-0 w-full h-1 bg-[var(--st-danger)]"
                        aria-hidden="true"
                      />
                    )}

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-[var(--st-text-tertiary)]">
                          {ticket.id}
                        </span>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <Checkbox
                        checked={selectedIds.has(ticket.id)}
                        onChange={() => toggleSelect(ticket.id)}
                        aria-label={`Select ticket ${ticket.id}`}
                      />
                    </div>

                    <h3 className="text-sm font-medium text-[var(--st-text)] mb-3 line-clamp-2 leading-relaxed flex-1">
                      {ticket.subject}
                    </h3>

                    <div className="flex items-center gap-2 mb-4 p-2 bg-[var(--st-bg-secondary)] rounded-[var(--st-radius)] border border-[var(--st-border)]">
                      <Avatar
                        name={ticket.requester}
                        size="sm"
                        shape="round"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-[var(--st-text)] truncate">
                          {ticket.requester}
                        </span>
                        <span className="text-[10px] text-[var(--st-text-tertiary)] truncate">
                          {ticket.requesterEmail}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-[var(--st-border)] flex items-center justify-between">
                      <PriorityBadge priority={ticket.priority} />
                      <div className="flex items-center gap-3 text-xs text-[var(--st-text-secondary)] font-medium">
                        <div className="flex items-center gap-1">
                          <MessageSquare
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          {ticket.replies}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          {new Date(ticket.lastUpdated).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex items-center justify-between shrink-0">
            <div className="text-sm text-[var(--st-text-secondary)]">
              Showing{" "}
              <span className="font-medium text-[var(--st-text)]">
                {filteredTickets.length === 0
                  ? 0
                  : (page - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-[var(--st-text)]">
                {Math.min(page * itemsPerPage, filteredTickets.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-[var(--st-text)]">
                {filteredTickets.length}
              </span>{" "}
              tickets
            </div>
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
            />
          </div>
        </Card>
      </main>
    </div>
  );
}

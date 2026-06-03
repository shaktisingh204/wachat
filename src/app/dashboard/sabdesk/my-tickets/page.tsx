"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  ChevronDown,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  LayoutGrid,
  List,
  Settings,
  Download,
  Trash2,
  Archive,
  Star,
  Tag,
  UserCircle,
  Edit3,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Calendar,
} from "lucide-react";

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

// --- Mock Data Generator ---
import { listTickets } from '@/app/actions/crm/tickets.actions';

// --- Components ---

const StatusBadge = ({ status }: { status: TicketStatus }) => {
  const colors = {
    open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    resolved: "bg-green-500/10 text-green-500 border-green-500/20",
    closed: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };
  return (
    <span
      className={`px-2.5 py-1 rounded-full text-xs font-medium border ${colors[status]} capitalize flex items-center gap-1.5 w-fit`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${colors[status].split(" ")[1].replace("text-", "bg-")}`}
      ></span>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: TicketPriority }) => {
  const colors = {
    low: "text-zinc-400",
    medium: "text-blue-400",
    high: "text-orange-400",
    urgent: "text-red-500 animate-pulse",
  };
  return (
    <div className="flex items-center gap-1.5">
      <AlertCircle className={`w-4 h-4 ${colors[priority]}`} />
      <span className="text-xs font-medium capitalize text-zinc-300">
        {priority}
      </span>
    </div>
  );
};

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
          setTickets(res.tickets.map(t => ({
            id: String(t._id),
            subject: t.subject || 'No Subject',
            requester: t.requesterId || 'Unknown',
            requesterEmail: 'unknown@example.com',
            status: (t.status || 'open') as TicketStatus,
            priority: (t.priority || 'medium') as TicketPriority,
            createdAt: t.createdAt || new Date().toISOString(),
            lastUpdated: t.updatedAt || new Date().toISOString(),
            tags: [],
            replies: 0,
            slaBreach: false,
            satisfaction: null
          })));
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
    return filteredTickets.slice(
      (page - 1) * itemsPerPage,
      page * itemsPerPage,
    );
  }, [filteredTickets, page, itemsPerPage]);

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

  // --- Metrics ---
  const metrics = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    urgent: tickets.filter((t) => t.priority === "urgent").length,
    slaBreaches: tickets.filter((t) => t.slaBreach).length,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Header section */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <UserCircle className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              My Workspace
            </h1>
            <p className="text-sm text-zinc-400">
              Manage your assigned tickets and tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-colors text-sm font-medium">
            <Download className="w-4 h-4" />
            Export Data
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 transition-all text-sm font-medium">
            <Plus className="w-4 h-4" />
            New Ticket
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
          {[
            {
              label: "Total Assigned",
              value: metrics.total,
              icon: Activity,
              color: "text-indigo-400",
              bg: "bg-indigo-500/10",
            },
            {
              label: "Open Tickets",
              value: metrics.open,
              icon: Clock,
              color: "text-blue-400",
              bg: "bg-blue-500/10",
            },
            {
              label: "Urgent Priority",
              value: metrics.urgent,
              icon: AlertCircle,
              color: "text-red-400",
              bg: "bg-red-500/10",
            },
            {
              label: "SLA Breaches",
              value: metrics.slaBreaches,
              icon: AlertCircle,
              color: "text-orange-400",
              bg: "bg-orange-500/10",
            },
          ].map((m, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 flex items-center gap-4 hover:bg-zinc-800/50 transition-colors cursor-pointer group"
            >
              <div
                className={`p-3 rounded-xl ${m.bg} ${m.color} group-hover:scale-110 transition-transform`}
              >
                <m.icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{m.value}</p>
                <p className="text-sm text-zinc-400 font-medium">{m.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-zinc-900/30 p-2 rounded-xl border border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-2 flex-1 w-full">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search tickets by ID, subject, or requester..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all text-white placeholder:text-zinc-600"
              />
            </div>

            <div className="h-8 w-px bg-zinc-800 hidden sm:block mx-2"></div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-zinc-300 hidden sm:block"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="bg-zinc-900 border border-zinc-800 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-zinc-300 hidden sm:block"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 mr-4 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20">
                <span className="text-sm font-medium text-indigo-400">
                  {selectedIds.size} selected
                </span>
                <div className="h-4 w-px bg-indigo-500/30 mx-1"></div>
                <button
                  className="p-1 hover:bg-indigo-500/20 rounded text-indigo-400 transition-colors"
                  title="Bulk Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  className="p-1 hover:bg-red-500/20 rounded text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
              <Filter className="w-4 h-4" />
            </button>
            <button className="p-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden flex flex-col relative min-h-[500px]">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-4">
                <RefreshCcw className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-zinc-400 font-medium">
                  Loading your massive workspace...
                </p>
              </div>
            </div>
          ) : null}

          <div className="flex-1 overflow-auto custom-scrollbar">
            {filteredTickets.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 p-12">
                <Search className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-xl font-medium text-zinc-300 mb-2">
                  No tickets found
                </h3>
                <p className="text-sm text-center max-w-sm">
                  Try adjusting your search or filters to find what you're
                  looking for.
                </p>
                <button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setPriorityFilter("all"); }
                  }
                  className="mt-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors text-sm"
                >
                  Clear Filters
                </button>
              </div>
            ) : viewMode === "list" ? (
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-900/80 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                  <tr className="text-xs uppercase tracking-wider text-zinc-500 font-semibold border-b border-zinc-800/80">
                    <th className="p-4 w-12 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === paginatedTickets.length &&
                          paginatedTickets.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50"
                      />
                    </th>
                    <th className="p-4">Ticket</th>
                    <th className="p-4">Requester</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4 hidden xl:table-cell">Tags</th>
                    <th className="p-4 hidden lg:table-cell">Activity</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {paginatedTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      className={`hover:bg-zinc-800/30 transition-colors group cursor-pointer ${selectedIds.has(ticket.id) ? "bg-indigo-500/5" : ""}`}
                      onClick={() => toggleSelect(ticket.id)}
                    >
                      <td
                        className="p-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(ticket.id)}
                          onChange={() => toggleSelect(ticket.id)}
                          className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-zinc-500">
                              {ticket.id}
                            </span>
                            {ticket.slaBreach && (
                              <span className="flex items-center gap-1 text-[10px] uppercase font-bold bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20">
                                SLA Breach
                              </span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-zinc-200 group-hover:text-indigo-400 transition-colors line-clamp-1">
                            {ticket.subject}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 border border-zinc-700">
                            {ticket.requester.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-zinc-300">
                              {ticket.requester}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {ticket.requesterEmail}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td className="p-4">
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td className="p-4 hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                          {ticket.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] font-medium px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-md border border-zinc-700"
                            >
                              {tag}
                            </span>
                          ))}
                          {ticket.tags.length > 2 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded-md border border-zinc-700">
                              +{ticket.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex flex-col gap-1 text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            {new Date(ticket.lastUpdated).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3" />
                            {ticket.replies} replies
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <div
                          className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors">
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-indigo-500/50 hover:shadow-lg hover:shadow-indigo-500/10 transition-all flex flex-col group relative overflow-hidden"
                  >
                    {ticket.slaBreach && (
                      <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                    )}

                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-mono text-zinc-500">
                          {ticket.id}
                        </span>
                        <StatusBadge status={ticket.status} />
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(ticket.id)}
                        onChange={() => toggleSelect(ticket.id)}
                        className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-indigo-500/50 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{
                          opacity: selectedIds.has(ticket.id) ? 1 : undefined }
                        }
                      />
                    </div>

                    <h3 className="text-sm font-medium text-zinc-200 mb-3 line-clamp-2 leading-relaxed flex-1">
                      {ticket.subject}
                    </h3>

                    <div className="flex items-center gap-2 mb-4 p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 shrink-0">
                        {ticket.requester.charAt(0)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-medium text-zinc-300 truncate">
                          {ticket.requester}
                        </span>
                        <span className="text-[10px] text-zinc-500 truncate">
                          {ticket.requesterEmail}
                        </span>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-zinc-800/80 flex items-center justify-between">
                      <PriorityBadge priority={ticket.priority} />
                      <div className="flex items-center gap-3 text-xs text-zinc-500 font-medium">
                        <div className="flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {ticket.replies}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(ticket.lastUpdated).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-zinc-800/60 bg-zinc-900/80 flex items-center justify-between shrink-0">
            <div className="text-sm text-zinc-400">
              Showing{" "}
              <span className="font-medium text-zinc-200">
                {(page - 1) * itemsPerPage + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium text-zinc-200">
                {Math.min(page * itemsPerPage, filteredTickets.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-zinc-200">
                {filteredTickets.length}
              </span>{" "}
              tickets
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="flex items-center gap-1 px-2">
                {Array.from({
                  length: Math.min(
                    5,
                    Math.ceil(filteredTickets.length / itemsPerPage),
                  ),
                }).map((_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${page === p ? "bg-indigo-600 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}
                    >
                      {p}
                    </button>
                  );
                })}
                {Math.ceil(filteredTickets.length / itemsPerPage) > 5 && (
                  <span className="text-zinc-500 px-1">...</span>
                )}
              </div>
              <button
                onClick={() =>
                  setPage((p) =>
                    Math.min(
                      Math.ceil(filteredTickets.length / itemsPerPage),
                      p + 1,
                    ),
                  )
                }
                disabled={
                  page >= Math.ceil(filteredTickets.length / itemsPerPage)
                }
                className="px-3 py-1.5 text-sm font-medium bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Internal CSS for scrollbar */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #52525b;
        }
      `
        }}
      />
    </div>
  );
}

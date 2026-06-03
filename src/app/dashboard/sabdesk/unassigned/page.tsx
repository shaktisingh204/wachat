"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Inbox,
  ArrowRight,
  Bot,
  Zap,
  Filter,
  Search,
  Clock,
  AlertTriangle,
  ShieldAlert,
  FileText,
  Settings,
  MoreVertical,
  CheckSquare,
  MessageCircle,
  Play,
} from "lucide-react";

// --- Types & Mock Data ---
type TicketSource = "email" | "web" | "api" | "chat";

interface UnassignedTicket {
  id: string;
  subject: string;
  preview: string;
  source: TicketSource;
  createdAt: Date;
  aiConfidence: number;
  aiSuggestedTeam: string;
  aiSuggestedAgent: string | null;
  priorityScore: number; // 0-100
  customerTier: "standard" | "premium" | "enterprise";
}

const TEAMS = ["L1 Support", "Billing", "Technical Escalations", "Sales"];
const AGENTS = ["Sarah K.", "Mike T.", "Elena V.", "James R."];

const generateUnassignedQueue = (count: number): UnassignedTicket[] => {
  return Array.from({ length: count })
    .map((_, i) => ({
      id: `UN-${20000 + i}`,
      subject:
        [
          "Cannot access my dashboard",
          "Invoice discrepancy for May",
          "API rate limit exceeded",
          "Upgrade inquiry",
        ][Math.floor(Math.random() * 4)] + ` #${i}`,
      preview:
        "Hi team, I am trying to login but it keeps throwing a 500 error on the main screen...",
      source: ["email", "web", "api", "chat"][
        Math.floor(Math.random() * 4)
      ] as TicketSource,
      createdAt: new Date(Date.now() - Math.random() * 3600000 * 24), // up to 24h ago
      aiConfidence: Math.floor(Math.random() * 40) + 60, // 60-99%
      aiSuggestedTeam: TEAMS[Math.floor(Math.random() * TEAMS.length)],
      aiSuggestedAgent:
        Math.random() > 0.5
          ? AGENTS[Math.floor(Math.random() * AGENTS.length)]
          : null,
      priorityScore: Math.floor(Math.random() * 100),
      customerTier: ["standard", "premium", "enterprise"][
        Math.floor(Math.random() * 3)
      ] as any,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
};

export default function UnassignedPage() {
  const [tickets, setTickets] = useState<UnassignedTicket[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UnassignedTicket | null>(
    null,
  );

  useEffect(() => {
    setTickets(generateUnassignedQueue(150));
  }, []);

  // Simulate live incoming tickets
  useEffect(() => {
    if (!isSimulating) return;
    const interval = setInterval(() => {
      if (Math.random() > 0.3) {
        const newTicket = generateUnassignedQueue(1)[0];
        newTicket.createdAt = new Date();
        setTickets((prev) =>
          [newTicket, ...prev].sort(
            (a, b) => b.priorityScore - a.priorityScore,
          ),
        );
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleAssign = (ticketId: string, agent: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    if (selectedTicket?.id === ticketId) setSelectedTicket(null);
  };

  const getTimeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-zinc-900/80 border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 z-20 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-orange-500/10 text-orange-500 rounded-xl border border-orange-500/20">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-3">
              Unassigned Queue
              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 text-xs font-bold border border-zinc-700">
                {tickets.length} pending
              </span>
            </h1>
            <p className="text-sm text-zinc-400">
              Triage and assign incoming requests
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSimulating(!isSimulating)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${isSimulating ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"}`}
          >
            {isSimulating ? (
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isSimulating ? "Stop Live Feed" : "Simulate Live Traffic"}
          </button>

          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg shadow-indigo-500/20 text-sm font-medium transition-colors">
            <Bot className="w-4 h-4" />
            Auto-Assign All
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Queue List */}
        <div className="w-full lg:w-[500px] border-r border-zinc-800 flex flex-col bg-zinc-950/50">
          <div className="p-4 border-b border-zinc-800 flex flex-col gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search queue..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500/50 text-white placeholder:text-zinc-600"
              />
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded border border-zinc-700 transition-colors">
                Sort: Priority Score
              </button>
              <button className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs font-medium rounded border border-zinc-800 transition-colors flex items-center justify-center gap-1">
                <Filter className="w-3 h-3" /> Filters
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className={`p-4 rounded-xl border transition-all cursor-pointer group ${selectedTicket?.id === ticket.id ? "bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/5" : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/80"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">
                      {ticket.id}
                    </span>
                    {ticket.customerTier === "enterprise" && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-bold uppercase tracking-wider">
                        Enterprise
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {getTimeAgo(ticket.createdAt)}
                  </div>
                </div>

                <h3
                  className={`text-sm font-medium mb-1 line-clamp-1 ${selectedTicket?.id === ticket.id ? "text-indigo-300" : "text-zinc-200"}`}
                >
                  {ticket.subject}
                </h3>

                <p className="text-xs text-zinc-500 line-clamp-2 mb-3">
                  {ticket.preview}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-950 border border-zinc-800">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      <span className="text-xs font-medium text-zinc-400">
                        Score: {ticket.priorityScore}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <Bot className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-indigo-400 font-medium">
                      {ticket.aiConfidence}% match
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {tickets.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Inbox Zero!</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Details & Triage Actions */}
        <div className="flex-1 bg-zinc-950 flex flex-col relative">
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Triage Header */}
              <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-zinc-400 bg-zinc-800 px-2 py-1 rounded">
                      {selectedTicket.id}
                    </span>
                    <span className="px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 text-xs font-medium border border-zinc-700 capitalize">
                      Source: {selectedTicket.source}
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold text-white mb-2">
                    {selectedTicket.subject}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-zinc-400">
                    <span>
                      Received {selectedTicket.createdAt.toLocaleString()}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="w-4 h-4 text-amber-500" /> Score:{" "}
                      {selectedTicket.priorityScore}/100
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* AI Suggestions Panel */}
              <div className="m-6 p-5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>

                <div className="flex items-start gap-4 relative z-10">
                  <div className="p-3 bg-indigo-500/20 rounded-lg border border-indigo-500/30 text-indigo-400">
                    <Bot className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-indigo-300 mb-1 flex items-center gap-2">
                      SabDesk AI Triage Analysis
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-200 text-[10px] uppercase">
                        Confidence: {selectedTicket.aiConfidence}%
                      </span>
                    </h3>
                    <p className="text-sm text-zinc-300 mb-4">
                      Based on historical data and semantic analysis, this issue
                      is related to technical routing and should be escalated.
                    </p>

                    <div className="flex items-center gap-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                          Suggested Team
                        </span>
                        <div className="flex items-center gap-2 text-sm text-white font-medium">
                          <Users className="w-4 h-4 text-indigo-400" />
                          {selectedTicket.aiSuggestedTeam}
                        </div>
                      </div>

                      {selectedTicket.aiSuggestedAgent && (
                        <>
                          <div className="w-px h-8 bg-zinc-700"></div>
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-zinc-400 uppercase tracking-wider font-semibold">
                              Suggested Agent
                            </span>
                            <div className="flex items-center gap-2 text-sm text-white font-medium">
                              <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-[10px]">
                                {selectedTicket.aiSuggestedAgent.charAt(0)}
                              </div>
                              {selectedTicket.aiSuggestedAgent}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() =>
                        handleAssign(
                          selectedTicket.id,
                          selectedTicket.aiSuggestedAgent || "Team",
                        )
                      }
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                    >
                      <Zap className="w-4 h-4" />
                      Apply Suggestion
                    </button>
                  </div>
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-6 pt-0">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b border-zinc-800">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400">
                      C
                    </div>
                    <div>
                      <div className="font-medium text-zinc-200">
                        Customer Name
                      </div>
                      <div className="text-sm text-zinc-500">
                        customer@example.com
                      </div>
                    </div>
                  </div>
                  <div className="prose prose-invert max-w-none text-sm text-zinc-300">
                    <p>{selectedTicket.preview}</p>
                    <p>
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                      Sed do eiusmod tempor incididunt ut labore et dolore magna
                      aliqua. Ut enim ad minim veniam, quis nostrud exercitation
                      ullamco laboris nisi ut aliquip ex ea commodo consequat.
                    </p>
                    <p>
                      Duis aute irure dolor in reprehenderit in voluptate velit
                      esse cillum dolore eu fugiat nulla pariatur. Excepteur
                      sint occaecat cupidatat non proident, sunt in culpa qui
                      officia deserunt mollit anim id est laborum.
                    </p>
                  </div>
                </div>
              </div>

              {/* Manual Assignment Footer */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-400">
                  Manual Override Assignment:
                </span>
                <div className="flex gap-2">
                  <select className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:ring-2 focus:ring-indigo-500/50 outline-none">
                    <option>Select Team...</option>
                    {TEAMS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                  <select className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:ring-2 focus:ring-indigo-500/50 outline-none">
                    <option>Select Agent...</option>
                    {AGENTS.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleAssign(selectedTicket.id, "Manual")}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 p-8">
              <div className="w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center mb-6 border border-zinc-800 shadow-inner">
                <Inbox className="w-10 h-10 text-zinc-600" />
              </div>
              <h2 className="text-xl font-medium text-zinc-300 mb-2">
                Select a ticket to triage
              </h2>
              <p className="text-center max-w-md text-sm text-zinc-500">
                Choose a ticket from the queue on the left to view details, see
                AI routing suggestions, and assign it to the appropriate team or
                agent.
              </p>
            </div>
          )}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={
          __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #52525b; }
      `,
        }
      />
    </div>
  );
}

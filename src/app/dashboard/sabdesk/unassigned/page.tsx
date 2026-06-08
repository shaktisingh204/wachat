"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Inbox,
  Bot,
  Zap,
  Filter,
  Search,
  Clock,
  AlertTriangle,
  ShieldAlert,
  MoreVertical,
  CheckSquare,
  Play,
} from "lucide-react";
import {
  Button,
  IconButton,
  Badge,
  Card,
  Field,
  Input,
  EmptyState,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/sabcrm/20ui";

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
      ] as UnassignedTicket["customerTier"],
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
};

export default function UnassignedPage() {
  const [tickets, setTickets] = useState<UnassignedTicket[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<UnassignedTicket | null>(
    null,
  );
  const [manualTeam, setManualTeam] = useState<string>("");
  const [manualAgent, setManualAgent] = useState<string>("");

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

  const handleAssign = (ticketId: string) => {
    setTickets((prev) => prev.filter((t) => t.id !== ticketId));
    if (selectedTicket?.id === ticketId) {
      setSelectedTicket(null);
      setManualTeam("");
      setManualAgent("");
    }
  };

  const getTimeAgo = (date: Date) => {
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  return (
    <div className="20ui min-h-screen flex flex-col bg-[var(--st-bg)] text-[var(--st-text)]">
      {/* Header */}
      <PageHeader className="sticky top-0 z-20 bg-[var(--st-bg-secondary)] backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span
            className="flex items-center justify-center p-2.5 rounded-[var(--st-radius)] bg-[color-mix(in_srgb,var(--st-accent)_12%,transparent)] text-[var(--st-accent)] border border-[color-mix(in_srgb,var(--st-accent)_24%,transparent)]"
            aria-hidden="true"
          >
            <Inbox className="w-6 h-6" />
          </span>
          <PageHeaderHeading>
            <PageTitle className="flex items-center gap-3">
              Unassigned Queue
              <Badge tone="neutral">{tickets.length} pending</Badge>
            </PageTitle>
            <PageDescription>
              Triage and assign incoming requests
            </PageDescription>
          </PageHeaderHeading>
        </div>

        <PageActions>
          <Button
            variant={isSimulating ? "danger" : "outline"}
            iconLeft={isSimulating ? AlertTriangle : Play}
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? "Stop Live Feed" : "Simulate Live Traffic"}
          </Button>

          <Button variant="primary" iconLeft={Bot}>
            Auto-Assign All
          </Button>
        </PageActions>
      </PageHeader>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Queue List */}
        <div className="w-full lg:w-[500px] border-r border-[var(--st-border)] flex flex-col bg-[var(--st-bg)]">
          <div className="p-4 border-b border-[var(--st-border)] flex flex-col gap-3">
            <Field label="Search queue">
              <Input
                type="text"
                placeholder="Search by subject, ID, or customer..."
                iconLeft={Search}
              />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="flex-1">
                Sort: Priority Score
              </Button>
              <Button
                variant="ghost"
                size="sm"
                iconLeft={Filter}
                className="flex-1"
              >
                Filters
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {tickets.map((ticket) => {
              const isSelected = selectedTicket?.id === ticket.id;
              return (
                <Card
                  key={ticket.id}
                  variant="interactive"
                  padding="md"
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedTicket(ticket)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedTicket(ticket);
                    }
                  }}
                  className={
                    isSelected
                      ? "border-[var(--st-accent)] bg-[color-mix(in_srgb,var(--st-accent)_8%,transparent)]"
                      : undefined
                  }
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[var(--st-text-tertiary)]">
                        {ticket.id}
                      </span>
                      {ticket.customerTier === "enterprise" && (
                        <Badge tone="warning" className="uppercase">
                          Enterprise
                        </Badge>
                      )}
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--st-text-tertiary)]">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      {getTimeAgo(ticket.createdAt)}
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-medium mb-1 line-clamp-1 ${
                      isSelected
                        ? "text-[var(--st-accent)]"
                        : "text-[var(--st-text)]"
                    }`}
                  >
                    {ticket.subject}
                  </h3>

                  <p className="text-xs text-[var(--st-text-tertiary)] line-clamp-2 mb-3">
                    {ticket.preview}
                  </p>

                  <div className="flex items-center justify-between mt-auto">
                    <Badge tone="neutral" kind="outline">
                      <Zap
                        className="w-3 h-3 text-[var(--st-warn)]"
                        aria-hidden="true"
                      />
                      Score: {ticket.priorityScore}
                    </Badge>

                    <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--st-accent)]">
                      <Bot className="w-3.5 h-3.5" aria-hidden="true" />
                      {ticket.aiConfidence}% match
                    </span>
                  </div>
                </Card>
              );
            })}

            {tickets.length === 0 && (
              <EmptyState icon={CheckSquare} title="Inbox Zero!" />
            )}
          </div>
        </div>

        {/* Right Side: Details & Triage Actions */}
        <div className="flex-1 bg-[var(--st-bg)] flex flex-col relative">
          {selectedTicket ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Triage Header */}
              <div className="p-6 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-mono text-[var(--st-text-secondary)] bg-[var(--st-bg-tertiary)] px-2 py-1 rounded-[var(--st-radius)]">
                      {selectedTicket.id}
                    </span>
                    <Badge tone="neutral" className="capitalize">
                      Source: {selectedTicket.source}
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-semibold text-[var(--st-text)] mb-2">
                    {selectedTicket.subject}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-[var(--st-text-secondary)]">
                    <span>
                      Received {selectedTicket.createdAt.toLocaleString()}
                    </span>
                    <span aria-hidden="true">-</span>
                    <span className="flex items-center gap-1">
                      <ShieldAlert
                        className="w-4 h-4 text-[var(--st-warn)]"
                        aria-hidden="true"
                      />{" "}
                      Score: {selectedTicket.priorityScore}/100
                    </span>
                  </div>
                </div>
                <IconButton
                  label="More actions"
                  icon={MoreVertical}
                  variant="ghost"
                />
              </div>

              {/* AI Suggestions Panel */}
              <Card
                variant="outlined"
                padding="lg"
                className="m-6 border-[color-mix(in_srgb,var(--st-accent)_24%,transparent)] bg-[color-mix(in_srgb,var(--st-accent)_8%,transparent)]"
              >
                <div className="flex items-start gap-4">
                  <span
                    className="flex items-center justify-center p-3 rounded-[var(--st-radius)] bg-[color-mix(in_srgb,var(--st-accent)_18%,transparent)] border border-[color-mix(in_srgb,var(--st-accent)_30%,transparent)] text-[var(--st-accent)]"
                    aria-hidden="true"
                  >
                    <Bot className="w-6 h-6" />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-[var(--st-accent)] mb-1 flex items-center gap-2">
                      SabDesk AI Triage Analysis
                      <Badge tone="accent" className="uppercase">
                        Confidence: {selectedTicket.aiConfidence}%
                      </Badge>
                    </h3>
                    <p className="text-sm text-[var(--st-text-secondary)] mb-4">
                      Based on historical data and semantic analysis, this issue
                      is related to technical routing and should be escalated.
                    </p>

                    <div className="flex items-center gap-6">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider font-semibold">
                          Suggested Team
                        </span>
                        <span className="flex items-center gap-2 text-sm text-[var(--st-text)] font-medium">
                          <Users
                            className="w-4 h-4 text-[var(--st-accent)]"
                            aria-hidden="true"
                          />
                          {selectedTicket.aiSuggestedTeam}
                        </span>
                      </div>

                      {selectedTicket.aiSuggestedAgent && (
                        <>
                          <span
                            className="w-px h-8 bg-[var(--st-border)]"
                            aria-hidden="true"
                          />
                          <div className="flex flex-col gap-1">
                            <span className="text-xs text-[var(--st-text-tertiary)] uppercase tracking-wider font-semibold">
                              Suggested Agent
                            </span>
                            <span className="flex items-center gap-2 text-sm text-[var(--st-text)] font-medium">
                              <span
                                className="w-5 h-5 rounded-full bg-[var(--st-accent)] text-white flex items-center justify-center text-[10px]"
                                aria-hidden="true"
                              >
                                {selectedTicket.aiSuggestedAgent.charAt(0)}
                              </span>
                              {selectedTicket.aiSuggestedAgent}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    iconLeft={Zap}
                    onClick={() => handleAssign(selectedTicket.id)}
                  >
                    Apply Suggestion
                  </Button>
                </div>
              </Card>

              {/* Message Content */}
              <div className="flex-1 overflow-y-auto p-6 pt-0">
                <Card variant="outlined" padding="lg">
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b border-[var(--st-border)]">
                    <span
                      className="w-10 h-10 rounded-full bg-[var(--st-bg-tertiary)] flex items-center justify-center font-bold text-[var(--st-text-secondary)]"
                      aria-hidden="true"
                    >
                      C
                    </span>
                    <div>
                      <div className="font-medium text-[var(--st-text)]">
                        Customer Name
                      </div>
                      <div className="text-sm text-[var(--st-text-tertiary)]">
                        customer@example.com
                      </div>
                    </div>
                  </div>
                  <div className="max-w-none text-sm text-[var(--st-text-secondary)] space-y-3">
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
                </Card>
              </div>

              {/* Manual Assignment Footer */}
              <div className="p-4 border-t border-[var(--st-border)] bg-[var(--st-bg-secondary)] backdrop-blur flex items-center justify-between">
                <span className="text-sm font-medium text-[var(--st-text-secondary)]">
                  Manual Override Assignment:
                </span>
                <div className="flex gap-2 items-center">
                  <Select value={manualTeam} onValueChange={setManualTeam}>
                    <SelectTrigger aria-label="Select team">
                      <SelectValue placeholder="Select Team..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAMS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={manualAgent} onValueChange={setManualAgent}>
                    <SelectTrigger aria-label="Select agent">
                      <SelectValue placeholder="Select Agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENTS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="secondary"
                    onClick={() => handleAssign(selectedTicket.id)}
                  >
                    Assign
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyState
                icon={Inbox}
                title="Select a ticket to triage"
                description="Choose a ticket from the queue on the left to view details, see AI routing suggestions, and assign it to the appropriate team or agent."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

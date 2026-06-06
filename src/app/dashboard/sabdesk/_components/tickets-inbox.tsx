"use client";

import * as React from "react";
import { Card, Badge, Input, ScrollArea } from '@/components/sabcrm/20ui';
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";
import { Search } from "lucide-react";
import { TicketDetailClient } from "./ticket-detail-client";

interface TicketsInboxProps {
  tickets: CrmTicketDoc[];
}

export function TicketsInbox({ tickets }: TicketsInboxProps) {
  const [selectedTicketId, setSelectedTicketId] = React.useState<string | null>(
    tickets.length > 0 ? String(tickets[0]._id) : null,
  );
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!search) return tickets;
    const q = search.toLowerCase();
    return tickets.filter((t) => (t.subject || "").toLowerCase().includes(q));
  }, [tickets, search]);

  const selectedTicket = React.useMemo(() => {
    return tickets.find((t) => String(t._id) === selectedTicketId) || null;
  }, [tickets, selectedTicketId]);

  if (tickets.length === 0) {
    return (
      <Card className="p-6 text-center text-[13px] text-[var(--st-text-secondary)]">
        No tickets found for your inbox.
      </Card>
    );
  }

  return (
    <Card className="flex h-[calc(100vh-200px)] min-h-[600px] flex-row overflow-hidden p-0">
      {/* Left rail - Ticket list */}
      <div className="flex w-80 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-muted)]/30">
        <div className="border-b border-[var(--st-border)] p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
            <Input
              placeholder="Filter inbox..."
              className="h-8 w-full pl-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul className="flex flex-col divide-y divide-[var(--st-border)]">
            {filtered.map((t) => {
              const id = String(t._id);
              const isActive = selectedTicketId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTicketId(id)}
                    className={[
                      "flex w-full flex-col gap-1 p-3 text-left transition-colors",
                      isActive
                        ? "bg-[var(--st-bg-secondary)] shadow-sm"
                        : "hover:bg-[var(--st-bg-secondary)]/50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
                        {t.subject || "Untitled"}
                      </span>
                      {t.status ? (
                        <Badge
                          variant="ghost"
                          className="text-[10px] uppercase"
                        >
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--st-text-secondary)]">
                      <span className="truncate">
                        {t.requesterId
                          ? `Requester: ${t.requesterId.slice(-6)}`
                          : "No requester"}
                      </span>
                      <span>
                        {t.createdAt
                          ? new Date(t.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="p-4 text-center text-xs text-[var(--st-text-secondary)]">
                No matches.
              </li>
            )}
          </ul>
        </div>
      </div>

      {/* Main pane - Ticket detail */}
      <div className="flex-1 overflow-y-auto bg-[var(--st-bg-secondary)] p-6">
        {selectedTicket ? (
          <div className="w-full space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--st-text)]">
                {selectedTicket.subject}
              </h2>
              {selectedTicket.priority && (
                <Badge variant="secondary">{selectedTicket.priority}</Badge>
              )}
            </div>
            {/* We reuse the Client Interactive portion of the ticket page here */}
            <TicketDetailClient ticket={selectedTicket} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--st-text-secondary)]">
            Select a ticket to view details
          </div>
        )}
      </div>
    </Card>
  );
}

export default TicketsInbox;

"use client";

import * as React from "react";
import {
  Card,
  Badge,
  Button,
  Field,
  Input,
  EmptyState,
} from "@/components/sabcrm/20ui";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";
import { Search, Inbox } from "lucide-react";
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
      <Card padding="lg">
        <EmptyState
          icon={Inbox}
          title="No tickets found"
          description="There are no tickets in your inbox right now. New requests will appear here."
        />
      </Card>
    );
  }

  return (
    <Card
      padding="none"
      className="flex h-[calc(100vh-200px)] min-h-[600px] flex-row overflow-hidden"
    >
      {/* Left rail - Ticket list */}
      <div className="flex w-80 flex-col border-r border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <div className="border-b border-[var(--st-border)] p-3">
          <Field label="Filter inbox" className="[&>.u-field__label]:sr-only">
            <Input
              inputSize="sm"
              iconLeft={Search}
              placeholder="Filter inbox..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex-1 overflow-y-auto">
          <ul className="flex flex-col divide-y divide-[var(--st-border)]">
            {filtered.map((t) => {
              const id = String(t._id);
              const isActive = selectedTicketId === id;
              return (
                <li key={id}>
                  <Button
                    variant="ghost"
                    block
                    aria-pressed={isActive}
                    onClick={() => setSelectedTicketId(id)}
                    className={[
                      "!h-auto !justify-start !rounded-none !px-3 !py-3 text-left [&>.u-btn__label]:w-full [&>.u-btn__label]:flex-1",
                      isActive
                        ? "!bg-[var(--st-bg)] shadow-sm"
                        : "",
                    ].join(" ")}
                  >
                    <span className="flex w-full flex-col gap-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-[var(--st-text)]">
                          {t.subject || "Untitled"}
                        </span>
                        {t.status ? (
                          <Badge kind="outline" className="text-[10px] uppercase">
                            {t.status.replace(/_/g, " ")}
                          </Badge>
                        ) : null}
                      </span>
                      <span className="flex items-center justify-between gap-2 text-[11px] text-[var(--st-text-secondary)]">
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
                      </span>
                    </span>
                  </Button>
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
      <div className="flex-1 overflow-y-auto bg-[var(--st-bg)] p-6">
        {selectedTicket ? (
          <div className="w-full space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-[var(--st-text)]">
                {selectedTicket.subject}
              </h2>
              {selectedTicket.priority ? (
                <Badge tone="neutral">{selectedTicket.priority}</Badge>
              ) : null}
            </div>
            {/* Reuse the interactive client portion of the ticket page here */}
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

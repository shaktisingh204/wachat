import { Alert, Badge, Card, EmptyState, type BadgeTone } from '@/components/sabcrm/20ui';
import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";

/**
 * Ticket activity — `/dashboard/sabdesk/[id]/activity` (§1D.2).
 *
 * Renders the timestamped audit + assignment + note history for the
 * ticket as a single chronological feed. Source-of-truth is the ticket
 * doc itself — `audit`, `assignment`, and `internalNotes`. A richer
 * activity-log table can swap in later without changing this page's
 * route.
 */

import { EntityDetailShell } from "@/components/crm/entity-detail-shell";
import { EntityPickerChip } from "@/components/crm/entity-picker";
import { getTicket } from "@/app/actions/crm/tickets.actions";
import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from "@/app/actions/user.actions";
import { ObjectId } from "mongodb";

export const dynamic = "force-dynamic";

interface ActivityEntry {
  id: string;
  ts: string;
  label: string;
  body?: string;
  actorId?: string;
  kind: "note" | "system";
  tone?: BadgeTone;
}

function fmt(ts?: string): string {
  if (!ts) return "-";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

export default async function TicketActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { ticket, error } = await getTicket(id);

  if (!ticket) {
    if (error) {
      return (
        <div className="flex w-full flex-col gap-4 p-6">
          <Alert tone="danger" title="Could not load activity">
            {error}
          </Alert>
        </div>
      );
    }
    notFound();
  }

  const entries: ActivityEntry[] = [];
  const session = await getSession();

  if (session?.user) {
    try {
      const { db } = await connectToDatabase();
      const auditLogs = await db
        .collection("crm_audit_log")
        .find({
          userId: new ObjectId(String(session.user._id)),
          entityKind: "ticket",
          entityId: id,
        })
        .sort({ createdAt: -1 })
        .toArray();

      for (const log of auditLogs) {
        entries.push({
          id: String(log._id),
          ts: log.createdAt
            ? new Date(log.createdAt).toISOString()
            : new Date().toISOString(),
          label:
            log.action === "create"
              ? "Ticket created"
              : log.action === "update"
                ? "Ticket updated"
                : `Action: ${log.action}`,
          actorId: log.actorId ? String(log.actorId) : undefined,
          kind: "system",
          tone: log.action === "create" ? "info" : "neutral",
          body: log.reason ?? undefined,
        });
      }
    } catch (e) {
      console.error("[TicketActivityPage] failed to fetch audit logs:", e);
    }
  }

  // Still include internalNotes if any
  if (Array.isArray(ticket.internalNotes)) {
    for (const [idx, n] of (ticket.internalNotes as unknown[]).entries()) {
      const obj = (n ?? {}) as Record<string, unknown>;
      const body = String(obj.body ?? obj.text ?? "");
      if (!body) continue;
      entries.push({
        id: `note_${idx}`,
        ts: String(obj.createdAt ?? obj.ts ?? new Date(0).toISOString()),
        label: obj.kind === "public" ? "Public reply" : "Internal note",
        body,
        actorId: obj.authorId ? String(obj.authorId) : undefined,
        kind: "note",
        tone: obj.kind === "public" ? "info" : "warning",
      });
    }
  }

  entries.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());

  return (
    <EntityDetailShell
      eyebrow="TICKET"
      title={`Activity - ${ticket.subject || "Ticket"}`}
      back={{
        href: `/dashboard/sabdesk/${String(ticket._id)}`,
        label: "Back to ticket",
      }}
    >
      <Card padding="md">
        {entries.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title="No activity recorded yet"
            description="Audit events, assignments, and notes for this ticket will appear here as they happen."
          />
        ) : (
          <ol className="flex flex-col gap-3">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
              >
                <div className="shrink-0">
                  <Badge tone={e.tone ?? "neutral"}>{e.label}</Badge>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[11.5px] text-[var(--st-text-secondary)]">
                    <span>{fmt(e.ts)}</span>
                    {e.actorId ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <EntityPickerChip entity="user" id={e.actorId} />
                      </>
                    ) : null}
                  </div>
                  {e.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                      {e.body}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </EntityDetailShell>
  );
}

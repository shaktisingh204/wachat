import { Badge } from '@/components/sabcrm/20ui';
import { getTicket } from "@/app/actions/crm/tickets.actions";

function fmtDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
}

interface ConversationNote {
  id: string;
  body: string;
  kind: "public" | "internal";
  createdAt: string;
  authorId?: string;
}

export async function TicketConversationThread({
  ticketId,
}: {
  ticketId: string;
}) {
  const { ticket } = await getTicket(ticketId);
  if (!ticket) return null;

  const raw = Array.isArray(ticket.internalNotes)
    ? (ticket.internalNotes as unknown[])
    : [];
  const notes = raw
    .map((n, idx): ConversationNote => {
      const obj = (n ?? {}) as Record<string, unknown>;
      return {
        id: String(obj.id ?? idx),
        body: String(obj.body ?? obj.text ?? ""),
        kind: obj.kind === "public" ? "public" : "internal",
        createdAt: String(obj.createdAt ?? obj.ts ?? new Date().toISOString()),
        authorId: obj.authorId ? String(obj.authorId) : undefined,
      };
    })
    .filter((n) => n.body.length > 0);

  return (
    <ul className="flex flex-col gap-2">
      {notes.length === 0 ? (
        <li className="rounded-md border border-dashed border-[var(--st-border)] p-3 text-center text-[12.5px] text-[var(--st-text-secondary)]">
          No replies yet.
        </li>
      ) : (
        notes.map((n) => (
          <li
            key={n.id}
            className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/50 p-3"
          >
            <div className="mb-1 flex items-center gap-2">
              <Badge variant={n.kind === "internal" ? "warning" : "info"}>
                {n.kind === "internal" ? "Internal" : "Public"}
              </Badge>
              <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                {fmtDate(n.createdAt)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
              {n.body}
            </p>
          </li>
        ))
      )}
    </ul>
  );
}

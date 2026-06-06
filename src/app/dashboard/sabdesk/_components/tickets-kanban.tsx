"use client";

import { Badge, Card } from "@/components/zoruui";
import { AlertTriangle } from "lucide-react";

/**
 * <TicketsKanban> — Kanban-by-status view (§1D.1 view switcher).
 *
 * Four columns: Open · Pending · Resolved · Closed. Each card carries
 * the subject, priority dot, due-by indicator, and a link into the
 * detail page. Pure presentation; no drag-and-drop here yet — status
 * changes happen on the detail page.
 */

import * as React from "react";
import Link from "next/link";

import { EntityPickerChip } from "@/components/crm/entity-picker";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

const COLUMNS: { id: string; label: string; statuses: string[] }[] = [
  { id: "open", label: "Open", statuses: ["open", "reopened"] },
  { id: "pending", label: "Pending", statuses: ["pending", "on_hold"] },
  { id: "resolved", label: "Resolved", statuses: ["resolved"] },
  { id: "closed", label: "Closed", statuses: ["closed"] },
];

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-[var(--st-text-tertiary)]",
  medium: "bg-[var(--st-status-ok)]",
  high: "bg-[var(--st-warn)]",
  critical: "bg-[var(--st-danger)]",
};

interface TicketsKanbanProps {
  tickets: CrmTicketDoc[];
}

function isOverdue(t: CrmTicketDoc): boolean {
  const due = t.dueBy ? new Date(t.dueBy).getTime() : NaN;
  if (!Number.isFinite(due)) return false;
  const status = String(t.status ?? "").toLowerCase();
  if (status === "resolved" || status === "closed") return false;
  return due < Date.now();
}

export function TicketsKanban({ tickets }: TicketsKanbanProps) {
  const groups = React.useMemo(() => {
    const buckets: Record<string, CrmTicketDoc[]> = {};
    for (const col of COLUMNS) buckets[col.id] = [];
    for (const t of tickets) {
      const s = String(t.status ?? "").toLowerCase();
      const col = COLUMNS.find((c) => c.statuses.includes(s));
      if (col) buckets[col.id].push(t);
    }
    return buckets;
  }, [tickets]);

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = groups[col.id] ?? [];
        return (
          <div
            key={col.id}
            className="flex flex-col gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)]/30 p-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                {col.label}
              </h3>
              <Badge variant="ghost">{items.length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--st-border)] p-3 text-center text-[12px] text-[var(--st-text-secondary)]">
                  No tickets
                </p>
              ) : (
                items.map((t) => {
                  const id = String(t._id);
                  const overdue = isOverdue(t);
                  const priority = String(t.priority ?? "").toLowerCase();
                  return (
                    <Card key={id} className="p-3">
                      <Link
                        href={`/dashboard/sabdesk/${id}`}
                        className="flex flex-col gap-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-medium text-[var(--st-text)] hover:underline">
                            {t.subject || "Untitled"}
                          </p>
                          <span
                            className={[
                              "mt-1 h-2 w-2 shrink-0 rounded-full",
                              PRIORITY_DOT[priority] ?? "bg-[var(--st-text-tertiary)]",
                            ].join(" ")}
                            title={`Priority: ${priority || "none"}`}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                          {t.assigneeId ? (
                            <EntityPickerChip
                              entity="user"
                              id={t.assigneeId}
                              fallback="—"
                            />
                          ) : (
                            <span>Unassigned</span>
                          )}
                        </div>
                        {t.dueBy ? (
                          <span
                            className={[
                              "inline-flex items-center gap-1 text-[11.5px]",
                              overdue
                                ? "text-[var(--st-danger)]"
                                : "text-[var(--st-text-secondary)]",
                            ].join(" ")}
                          >
                            {overdue ? (
                              <AlertTriangle className="h-3 w-3" />
                            ) : null}
                            Due {new Date(t.dueBy).toLocaleDateString()}
                          </span>
                        ) : null}
                      </Link>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default TicketsKanban;

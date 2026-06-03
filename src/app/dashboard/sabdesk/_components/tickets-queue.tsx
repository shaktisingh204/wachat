"use client";

import { Badge, Card } from "@/components/zoruui";
import { AlertTriangle } from "lucide-react";

/**
 * <TicketsQueue> — queue view grouped by assignee (§1D.1 view switcher).
 *
 * Renders one card per agent (assignee), with active-WIP count badge
 * and a row per ticket. Unassigned tickets get their own bucket at the
 * top so SLA-at-risk work is visible.
 */

import * as React from "react";
import Link from "next/link";

import { EntityPickerChip } from "@/components/crm/entity-picker";
import { StatusPill, statusToTone } from "@/components/crm/status-pill";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

interface TicketsQueueProps {
  tickets: CrmTicketDoc[];
}

function isOverdue(t: CrmTicketDoc): boolean {
  const due = t.dueBy ? new Date(t.dueBy).getTime() : NaN;
  if (!Number.isFinite(due)) return false;
  const status = String(t.status ?? "").toLowerCase();
  if (status === "resolved" || status === "closed") return false;
  return due < Date.now();
}

function isActive(t: CrmTicketDoc): boolean {
  const status = String(t.status ?? "").toLowerCase();
  return status !== "resolved" && status !== "closed";
}

export function TicketsQueue({ tickets }: TicketsQueueProps) {
  const groups = React.useMemo(() => {
    const buckets = new Map<string, CrmTicketDoc[]>();
    for (const t of tickets) {
      const key = t.assigneeId ? String(t.assigneeId) : "__unassigned__";
      const arr = buckets.get(key) ?? [];
      arr.push(t);
      buckets.set(key, arr);
    }
    // Unassigned first, then by descending active count.
    const entries = Array.from(buckets.entries()).sort((a, b) => {
      if (a[0] === "__unassigned__") return -1;
      if (b[0] === "__unassigned__") return 1;
      const activeA = a[1].filter(isActive).length;
      const activeB = b[1].filter(isActive).length;
      return activeB - activeA;
    });
    return entries;
  }, [tickets]);

  if (tickets.length === 0) {
    return (
      <Card className="p-6 text-center text-[13px] text-zoru-ink-muted">
        No tickets match the current filters.
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(([assigneeId, items]) => {
        const wip = items.filter(isActive).length;
        const overdue = items.filter(isOverdue).length;
        const unassigned = assigneeId === "__unassigned__";
        return (
          <Card key={assigneeId} className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {unassigned ? (
                  <span className="text-[13px] font-semibold text-zoru-ink">
                    Unassigned
                  </span>
                ) : (
                  <EntityPickerChip
                    entity="user"
                    id={assigneeId}
                    fallback={`Agent ${assigneeId.slice(-6)}`}
                  />
                )}
                <Badge variant="info">{wip} WIP</Badge>
                {overdue > 0 ? (
                  <Badge variant="danger">{overdue} overdue</Badge>
                ) : null}
              </div>
              <p className="text-[11.5px] text-zoru-ink-muted">
                {items.length} total
              </p>
            </div>
            <ul className="flex flex-col divide-y divide-zoru-line">
              {items.map((t) => {
                const id = String(t._id);
                const overdueRow = isOverdue(t);
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between py-2"
                  >
                    <Link
                      href={`/dashboard/sabdesk/${id}`}
                      className="min-w-0 flex-1 truncate text-[13px] text-zoru-ink hover:underline"
                    >
                      {t.subject || "Untitled"}
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.status ? (
                        <StatusPill
                          label={t.status.replace(/_/g, " ")}
                          tone={statusToTone(t.status)}
                        />
                      ) : null}
                      {t.dueBy ? (
                        <span
                          className={[
                            "inline-flex items-center gap-1 text-[11.5px]",
                            overdueRow
                              ? "text-zoru-danger-ink"
                              : "text-zoru-ink-muted",
                          ].join(" ")}
                        >
                          {overdueRow ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : null}
                          {new Date(t.dueBy).toLocaleDateString()}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

export default TicketsQueue;

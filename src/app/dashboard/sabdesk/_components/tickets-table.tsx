"use client";

import {
  Badge,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
  Skeleton,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type BadgeTone,
} from "@/components/sabcrm/20ui";
import {
  AlertTriangle,
  ChevronDown,
  Edit,
  LifeBuoy,
  MoreHorizontal,
  Trash2,
  Combine,
} from "lucide-react";

/**
 * <TicketsTable> - dense table view for the Tickets list (1D.1).
 *
 * 13 columns: select, #, Subject (chip), Requester (polymorphic
 * chip), Channel, Category, Priority, Severity, Status, Assignee,
 * Due by, Created, Actions.
 *
 * `Due by` cell turns red when overdue (past + not resolved). Status
 * cell uses `StatusPill` (statusToTone). Per-row dropdown supplies the
 * standard view / edit / merge / delete actions.
 */

import * as React from "react";
import Link from "next/link";

import { EntityPickerChip } from "@/components/crm/entity-picker";
import { EntityRowLink } from "@/components/crm/entity-row-link";
import { StatusPill, statusToTone } from "@/components/crm/status-pill";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";
import type { TicketRequesterKind } from "./tickets-filters";

const PRIORITY_TONES: Record<string, BadgeTone> = {
  low: "neutral",
  medium: "success",
  high: "warning",
  critical: "danger",
};

const MONTHS = [
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

const EMPTY = "-";

interface TicketsTableProps {
  tickets: CrmTicketDoc[];
  loading: boolean;
  selectedIds: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  onDelete: (id: string) => void;
  onMerge: (id: string) => void;
  /** Look up the polymorphic requester kind for a ticket. */
  requesterKindOf: (t: CrmTicketDoc) => TicketRequesterKind;
}

function isOverdue(t: CrmTicketDoc): boolean {
  const due = t.dueBy ? new Date(t.dueBy).getTime() : NaN;
  if (!Number.isFinite(due)) return false;
  const status = String(t.status ?? "").toLowerCase();
  if (status === "resolved" || status === "closed") return false;
  return due < Date.now();
}

function ticketNumber(t: CrmTicketDoc): string {
  const id = String(t._id);
  return `#${id.slice(-6).toUpperCase()}`;
}

function formatDate(value: unknown): string {
  if (!value) return EMPTY;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function formatDateTimeTitle(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes} UTC`;
}

export function TicketsTable({
  tickets,
  loading,
  selectedIds,
  onToggleOne,
  onToggleAll,
  onDelete,
  onMerge,
  requesterKindOf,
}: TicketsTableProps) {
  const allSelected =
    tickets.length > 0 && tickets.every((t) => selectedIds.has(String(t._id)));
  const someSelected =
    !allSelected && tickets.some((t) => selectedIds.has(String(t._id)));

  return (
    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
      <Table>
        <THead>
          <Tr className="border-[var(--st-border)] hover:bg-transparent">
            <Th className="w-[36px]">
              <Checkbox
                aria-label="Select all tickets on this page"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
              />
            </Th>
            <Th>#</Th>
            <Th>Subject</Th>
            <Th>Requester</Th>
            <Th>Channel</Th>
            <Th>Category</Th>
            <Th>Priority</Th>
            <Th>Severity</Th>
            <Th>Status</Th>
            <Th>Assignee</Th>
            <Th>Due by</Th>
            <Th>Created</Th>
            <Th className="text-right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Tr key={i} className="border-[var(--st-border)]">
                <Td colSpan={13}>
                  <Skeleton className="h-10 w-full" />
                </Td>
              </Tr>
            ))
          ) : tickets.length === 0 ? (
            <Tr className="border-[var(--st-border)]">
              <Td
                colSpan={13}
                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                No tickets match the current filters.
              </Td>
            </Tr>
          ) : (
            tickets.map((t) => {
              const id = String(t._id);
              const isSel = selectedIds.has(id);
              const priority = String(t.priority ?? "").toLowerCase();
              const overdue = isOverdue(t);
              const status = t.status ?? "";
              const kind = requesterKindOf(t);
              return (
                <Tr
                  key={id}
                  selected={isSel}
                  className="border-[var(--st-border)] transition-colors"
                >
                  <Td>
                    <Checkbox
                      aria-label={`Select ticket ${t.subject || id}`}
                      checked={isSel}
                      onChange={() => onToggleOne(id)}
                    />
                  </Td>
                  <Td className="font-mono text-[12px] text-[var(--st-text-secondary)]">
                    {ticketNumber(t)}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-secondary)] text-[var(--st-text-secondary)]">
                        <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                      <EntityRowLink
                        href={`/dashboard/sabdesk/${id}`}
                        label={
                          <span className="block max-w-[280px] truncate text-[13px]">
                            {t.subject || "Untitled"}
                          </span>
                        }
                        subtitle={t.category || undefined}
                      />
                    </div>
                  </Td>
                  <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {t.requesterId ? (
                      <EntityPickerChip entity={kind} id={t.requesterId} />
                    ) : (
                      EMPTY
                    )}
                  </Td>
                  <Td>
                    {t.channel ? (
                      <Badge variant="secondary">{t.channel}</Badge>
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {EMPTY}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {t.category ? (
                      <EntityPickerChip entity="category" id={t.category} />
                    ) : (
                      EMPTY
                    )}
                  </Td>
                  <Td>
                    {priority ? (
                      <Badge tone={PRIORITY_TONES[priority] ?? "neutral"}>
                        {priority}
                      </Badge>
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {EMPTY}
                      </span>
                    )}
                  </Td>
                  <Td className="text-[12.5px] uppercase text-[var(--st-text-secondary)]">
                    {t.severity ?? EMPTY}
                  </Td>
                  <Td>
                    {status ? (
                      <StatusPill
                        label={status.replace(/_/g, " ")}
                        tone={statusToTone(status)}
                      />
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        {EMPTY}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {t.assigneeId ? (
                      <EntityPickerChip
                        entity="user"
                        id={t.assigneeId}
                        fallback="Unassigned"
                      />
                    ) : (
                      <span className="text-[12px] text-[var(--st-text-secondary)]">
                        Unassigned
                      </span>
                    )}
                  </Td>
                  <Td
                    className={[
                      "text-[12.5px]",
                      overdue
                        ? "font-medium text-[var(--st-danger)]"
                        : "text-[var(--st-text-secondary)]",
                    ].join(" ")}
                  >
                    {t.dueBy ? (
                      <span className="inline-flex items-center gap-1">
                        {overdue ? (
                          <AlertTriangle
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : null}
                        {formatDate(t.dueBy)}
                      </span>
                    ) : (
                      EMPTY
                    )}
                  </Td>
                  <Td
                    className="text-[12.5px] text-[var(--st-text-secondary)]"
                    title={formatDateTimeTitle(t.createdAt)}
                  >
                    {formatDate(t.createdAt)}
                  </Td>
                  <Td className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          label={`Actions for ${t.subject || id}`}
                          icon={MoreHorizontal}
                          variant="ghost"
                          size="sm"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/sabdesk/${id}`}>
                            <ChevronDown
                              className="mr-1.5 h-3.5 w-3.5 rotate-[-90deg]"
                              aria-hidden="true"
                            />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/sabdesk/${id}/edit`}>
                            <Edit
                              className="mr-1.5 h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          iconLeft={Combine}
                          onClick={() => onMerge(id)}
                        >
                          Merge...
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="danger"
                          iconLeft={Trash2}
                          onClick={() => onDelete(id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Td>
                </Tr>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}

export default TicketsTable;

"use client";

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  Input,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from "@/components/zoruui";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  AlertCircle,
  Pencil,
  Search,
  Trash2,
  LoaderCircle,
} from "lucide-react";

/**
 * Client side of the Tickets list — owns the search box, the table, and
 * the hard-delete confirmation dialog. Search input is debounced and
 * writes back to the URL so the server component re-fetches.
 */

import * as React from "react";
import Link from "next/link";

import { PaginationBar } from "@/components/crm/pagination-bar";
import { EntityPickerChip } from "@/components/crm/entity-picker";
import { deleteTicketAction } from "@/app/actions/crm/tickets.actions";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

interface TicketListClientProps {
  tickets: CrmTicketDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

type BadgeVariant = React.ComponentProps<typeof ZoruBadge>["variant"];

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  open: "warning",
  pending: "ghost",
  on_hold: "ghost",
  resolved: "success",
  closed: "ghost",
  reopened: "warning",
};

const PRIORITY_VARIANTS: Record<string, BadgeVariant> = {
  low: "ghost",
  medium: "success",
  high: "warning",
  critical: "danger",
};

function statusLabel(s?: string): string {
  if (!s) return "";
  return s.replace(/_/g, " ");
}

function fmtDate(v?: string): string {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function TicketListClient({
  tickets,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: TicketListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] = React.useState<CrmTicketDoc | null>(
    null,
  );
  const [deleting, startDelete] = React.useTransition();

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? "");
      if (query.trim()) params.set("q", query.trim());
      else params.delete("q");
      params.set("page", "1");
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const subject = pendingDelete.subject || "Ticket";
    startDelete(async () => {
      const res = await deleteTicketAction(id);
      if (res.success) {
        toast({ title: "Deleted", description: `${subject} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({
          title: "Delete failed",
          description: res.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--st-border)] p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by subject or category…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-4 py-2.5 text-[13px] text-[var(--st-text)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <Table>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Subject</ZoruTableHead>
            <ZoruTableHead>Client</ZoruTableHead>
            <ZoruTableHead>Category</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead>Priority</ZoruTableHead>
            <ZoruTableHead>Severity</ZoruTableHead>
            <ZoruTableHead>Assignee</ZoruTableHead>
            <ZoruTableHead>Created</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {tickets.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={9}
                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                {initialQuery
                  ? "No tickets match this search."
                  : 'No tickets yet — click "New ticket" to add one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            tickets.map((ticket) => {
              const id = String(ticket._id);
              const status = ticket.status ?? "";
              const priority = ticket.priority ?? "";
              const statusVariant = STATUS_VARIANTS[status] ?? "ghost";
              const priorityVariant = PRIORITY_VARIANTS[priority] ?? "ghost";
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/sabdesk/${id}`}
                      className="font-medium text-[var(--st-text)] hover:underline"
                    >
                      {ticket.subject || "Untitled"}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {ticket.requesterId ? (
                      <EntityPickerChip
                        entity="client"
                        id={ticket.requesterId}
                      />
                    ) : (
                      "—"
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {ticket.category ? (
                      <EntityPickerChip
                        entity="category"
                        id={ticket.category}
                      />
                    ) : (
                      "—"
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {status ? (
                      <Badge variant={statusVariant}>
                        {statusLabel(status)}
                      </Badge>
                    ) : (
                      <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                        —
                      </span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {priority ? (
                      <Badge variant={priorityVariant}>{priority}</Badge>
                    ) : (
                      <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                        —
                      </span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] uppercase text-[var(--st-text-secondary)]">
                    {ticket.severity ?? "—"}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {ticket.assigneeId ? (
                      <EntityPickerChip entity="user" id={ticket.assigneeId} />
                    ) : (
                      "—"
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-[var(--st-text-secondary)]">
                    {fmtDate(ticket.createdAt || ticket.audit?.createdAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/sabdesk/${id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(ticket)}
                        className="text-[var(--st-danger)]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </Table>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete ticket?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes{" "}
              <strong>{pendingDelete?.subject || "this ticket"}</strong> from
              the database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>
              Cancel
            </ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
            >
              {deleting ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </Card>
  );
}

"use client";

import { Button, Popover, PopoverContent, PopoverTrigger, useToast } from '@/components/sabcrm/20ui';
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  Combine,
  Forward,
  Lock,
  Mail,
  Pencil,
  Printer,
  Reply,
  RotateCcw,
  UserPlus,
} from "lucide-react";

/**
 * <TicketDetailActions> — header action group for the ticket detail
 * page (§1D.2 — 10 actions).
 *
 *   Edit · Reply · Forward · Assign · Merge · Resolve · Close ·
 *   Re-open · Print · Activity.
 *
 * Status changes (Resolve / Close / Re-open) optimistically call
 * `updateTicket` and refresh the page; failures toast and revert.
 */

import * as React from "react";
import Link from "next/link";

import { EntityFormField } from "@/components/crm/entity-form-field";
import { updateTicket } from "@/app/actions/crm/tickets.actions";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

interface TicketDetailActionsProps {
  ticket: CrmTicketDoc;
  onReplyClick: () => void;
  onForwardClick: () => void;
  onMergeClick: () => void;
}

export function TicketDetailActions({
  ticket,
  onReplyClick,
  onForwardClick,
  onMergeClick,
}: TicketDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const id = String(ticket._id);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const status = String(ticket.status ?? "").toLowerCase();
  const resolvedish = status === "resolved" || status === "closed";

  const runStatusChange = (next: string, label: string) =>
    startTransition(async () => {
      try {
        await updateTicket(id, { status: next });
        toast({ title: `${label} — ticket updated` });
        router.refresh();
      } catch (e) {
        toast({
          title: `${label} failed`,
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      }
    });

  const runAssign = (userId: string | null) =>
    startTransition(async () => {
      try {
        await updateTicket(id, { assigneeId: userId ?? "" });
        toast({ title: userId ? "Assignee updated" : "Unassigned" });
        router.refresh();
      } catch (e) {
        toast({
          title: "Assign failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setAssignOpen(false);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/sabdesk/${id}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>
      <Button variant="outline" size="sm" onClick={onReplyClick}>
        <Reply className="h-3.5 w-3.5" /> Reply
      </Button>
      <Button variant="outline" size="sm" onClick={onForwardClick}>
        <Forward className="h-3.5 w-3.5" /> Forward
      </Button>

      <Popover open={assignOpen} onOpenChange={setAssignOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <UserPlus className="h-3.5 w-3.5" /> Assign
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-2">
          <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
            Assign agent
          </p>
          <EntityFormField
            entity="user"
            name="assignAgent"
            initialId={ticket.assigneeId ?? null}
            placeholder="Pick a user…"
            onChange={(next) => runAssign(next)}
          />
          <button
            type="button"
            className="text-[12px] text-[var(--st-text-secondary)] hover:underline"
            onClick={() => runAssign(null)}
          >
            Unassign
          </button>
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" onClick={onMergeClick}>
        <Combine className="h-3.5 w-3.5" /> Merge
      </Button>

      {!resolvedish ? (
        <Button
          size="sm"
          onClick={() => runStatusChange("resolved", "Resolved")}
          disabled={pending}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
        </Button>
      ) : null}
      {status !== "closed" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => runStatusChange("closed", "Closed")}
          disabled={pending}
        >
          <Lock className="h-3.5 w-3.5" /> Close
        </Button>
      ) : null}
      {resolvedish ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => runStatusChange("reopened", "Re-opened")}
          disabled={pending}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Re-open
        </Button>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (typeof window !== "undefined") window.print();
        }}
      >
        <Printer className="h-3.5 w-3.5" /> Print
      </Button>

      <Button variant="outline" size="sm" asChild>
        <Link href={`/dashboard/sabdesk/${id}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      {ticket.requesterId ? (
        <Button variant="ghost" size="sm" asChild>
          <Link
            href={`mailto:?subject=${encodeURIComponent(
              `Re: ${ticket.subject ?? ""}`,
            )}`}
          >
            <Mail className="h-3.5 w-3.5" /> Email
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

export default TicketDetailActions;

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
 * <TicketDetailActions> - header action group for the ticket detail
 * page (1D.2 - 10 actions).
 *
 *   Edit, Reply, Forward, Assign, Merge, Resolve, Close,
 *   Re-open, Print, Activity.
 *
 * Status changes (Resolve / Close / Re-open) optimistically call
 * `updateTicket` and refresh the page; failures toast and revert.
 */

import * as React from "react";

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
        toast({ title: `${label}, ticket updated`, tone: "success" });
        router.refresh();
      } catch (e) {
        toast({
          title: `${label} failed`,
          description: e instanceof Error ? e.message : "Unknown error",
          tone: "danger",
        });
      }
    });

  const runAssign = (userId: string | null) =>
    startTransition(async () => {
      try {
        await updateTicket(id, { assigneeId: userId ?? "" });
        toast({ title: userId ? "Assignee updated" : "Unassigned", tone: "success" });
        router.refresh();
      } catch (e) {
        toast({
          title: "Assign failed",
          description: e instanceof Error ? e.message : "Unknown error",
          tone: "danger",
        });
      } finally {
        setAssignOpen(false);
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        iconLeft={Pencil}
        onClick={() => router.push(`/dashboard/sabdesk/${id}/edit`)}
      >
        Edit
      </Button>
      <Button variant="outline" size="sm" iconLeft={Reply} onClick={onReplyClick}>
        Reply
      </Button>
      <Button variant="outline" size="sm" iconLeft={Forward} onClick={onForwardClick}>
        Forward
      </Button>

      <Popover open={assignOpen} onOpenChange={setAssignOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" iconLeft={UserPlus}>
            Assign
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
            placeholder="Pick a user"
            onChange={(next) => runAssign(next)}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => runAssign(null)}
          >
            Unassign
          </Button>
        </PopoverContent>
      </Popover>

      <Button variant="outline" size="sm" iconLeft={Combine} onClick={onMergeClick}>
        Merge
      </Button>

      {!resolvedish ? (
        <Button
          size="sm"
          iconLeft={CheckCircle2}
          onClick={() => runStatusChange("resolved", "Resolved")}
          disabled={pending}
        >
          Resolve
        </Button>
      ) : null}
      {status !== "closed" ? (
        <Button
          variant="outline"
          size="sm"
          iconLeft={Lock}
          onClick={() => runStatusChange("closed", "Closed")}
          disabled={pending}
        >
          Close
        </Button>
      ) : null}
      {resolvedish ? (
        <Button
          variant="outline"
          size="sm"
          iconLeft={RotateCcw}
          onClick={() => runStatusChange("reopened", "Re-opened")}
          disabled={pending}
        >
          Re-open
        </Button>
      ) : null}

      <Button
        variant="outline"
        size="sm"
        iconLeft={Printer}
        onClick={() => {
          if (typeof window !== "undefined") window.print();
        }}
      >
        Print
      </Button>

      <Button
        variant="outline"
        size="sm"
        iconLeft={Activity}
        onClick={() => router.push(`/dashboard/sabdesk/${id}/activity`)}
      >
        Activity
      </Button>

      {ticket.requesterId ? (
        <Button
          variant="ghost"
          size="sm"
          iconLeft={Mail}
          onClick={() => {
            if (typeof window !== "undefined") {
              window.location.href = `mailto:?subject=${encodeURIComponent(
                `Re: ${ticket.subject ?? ""}`,
              )}`;
            }
          }}
        >
          Email
        </Button>
      ) : null}
    </div>
  );
}

export default TicketDetailActions;

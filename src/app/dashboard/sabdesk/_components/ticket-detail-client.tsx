"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Label,
  useToast,
} from "@/components/sabcrm/20ui";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

/**
 * <TicketDetailClient> - interactive shell on top of the server-rendered
 * detail page. Hosts:
 *   - <TicketDetailActions> - header action group (10 actions)
 *   - <TicketSlaBadge> - live SLA countdown
 *   - Status pill click -> dropdown to change status inline
 *   - <TicketConversation> - notes composer + thread
 *   - Merge dialog
 */

import * as React from "react";

import { StatusPill, statusToTone } from "@/components/crm/status-pill";
import { EntityFormField } from "@/components/crm/entity-form-field";
import { updateTicket } from "@/app/actions/crm/tickets.actions";
import type { CrmTicketDoc } from "@/lib/rust-client/crm-tickets";

import { TicketConversation } from "./ticket-conversation";
import { TicketDetailActions } from "./ticket-detail-actions";
import { TicketSlaBadge } from "./ticket-sla-badge";

const STATUS_OPTIONS = [
  "open",
  "pending",
  "on_hold",
  "resolved",
  "closed",
  "reopened",
];

interface TicketDetailClientProps {
  ticket: CrmTicketDoc;
  children?: React.ReactNode;
}

export function TicketDetailClient({
  ticket,
  children,
}: TicketDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = React.useState<"reply" | "forward" | "note">("note");
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [mergeTargetId, setMergeTargetId] = React.useState<string>("");
  const [pending, startTransition] = React.useTransition();

  const id = String(ticket._id);
  const status = ticket.status ?? "";

  const changeStatus = (next: string) =>
    startTransition(async () => {
      try {
        await updateTicket(id, { status: next });
        toast.success(`Status set to ${next.replace(/_/g, " ")}`);
        router.refresh();
      } catch (e) {
        toast({
          title: "Status change failed",
          description: e instanceof Error ? e.message : "Unknown error",
          tone: "danger",
        });
      }
    });

  const confirmMerge = () =>
    startTransition(async () => {
      if (!mergeTargetId) {
        toast({ title: "Pick a target ticket", tone: "danger" });
        return;
      }
      try {
        await updateTicket(id, {
          status: "closed",
          parentTicketId: mergeTargetId,
        });
        toast.success("Ticket merged");
        router.push(`/dashboard/sabdesk/${mergeTargetId}`);
      } catch (e) {
        toast({
          title: "Merge failed",
          description: e instanceof Error ? e.message : "Unknown error",
          tone: "danger",
        });
      } finally {
        setMergeOpen(false);
        setMergeTargetId("");
      }
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                iconRight={ChevronDown}
                aria-label="Change status"
                disabled={pending}
              >
                {status ? (
                  <StatusPill
                    label={status.replace(/_/g, " ")}
                    tone={statusToTone(status)}
                  />
                ) : (
                  <StatusPill label="Set status" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {STATUS_OPTIONS.map((s) => (
                <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                  {s.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <TicketSlaBadge ticketId={id} dueBy={ticket.dueBy} status={status} />
        </div>
        <TicketDetailActions
          ticket={ticket}
          onReplyClick={() => setMode("reply")}
          onForwardClick={() => setMode("forward")}
          onMergeClick={() => setMergeOpen(true)}
        />
      </div>

      <TicketConversation ticket={ticket} mode={mode} onModeChange={setMode}>
        {children}
      </TicketConversation>

      <Dialog
        open={mergeOpen}
        onOpenChange={(o) => {
          setMergeOpen(o);
          if (!o) setMergeTargetId("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Merge into another ticket?</DialogTitle>
            <DialogDescription>
              Pick the canonical ticket. This ticket will be closed and parented
              to it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Target ticket</Label>
            <EntityFormField
              entity="ticketGroup"
              name="mergeTargetId"
              initialId={null}
              placeholder="Pick a target ticket..."
              onChange={(next) => setMergeTargetId(next ?? "")}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setMergeOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={confirmMerge}
              disabled={pending || !mergeTargetId}
            >
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default TicketDetailClient;

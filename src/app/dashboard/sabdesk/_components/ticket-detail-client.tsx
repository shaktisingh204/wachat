"use client";

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Label,
  useZoruToast,
} from "@/components/zoruui";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";

/**
 * <TicketDetailClient> — interactive shell on top of the server-rendered
 * detail page. Hosts:
 *   • <TicketDetailActions> — header action group (10 actions)
 *   • <TicketSlaBadge> — live SLA countdown
 *   • Status pill click → dropdown to change status inline
 *   • <TicketConversation> — notes composer + thread
 *   • Merge dialog
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
  const { toast } = useZoruToast();
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
        toast({ title: `Status set to ${next.replace(/_/g, " ")}` });
        router.refresh();
      } catch (e) {
        toast({
          title: "Status change failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
        });
      }
    });

  const confirmMerge = () =>
    startTransition(async () => {
      if (!mergeTargetId) {
        toast({
          title: "Pick a target ticket",
          variant: "destructive",
        });
        return;
      }
      try {
        await updateTicket(id, {
          status: "closed",
          parentTicketId: mergeTargetId,
        });
        toast({ title: "Ticket merged" });
        router.push(`/dashboard/sabdesk/${mergeTargetId}`);
      } catch (e) {
        toast({
          title: "Merge failed",
          description: e instanceof Error ? e.message : "Unknown error",
          variant: "destructive",
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
            <ZoruDropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-text)]"
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
                <ChevronDown className="h-3 w-3 text-[var(--st-text-secondary)]" />
              </button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="start">
              {STATUS_OPTIONS.map((s) => (
                <ZoruDropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                  {s.replace(/_/g, " ")}
                </ZoruDropdownMenuItem>
              ))}
            </ZoruDropdownMenuContent>
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
        <ZoruDialogContent className="sm:max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Merge into another ticket?</ZoruDialogTitle>
            <ZoruDialogDescription>
              Pick the canonical ticket. This ticket will be closed and parented
              to it.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-1.5">
            <Label>Target ticket</Label>
            <EntityFormField
              entity="ticketGroup"
              name="mergeTargetId"
              initialId={null}
              placeholder="Pick a target ticket…"
              onChange={(next) => setMergeTargetId(next ?? "")}
            />
          </div>
          <ZoruDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setMergeOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={confirmMerge} disabled={pending || !mergeTargetId}>
              Merge
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}

export default TicketDetailClient;

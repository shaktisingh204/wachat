"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  useToast,
} from "@/components/sabcrm/20ui";

import { deleteFacebookAgent } from "@/app/actions/facebook.actions";

/**
 * DeleteAgentDialog (Meta Suite local, 20ui).
 *
 * Confirmation dialog for `deleteFacebookAgent`. Replaces the inline
 * `confirm(...)` prompt with a proper destructive alert dialog from 20ui.
 */

export interface DeleteAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string | null;
  agentName: string | null;
  onDeleted: () => void;
}

export function DeleteAgentDialog({
  open,
  onOpenChange,
  agentId,
  agentName,
  onDeleted,
}: DeleteAgentDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleConfirm = () => {
    if (!agentId) return;
    startTransition(async () => {
      const result = await deleteFacebookAgent(agentId);
      if (result.error) {
        toast({
          title: "Could not delete agent",
          description: result.error,
          tone: "danger",
        });
        return;
      }
      toast({
        title: "Agent deleted",
        description: `${agentName || "Agent"} has been removed.`,
        tone: "success",
      });
      onOpenChange(false);
      onDeleted();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete agent {agentName ? `"${agentName}"` : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the agent and its training data from this
            project. Conversations already routed to it will fall back to the
            default response.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isPending ? "Deleting..." : "Delete agent"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

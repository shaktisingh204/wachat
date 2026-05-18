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
  useZoruToast,
} from '@/components/zoruui';
import {
  useTransition } from "react";
import { Loader2,
  Trash2 } from "lucide-react";

import { deleteFacebookAgent } from "@/app/actions/facebook.actions";

/**
 * DeleteAgentDialog (Meta Suite local, zoru-only).
 *
 * Confirmation dialog for `deleteFacebookAgent`. Replaces the inline
 * `confirm(...)` prompt with a proper destructive alert dialog.
 */

import * as React from "react";

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
  const { toast } = useZoruToast();

  const handleConfirm = () => {
    if (!agentId) return;
    startTransition(async () => {
      const result = await deleteFacebookAgent(agentId);
      if (result.error) {
        toast({
          title: "Couldn’t delete agent",
          description: result.error,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "Agent deleted",
        description: `${agentName || "Agent"} has been removed.`,
        variant: "success",
      });
      onOpenChange(false);
      onDeleted();
    });
  };

  return (
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>
            Delete agent {agentName ? `“${agentName}”` : ""}?
          </ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This permanently removes the agent and its training data from this
            project. Conversations already routed to it will fall back to the
            default response.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={isPending}>
            Cancel
          </ZoruAlertDialogCancel>
          <ZoruAlertDialogAction
            disabled={isPending}
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-3.5 w-3.5" />
            )}
            {isPending ? "Deleting…" : "Delete agent"}
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}

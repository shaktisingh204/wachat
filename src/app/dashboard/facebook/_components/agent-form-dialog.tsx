"use client";

/**
 * AgentFormDialog (Meta Suite local, zoru-only).
 *
 * Wraps `createFacebookAgent` server action in a zoru dialog. Same fields
 * as the legacy inline card — name, personality, welcome / fallback
 * messages, active toggle.
 */

import * as React from "react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus } from "lucide-react";

import { createFacebookAgent } from "@/app/actions/facebook.actions";
import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSwitch,
  ZoruTextarea,
  useZoruToast,
} from "@/components/zoruui";

const initialFormState = { message: "", error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Plus />}
      {pending ? "Creating…" : "Create agent"}
    </ZoruButton>
  );
}

export interface AgentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated?: () => void;
}

export function AgentFormDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: AgentFormDialogProps) {
  const [formState, formAction] = useActionState(
    createFacebookAgent,
    initialFormState,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useZoruToast();

  useEffect(() => {
    if (formState.message) {
      toast({
        title: "Agent created",
        description: formState.message,
        variant: "success",
      });
      formRef.current?.reset();
      onOpenChange(false);
      onCreated?.();
    }
  }, [formState.message, onOpenChange, onCreated, toast]);

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <ZoruDialogHeader>
            <ZoruDialogTitle>New AI agent</ZoruDialogTitle>
            <ZoruDialogDescription>
              Build a Messenger-ready conversational agent. Fill in a
              personality and the messages it will use.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <input type="hidden" name="projectId" value={projectId} />

          {formState.error ? (
            <ZoruAlert variant="destructive">
              <ZoruAlertDescription>{formState.error}</ZoruAlertDescription>
            </ZoruAlert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="name">Name</ZoruLabel>
              <ZoruInput
                id="name"
                name="name"
                required
                placeholder="e.g. Support Bot"
              />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="personality">Personality</ZoruLabel>
              <ZoruTextarea
                id="personality"
                name="personality"
                placeholder="friendly and helpful"
                rows={2}
              />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="welcomeMessage">Welcome message</ZoruLabel>
              <ZoruTextarea
                id="welcomeMessage"
                name="welcomeMessage"
                placeholder="Hi! How can I help you today?"
                rows={2}
              />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="fallbackMessage">Fallback message</ZoruLabel>
              <ZoruTextarea
                id="fallbackMessage"
                name="fallbackMessage"
                placeholder="Let me connect you with a human agent."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <ZoruSwitch id="isActive" name="isActive" />
              <ZoruLabel htmlFor="isActive">Active on creation</ZoruLabel>
            </div>
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

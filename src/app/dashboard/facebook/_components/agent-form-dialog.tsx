"use client";

import { Alert, AlertDescription, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Switch, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2,
  Plus } from "lucide-react";

import { createFacebookAgent } from "@/app/actions/facebook.actions";

/**
 * AgentFormDialog (Meta Suite local, zoru-only).
 *
 * Wraps `createFacebookAgent` server action in a zoru dialog. Same fields
 * as the legacy inline card — name, personality, welcome / fallback
 * messages, active toggle.
 */

import * as React from "react";

const initialFormState = { message: "", error: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Plus />}
      {pending ? "Creating…" : "Create agent"}
    </Button>
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
  const { toast } = useToast();

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef} className="flex flex-col gap-5">
          <DialogHeader>
            <DialogTitle>New AI agent</DialogTitle>
            <DialogDescription>
              Build a Messenger-ready conversational agent. Fill in a
              personality and the messages it will use.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="projectId" value={projectId} />

          {formState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{formState.error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="e.g. Support Bot"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="personality">Personality</Label>
              <Textarea
                id="personality"
                name="personality"
                placeholder="friendly and helpful"
                rows={2}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="welcomeMessage">Welcome message</Label>
              <Textarea
                id="welcomeMessage"
                name="welcomeMessage"
                placeholder="Hi! How can I help you today?"
                rows={2}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fallbackMessage">Fallback message</Label>
              <Textarea
                id="fallbackMessage"
                name="fallbackMessage"
                placeholder="Let me connect you with a human agent."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="isActive" name="isActive" />
              <Label htmlFor="isActive">Active on creation</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, useToast } from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2,
  Wrench } from "lucide-react";

import { handleManualFacebookPageSetup } from "@/app/actions/facebook.actions";

/**
 * ManualSetupDialog (Meta Suite local, zoru-only).
 *
 * Visual swap of `@/components/zoruui-domain/manual-facebook-setup-dialog`.
 * Same `handleManualFacebookPageSetup` server action, same form fields,
 * same toast outcomes — only the visual layer is rewritten on Zoru* atoms.
 */

import * as React from "react";

const initialState: { success?: boolean; error?: string } = {
  success: false,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? "Connecting…" : "Connect Page"}
    </Button>
  );
}

export interface ManualSetupDialogProps {
  onSuccess: () => void;
  /** Optional custom trigger label/icon. */
  triggerLabel?: string;
}

export function ManualSetupDialog({
  onSuccess,
  triggerLabel = "Manual Setup",
}: ManualSetupDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    handleManualFacebookPageSetup,
    initialState,
  );
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast({
        title: "Page connected",
        description: "Facebook Page connected successfully.",
        variant: "success",
      });
      formRef.current?.reset();
      setOpen(false);
      onSuccess();
    }
    if (state.error) {
      toast({
        title: "Connection error",
        description: state.error,
        variant: "destructive",
      });
    }
  }, [state, toast, onSuccess]);

  const handleOpenChange = (next: boolean) => {
    if (!next) formRef.current?.reset();
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Wrench /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form
          action={formAction}
          ref={formRef}
          className="flex flex-col gap-5"
        >
          <DialogHeader>
            <DialogTitle>Manual Facebook connection</DialogTitle>
            <DialogDescription>
              Enter the IDs and tokens from your Meta Developer account. For
              advanced users only.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="projectName">Project name</Label>
              <Input
                id="projectName"
                name="projectName"
                placeholder="e.g. My Facebook Page"
                required
              />
              <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                A name for you to identify this connection.
              </p>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="facebookPageId">Facebook Page ID</Label>
              <Input
                id="facebookPageId"
                name="facebookPageId"
                placeholder="Your Facebook Page ID"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="adAccountId">Ad Account ID</Label>
              <Input
                id="adAccountId"
                name="adAccountId"
                placeholder="act_xxxxxxxxxxxx"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="accessToken">
                Permanent access token
              </Label>
              <Input
                id="accessToken"
                name="accessToken"
                type="password"
                placeholder="A non-expiring System User Token"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
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

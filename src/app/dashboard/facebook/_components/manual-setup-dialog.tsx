"use client";

/**
 * ManualSetupDialog (Meta Suite local, zoru-only).
 *
 * Visual swap of `@/components/wabasimplify/manual-facebook-setup-dialog`.
 * Same `handleManualFacebookPageSetup` server action, same form fields,
 * same toast outcomes — only the visual layer is rewritten on Zoru* atoms.
 */

import * as React from "react";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Wrench } from "lucide-react";

import { handleManualFacebookPageSetup } from "@/app/actions/facebook.actions";
import {
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruInput,
  ZoruLabel,
  useZoruToast,
} from "@/components/zoruui";

const initialState: { success?: boolean; error?: string } = {
  success: false,
  error: undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : null}
      {pending ? "Connecting…" : "Connect Page"}
    </ZoruButton>
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
  const { toast } = useZoruToast();
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
    <ZoruDialog open={open} onOpenChange={handleOpenChange}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline" size="sm">
          <Wrench /> {triggerLabel}
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-lg">
        <form
          action={formAction}
          ref={formRef}
          className="flex flex-col gap-5"
        >
          <ZoruDialogHeader>
            <ZoruDialogTitle>Manual Facebook connection</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the IDs and tokens from your Meta Developer account. For
              advanced users only.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="projectName">Project name</ZoruLabel>
              <ZoruInput
                id="projectName"
                name="projectName"
                placeholder="e.g. My Facebook Page"
                required
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                A name for you to identify this connection.
              </p>
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="facebookPageId">Facebook Page ID</ZoruLabel>
              <ZoruInput
                id="facebookPageId"
                name="facebookPageId"
                placeholder="Your Facebook Page ID"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="adAccountId">Ad Account ID</ZoruLabel>
              <ZoruInput
                id="adAccountId"
                name="adAccountId"
                placeholder="act_xxxxxxxxxxxx"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="accessToken">
                Permanent access token
              </ZoruLabel>
              <ZoruInput
                id="accessToken"
                name="accessToken"
                type="password"
                placeholder="A non-expiring System User Token"
                required
              />
            </div>
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
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

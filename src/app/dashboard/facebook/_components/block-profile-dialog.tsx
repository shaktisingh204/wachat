"use client";

import {
  Alert,
  ZoruAlertDescription,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useTransition } from "react";
import { Loader2,
  UserPlus } from "lucide-react";

import { blockProfile } from "@/app/actions/facebook.actions";

/**
 * BlockProfileDialog (Meta Suite local, zoru-only).
 *
 * Wraps `blockProfile` server action — same business logic as the legacy
 * inline input. Operator confirms, the profile ID is sent to Meta.
 */

import * as React from "react";

export interface BlockProfileDialogProps {
  projectId: string;
  onSuccess: () => void;
}

export function BlockProfileDialog({
  projectId,
  onSuccess,
}: BlockProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useZoruToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId.trim()) return;
    startTransition(async () => {
      const result = await blockProfile(profileId.trim(), projectId);
      if (result.error) {
        setError(result.error);
        return;
      }
      toast({
        title: "Profile blocked",
        description: `Profile ${profileId.trim()} can no longer interact with your Page.`,
        variant: "success",
      });
      setProfileId("");
      setError(null);
      setOpen(false);
      onSuccess();
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton size="sm">
          <UserPlus /> Block profile
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <ZoruDialogHeader>
            <ZoruDialogTitle>Block a profile</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the Facebook profile ID to block. Blocked profiles can no
              longer comment or message your Page.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          {error ? (
            <ZoruAlert variant="destructive">
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </ZoruAlert>
          ) : null}

          <div className="grid gap-1.5">
            <ZoruLabel htmlFor="profileId">Profile ID</ZoruLabel>
            <ZoruInput
              id="profileId"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              placeholder="e.g. 1234567890"
              required
            />
          </div>

          <ZoruDialogFooter>
            <ZoruButton
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton type="submit" disabled={isPending || !profileId.trim()}>
              {isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
              {isPending ? "Blocking…" : "Block profile"}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

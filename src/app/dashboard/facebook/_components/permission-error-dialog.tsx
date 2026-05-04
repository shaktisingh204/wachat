"use client";

/**
 * PermissionErrorDialog (Meta Suite local, zoru-only).
 *
 * Visual swap of `@/components/wabasimplify/permission-error-dialog`.
 * Same trigger surface — surfaces a Meta permission error and lets the
 * operator re-authorize. Pure zoru tokens, neutral palette.
 */

import * as React from "react";
import { AlertCircle } from "lucide-react";

import type { Project, WithId } from "@/lib/definitions";
import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruButton,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from "@/components/zoruui";

import { FacebookGlyph } from "./icons";

export interface PermissionErrorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  error: string | null;
  project: WithId<Project> | null;
}

export function PermissionErrorDialog({
  isOpen,
  onOpenChange,
  error,
  project,
}: PermissionErrorDialogProps) {
  if (!project) return null;

  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-md">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-zoru-danger" />
            Permissions required
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            SabNode needs additional permissions to access this feature.
          </ZoruDialogDescription>
        </ZoruDialogHeader>

        <div className="flex flex-col gap-4">
          {error ? (
            <ZoruAlert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertTitle>Error from Meta</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </ZoruAlert>
          ) : null}

          <p className="text-[12.5px] text-zoru-ink-muted leading-relaxed">
            Please reconnect your Facebook account and ensure every requested
            permission is granted. Your existing settings will be preserved.
          </p>
        </div>

        <ZoruDialogFooter>
          <ZoruButton
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </ZoruButton>
          <ZoruButton asChild>
            <a href="/api/auth/meta-suite/login?reauthorize=true&state=facebook_reauth">
              <FacebookGlyph className="h-4 w-4" /> Re-authorize
            </a>
          </ZoruButton>
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

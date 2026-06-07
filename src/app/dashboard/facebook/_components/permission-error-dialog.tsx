"use client";

import { Alert, AlertDescription, AlertTitle, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/sabcrm/20ui';
import {
  AlertCircle } from "lucide-react";

import type { Project,
  WithId } from "@/lib/definitions";

/**
 * PermissionErrorDialog (Meta Suite local, ui20-only).
 *
 * Visual swap of `@/components/20ui-domain/permission-error-dialog`.
 * Same trigger surface — surfaces a Meta permission error and lets the
 * operator re-authorize. Pure ui20 tokens, neutral palette.
 */

import * as React from "react";

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-[var(--st-danger)]" />
            Permissions required
          </DialogTitle>
          <DialogDescription>
            SabNode needs additional permissions to access this feature.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error from Meta</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <p className="text-[12.5px] text-[var(--st-text-secondary)] leading-relaxed">
            Please reconnect your Facebook account and ensure every requested
            permission is granted. Your existing settings will be preserved.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button asChild>
            <a href="/api/auth/meta-suite/login?reauthorize=true&state=facebook_reauth">
              <FacebookGlyph className="h-4 w-4" /> Re-authorize
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

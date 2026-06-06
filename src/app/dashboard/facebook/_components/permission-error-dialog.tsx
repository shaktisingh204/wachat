"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/sabcrm/20ui/compat';
import {
  AlertCircle } from "lucide-react";

import type { Project,
  WithId } from "@/lib/definitions";

/**
 * PermissionErrorDialog (Meta Suite local, zoru-only).
 *
 * Visual swap of `@/components/zoruui-domain/permission-error-dialog`.
 * Same trigger surface — surfaces a Meta permission error and lets the
 * operator re-authorize. Pure zoru tokens, neutral palette.
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
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <ZoruAlertTitle>Error from Meta</ZoruAlertTitle>
              <ZoruAlertDescription>{error}</ZoruAlertDescription>
            </Alert>
          ) : null}

          <p className="text-[12.5px] text-zoru-ink-muted leading-relaxed">
            Please reconnect your Facebook account and ensure every requested
            permission is granted. Your existing settings will be preserved.
          </p>
        </div>

        <ZoruDialogFooter>
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
        </ZoruDialogFooter>
      </ZoruDialogContent>
    </Dialog>
  );
}

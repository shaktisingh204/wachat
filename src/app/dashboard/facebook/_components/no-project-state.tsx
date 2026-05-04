"use client";

/**
 * Shared empty state for Meta Suite pages when no project is selected.
 * Replaces the legacy `<Alert variant="destructive">` block — neutral
 * tokens only, no clay/wabasimplify visuals.
 */

import * as React from "react";
import { AlertCircle } from "lucide-react";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
} from "@/components/zoruui";

export function NoProjectState() {
  return (
    <ZoruAlert variant="warning">
      <AlertCircle />
      <ZoruAlertTitle>No project selected</ZoruAlertTitle>
      <ZoruAlertDescription>
        Pick a project from the main dashboard to use this Meta Suite tool.
      </ZoruAlertDescription>
    </ZoruAlert>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <ZoruAlert variant="destructive">
      <AlertCircle />
      <ZoruAlertTitle>Something went wrong</ZoruAlertTitle>
      <ZoruAlertDescription>{message}</ZoruAlertDescription>
    </ZoruAlert>
  );
}

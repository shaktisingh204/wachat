"use client";

import { Alert, ZoruAlertDescription, ZoruAlertTitle } from '@/components/zoruui';
import { AlertCircle } from "lucide-react";

/**
 * Shared empty state for Meta Suite pages when no project is selected.
 * Replaces the legacy `<Alert variant="destructive">` block — neutral
 * tokens only, no clay/wabasimplify visuals.
 */

import * as React from "react";

export function NoProjectState() {
  return (
    <Alert variant="warning">
      <AlertCircle />
      <ZoruAlertTitle>No project selected</ZoruAlertTitle>
      <ZoruAlertDescription>
        Pick a project from the main dashboard to use this Meta Suite tool.
      </ZoruAlertDescription>
    </Alert>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <ZoruAlertTitle>Something went wrong</ZoruAlertTitle>
      <ZoruAlertDescription>{message}</ZoruAlertDescription>
    </Alert>
  );
}

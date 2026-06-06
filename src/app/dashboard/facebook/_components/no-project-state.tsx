"use client";

import { Alert, AlertDescription, AlertTitle } from '@/components/sabcrm/20ui/compat';
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
      <AlertTitle>No project selected</AlertTitle>
      <AlertDescription>
        Pick a project from the main dashboard to use this Meta Suite tool.
      </AlertDescription>
    </Alert>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

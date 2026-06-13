"use client";

/**
 * SabSMS settings — RCS enablement card (V2.11).
 *
 * Persists the workspace `rcsEnabled` boolean (the real composer gate read by
 * `send/actions.ts` getRcsComposerContext) via an RBAC-gated server action.
 * Same hydrate-from-server + save pattern as the agent / short-links cards.
 */

import { useState } from "react";

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Switch,
} from "@/components/sabcrm/20ui";

import { saveRcsEnabledAction } from "./actions";

export function RcsSettingsCard({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(next: boolean) {
    setEnabled(next);
    setSaved(false);
    setError(null);
    setSaving(true);
    const res = await saveRcsEnabledAction({ enabled: next });
    setSaving(false);
    if (res.success) {
      setEnabled(res.rcsEnabled);
      setSaved(true);
    } else {
      // Roll back the optimistic toggle on failure.
      setEnabled(!next);
      setError(res.error);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          RCS messaging
          <Badge tone={enabled ? "success" : "neutral"} kind="soft">
            {enabled ? "Enabled" : "Disabled"}
          </Badge>
        </CardTitle>
        <CardDescription>
          Allow the composer to send Rich Communication Services (RCS) messages —
          rich cards, suggested replies, and branded sender — where the carrier
          and device support it. When off, the composer falls back to SMS/MMS.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] p-4">
          <div>
            <p className="text-sm font-medium text-[var(--st-text)]">Enable RCS composer</p>
            <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">
              Gates the RCS channel for this workspace.
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={saving}
            aria-label="Enable RCS composer"
          />
        </div>
      </CardBody>
      <CardFooter className="text-xs">
        {error ? (
          <span className="text-[var(--st-danger)]">{error}</span>
        ) : saving ? (
          <span className="text-[var(--st-text-secondary)]">Saving…</span>
        ) : saved ? (
          <span className="text-[var(--st-status-ok)]">Saved.</span>
        ) : (
          <span className="text-[var(--st-text-secondary)]">
            Changes apply to new sends immediately.
          </span>
        )}
      </CardFooter>
    </Card>
  );
}

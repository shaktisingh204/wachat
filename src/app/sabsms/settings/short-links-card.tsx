"use client";

import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/sabcrm/20ui";

import { saveShortLinkDomainAction } from "./actions";

export function ShortLinksSettingsCard({
  initialDomain,
  initialBase,
}: {
  initialDomain: string | null;
  initialBase: string;
}) {
  const [domain, setDomain] = useState(initialDomain ?? "");
  const [savedDomain, setSavedDomain] = useState(initialDomain);
  const [base, setBase] = useState(initialBase);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await saveShortLinkDomainAction({ domain });
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSavedDomain(res.settings.shortLinkDomain);
    setDomain(res.settings.shortLinkDomain ?? "");
    setBase(res.settings.effectiveShortLinkBase);
    setSaved(true);
  }

  const dirty = (savedDomain ?? "") !== domain.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Short links</CardTitle>
        <CardDescription>
          Branded domain for tracked short links. Point the domain at this
          app (it serves <code>/&lt;slug&gt;</code> through the{" "}
          <code>/s</code> redirect) and SabSMS mints links under it instead
          of the default base. Leave empty to use the default.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-2 md:max-w-sm">
            <Label htmlFor="sabsms-short-link-domain">Branded domain</Label>
            <Input
              id="sabsms-short-link-domain"
              placeholder="sab.sm"
              value={domain}
              onChange={(e) => {
                setDomain(e.target.value);
                setSaved(false);
              }}
              autoComplete="off"
            />
            <p className="text-xs text-[var(--st-text-secondary)]">
              Bare hostname — an <code>https://</code> prefix is stripped.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {saved && <Badge variant="secondary">Saved</Badge>}
            <span className="text-xs text-[var(--st-text-secondary)]">
              Links mint as <code>{base}/&lt;slug&gt;</code>
            </span>
          </div>

          {error && (
            <p className="rounded border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-3 text-sm text-[var(--st-text)]">
              {error}
            </p>
          )}
        </form>
      </CardBody>
    </Card>
  );
}

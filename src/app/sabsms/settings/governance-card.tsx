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

import {
  saveGovernanceSettingsAction,
  type GovernanceSettings,
} from "./governance-actions";

const FIELD =
  "rounded border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 text-sm text-[var(--st-text)]";

function parseCountries(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[\s,]+/)
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z]{2}$/.test(c)),
    ),
  );
}

function toNum(raw: string): number | undefined {
  const n = Math.floor(Number(raw));
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function GovernanceSettingsCard({ initial }: { initial: GovernanceSettings }) {
  const [geoMode, setGeoMode] = useState<GovernanceSettings["geoPermissions"]["mode"]>(
    initial.geoPermissions.mode,
  );
  const [countries, setCountries] = useState(initial.geoPermissions.countries.join(", "));
  const [perHour, setPerHour] = useState(
    initial.frequencyCap.perHour != null ? String(initial.frequencyCap.perHour) : "",
  );
  const [perDay, setPerDay] = useState(
    initial.frequencyCap.perDay != null ? String(initial.frequencyCap.perDay) : "",
  );
  const [waProject, setWaProject] = useState(initial.whatsapp?.wachatProjectId ?? "");
  const [waPhone, setWaPhone] = useState(initial.whatsapp?.phoneNumberId ?? "");
  const [waTenant, setWaTenant] = useState(initial.whatsapp?.tenantId ?? "");
  const [waTemplate, setWaTemplate] = useState(initial.whatsapp?.otpTemplateId ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload: GovernanceSettings = {
      geoPermissions: {
        mode: geoMode,
        countries: geoMode === "allow_all" ? [] : parseCountries(countries),
      },
      frequencyCap: { perHour: toNum(perHour), perDay: toNum(perDay) },
      whatsapp:
        waProject.trim() && waPhone.trim()
          ? {
              wachatProjectId: waProject.trim(),
              phoneNumberId: waPhone.trim(),
              tenantId: waTenant.trim() || undefined,
              otpTemplateId: waTemplate.trim() || undefined,
            }
          : null,
    };

    const res = await saveGovernanceSettingsAction(payload);
    setSaving(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSaved(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Governance &amp; channels</CardTitle>
        <CardDescription>
          Cross-channel guardrails enforced in the unified send pre-flight,
          plus the WhatsApp channel linkage. Geo and frequency rules apply to
          SMS, WhatsApp, and voice alike; OTP/transactional sends are exempt
          from the frequency cap.
        </CardDescription>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSave} className="space-y-6">
          {/* Geo permissions */}
          <fieldset className="space-y-2">
            <Label htmlFor="sabsms-geo-mode">Geo permissions</Label>
            <select
              id="sabsms-geo-mode"
              className={FIELD}
              value={geoMode}
              onChange={(e) =>
                setGeoMode(e.target.value as GovernanceSettings["geoPermissions"]["mode"])
              }
            >
              <option value="allow_all">Allow all countries</option>
              <option value="allowlist">Allowlist (send only to listed)</option>
              <option value="denylist">Denylist (block listed)</option>
            </select>
            {geoMode !== "allow_all" && (
              <div className="grid gap-2 md:max-w-md">
                <Label htmlFor="sabsms-geo-countries">
                  Countries (ISO-2, comma separated)
                </Label>
                <Input
                  id="sabsms-geo-countries"
                  placeholder="US, IN, GB"
                  value={countries}
                  onChange={(e) => setCountries(e.target.value)}
                />
              </div>
            )}
          </fieldset>

          {/* Frequency cap */}
          <fieldset className="grid gap-2 md:grid-cols-2 md:max-w-md">
            <div className="grid gap-2">
              <Label htmlFor="sabsms-freq-hour">Max / contact / hour</Label>
              <Input
                id="sabsms-freq-hour"
                type="number"
                min={1}
                placeholder="no limit"
                value={perHour}
                onChange={(e) => setPerHour(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sabsms-freq-day">Max / contact / day</Label>
              <Input
                id="sabsms-freq-day"
                type="number"
                min={1}
                placeholder="no limit"
                value={perDay}
                onChange={(e) => setPerDay(e.target.value)}
              />
            </div>
          </fieldset>

          {/* WhatsApp linkage */}
          <fieldset className="space-y-2">
            <Label>WhatsApp channel (WaChat linkage)</Label>
            <p className="text-xs text-[var(--st-text-muted)]">
              Link this workspace to a WaChat project + WABA phone number to
              send WhatsApp via the unified dispatcher. Leave blank to disable.
            </p>
            <div className="grid gap-2 md:grid-cols-2 md:max-w-2xl">
              <Input
                placeholder="WaChat project id"
                value={waProject}
                onChange={(e) => setWaProject(e.target.value)}
              />
              <Input
                placeholder="WABA phone number id"
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
              />
              <Input
                placeholder="Rust tenant id (optional)"
                value={waTenant}
                onChange={(e) => setWaTenant(e.target.value)}
              />
              <Input
                placeholder="OTP template id (optional)"
                value={waTemplate}
                onChange={(e) => setWaTemplate(e.target.value)}
              />
            </div>
          </fieldset>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save governance"}
            </Button>
            {saved && <Badge>Saved</Badge>}
            {error && <span className="text-sm text-[var(--st-danger,#dc2626)]">{error}</span>}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

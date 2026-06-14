"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, ChevronRight, Save } from "lucide-react";

import {
  Button,
  Card,
  Field,
  Input,
  SelectField,
  useToast,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import { SabHrmPageShell } from "@/components/sabhrm/page-toolkit";
import {
  updateSabHrmSettings,
  type SabHrmSettings,
  type SabHrmRegion,
} from "@/app/actions/sabhrm/settings.actions";

const REGION_OPTIONS: SelectOption[] = [
  { value: "IN", label: "India (INR · April FY)" },
  { value: "US", label: "United States (USD · January FY)" },
  { value: "OTHER", label: "Other" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_OPTIONS: SelectOption[] = MONTHS.map((m, i) => ({
  value: String(i + 1),
  label: m,
}));

const QUICK_LINKS: Array<{ href: string; label: string; description: string }> = [
  { href: "/sabhrm/departments", label: "Departments", description: "Organize your team into departments." },
  { href: "/sabhrm/designations", label: "Designations", description: "Define job titles and seniority levels." },
  { href: "/sabhrm/leave", label: "Leave", description: "Configure leave types and approvals." },
];

export function SettingsClient({
  initial,
  loadError,
}: {
  initial: SabHrmSettings;
  loadError: string | null;
}) {
  const { toast } = useToast();

  const [legalName, setLegalName] = React.useState(initial.legalName);
  const [region, setRegion] = React.useState<SabHrmRegion>(initial.region);
  const [currency, setCurrency] = React.useState(initial.currency);
  const [fyStart, setFyStart] = React.useState<number>(initial.fiscalYearStartMonth);
  const [timezone, setTimezone] = React.useState(initial.timezone);
  const [saving, setSaving] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Sensible region-driven defaults that the user can still override.
  const onRegion = React.useCallback((value: string) => {
    const r = value as SabHrmRegion;
    setRegion(r);
    if (r === "IN") {
      setCurrency("INR");
      setFyStart(4);
    } else {
      setCurrency("USD");
      setFyStart(1);
    }
  }, []);

  const submit = React.useCallback(async () => {
    if (!legalName.trim()) {
      setErr("Organization legal name is required.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await updateSabHrmSettings({
      legalName: legalName.trim(),
      region,
      currency: currency.trim() || undefined,
      fiscalYearStartMonth: fyStart,
      timezone: timezone.trim() || undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setErr(res.error);
      toast({ title: "Couldn't save settings", description: res.error, variant: "destructive" });
      return;
    }
    setLegalName(res.data.legalName);
    setRegion(res.data.region);
    setCurrency(res.data.currency);
    setFyStart(res.data.fiscalYearStartMonth);
    setTimezone(res.data.timezone);
    toast({ title: "Settings saved", description: "Your organization profile is up to date." });
  }, [legalName, region, currency, fyStart, timezone, toast]);

  return (
    <SabHrmPageShell
      title="Settings"
      description="Your organization profile powers payroll, statutory compliance, and the fiscal calendar."
    >
      <div className="mx-auto w-full max-w-2xl">
        <Card className="flex flex-col gap-5 p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
            <Building2 className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
            Organization profile
          </div>

          {loadError ? (
            <p className="text-sm text-[var(--st-status-bad,#dc2626)]">{loadError}</p>
          ) : null}

          <Field label="Legal name" error={err && !legalName.trim() ? err : undefined}>
            <Input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Acme Private Limited"
              maxLength={160}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Payroll region">
              <SelectField
                value={region}
                options={REGION_OPTIONS}
                onChange={(v) => onRegion(String(v))}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="INR"
                maxLength={3}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fiscal year starts">
              <SelectField
                value={String(fyStart)}
                options={MONTH_OPTIONS}
                onChange={(v) => setFyStart(Number(v))}
              />
            </Field>
            <Field label="Timezone">
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
                maxLength={64}
              />
            </Field>
          </div>

          {err && legalName.trim() ? (
            <p className="text-sm text-[var(--st-status-bad,#dc2626)]">{err}</p>
          ) : null}

          <div className="flex justify-end pt-1">
            <Button
              variant="primary"
              iconLeft={Save}
              loading={saving}
              disabled={saving || !legalName.trim()}
              onClick={() => void submit()}
            >
              Save changes
            </Button>
          </div>
        </Card>

        <div className="mt-6">
          <div className="mb-2 text-sm font-medium text-[var(--st-text)]">Organization setup</div>
          <Card className="divide-y divide-[var(--st-border)] overflow-hidden">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--st-bg-muted)]"
              >
                <div className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--st-text)]">
                    {link.label}
                  </span>
                  <span className="block truncate text-xs text-[var(--st-text-secondary)]">
                    {link.description}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
              </Link>
            ))}
          </Card>
        </div>
      </div>
    </SabHrmPageShell>
  );
}

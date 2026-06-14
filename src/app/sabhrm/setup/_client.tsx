"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Building2, Rocket } from "lucide-react";

import {
  Button,
  Card,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  SelectField,
  useToast,
  type SelectOption,
} from "@/components/sabcrm/20ui";
import {
  completeSabHrmSetup,
  type SabHrmSetupState,
  type SabHrmRegion,
} from "@/app/actions/sabhrm-projects.actions";

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

export function SabHrmSetupClient({ state }: { state: SabHrmSetupState }) {
  const router = useRouter();
  const { toast } = useToast();

  const [legalName, setLegalName] = React.useState(state.legalName ?? state.name ?? "");
  const [region, setRegion] = React.useState<SabHrmRegion>(state.region ?? "IN");
  const [currency, setCurrency] = React.useState(state.currency ?? "INR");
  const [fyStart, setFyStart] = React.useState<number>(state.fiscalYearStartMonth ?? 4);
  const [busy, setBusy] = React.useState(false);
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
    setBusy(true);
    setErr(null);
    const res = await completeSabHrmSetup(state.projectId, {
      legalName: legalName.trim(),
      region,
      currency: currency.trim() || undefined,
      fiscalYearStartMonth: fyStart,
    });
    if (!res.success) {
      setErr(res.error);
      setBusy(false);
      return;
    }
    toast({ title: "Organization ready", description: "SabHRM is set up." });
    router.push("/sabhrm");
  }, [legalName, region, currency, fyStart, state.projectId, router, toast]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Set up {state.name}</PageTitle>
          <PageDescription>
            A few details about your organization power payroll, statutory
            compliance, and the fiscal calendar. You can change these later in
            Settings.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card className="mt-6 flex flex-col gap-5 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
          <Building2 className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
          Organization profile
        </div>

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

        <Field label="Fiscal year starts">
          <SelectField
            value={String(fyStart)}
            options={MONTH_OPTIONS}
            onChange={(v) => setFyStart(Number(v))}
          />
        </Field>

        {err && legalName.trim() ? (
          <p className="text-sm text-[var(--st-status-bad,#dc2626)]">{err}</p>
        ) : null}

        <div className="flex justify-end pt-1">
          <Button
            variant="primary"
            iconRight={Rocket}
            loading={busy}
            disabled={busy || !legalName.trim()}
            onClick={() => void submit()}
          >
            Finish setup
          </Button>
        </div>
      </Card>
    </div>
  );
}

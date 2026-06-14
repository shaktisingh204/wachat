"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, PhoneCall } from "lucide-react";

import {
  Button,
  Card,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  completeSabcallSetup,
  saveSabcallProfileStep,
  type SabcallRegion,
  type SabcallSetupState,
} from "@/app/actions/sabcall-projects.actions";

const REGIONS: { value: SabcallRegion; label: string; hint: string }[] = [
  { value: "IN", label: "India", hint: "DLT / TRAI" },
  { value: "US", label: "United States", hint: "STIR/SHAKEN · 10DLC" },
  { value: "OTHER", label: "Other", hint: "General" },
];

export function SabcallSetupClient({
  projectId,
  initial,
}: {
  projectId: string;
  initial: SabcallSetupState;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [businessName, setBusinessName] = React.useState(initial.businessName ?? "");
  const [region, setRegion] = React.useState<SabcallRegion | null>(initial.region);
  const [website, setWebsite] = React.useState(initial.businessProfile?.website ?? "");
  const [industry, setIndustry] = React.useState(initial.businessProfile?.industry ?? "");
  const [useCase, setUseCase] = React.useState(initial.businessProfile?.useCase ?? "");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const finish = React.useCallback(async () => {
    if (!businessName.trim()) {
      setErr("Business name is required.");
      return;
    }
    if (!region) {
      setErr("Pick a region.");
      return;
    }
    setBusy(true);
    setErr(null);

    const saved = await saveSabcallProfileStep(projectId, {
      businessName: businessName.trim(),
      region,
      businessProfile: { website, industry, useCase },
    });
    if (!saved.success) {
      setErr(saved.error);
      setBusy(false);
      return;
    }

    const done = await completeSabcallSetup(projectId);
    if (!done.success) {
      setErr(done.error);
      setBusy(false);
      return;
    }

    toast({ title: "Setup complete", description: "Your SabCall workspace is ready." });
    router.push("/sabcall");
  }, [businessName, region, website, industry, useCase, projectId, router, toast]);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Set up your SabCall workspace</PageTitle>
          <PageDescription>
            A quick business profile to finish. Numbers, SIP trunks, and routing
            are configured once your workspace is unlocked.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      <Card className="mt-6 flex flex-col gap-5 p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--st-text)]">
          <PhoneCall className="h-4 w-4" aria-hidden /> Business profile
        </div>

        <Field label="Business name" error={err && !businessName.trim() ? err : undefined}>
          <Input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="e.g. Acme Inc."
            maxLength={120}
            autoFocus
          />
        </Field>

        <Field label="Region" error={err && !region ? err : undefined}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {REGIONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRegion(r.value)}
                className={`flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors ${
                  region === r.value
                    ? "border-[var(--st-primary,var(--st-accent))] bg-[var(--st-bg-muted)]"
                    : "border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]"
                }`}
              >
                <span className="text-sm font-medium text-[var(--st-text)]">{r.label}</span>
                <span className="text-xs text-[var(--st-text-secondary)]">{r.hint}</span>
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Website (optional)">
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://acme.com"
            />
          </Field>
          <Field label="Industry (optional)">
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. SaaS"
            />
          </Field>
        </div>

        <Field label="Primary use case (optional)">
          <Input
            value={useCase}
            onChange={(e) => setUseCase(e.target.value)}
            placeholder="e.g. Inbound support line + outbound sales"
          />
        </Field>

        {err && businessName.trim() && region ? (
          <p className="text-sm text-[var(--st-status-danger,#dc2626)]">{err}</p>
        ) : null}

        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            iconRight={ArrowRight}
            className="sc-press"
            loading={busy}
            disabled={busy}
            onClick={() => void finish()}
          >
            Finish setup
          </Button>
        </div>
      </Card>
    </div>
  );
}

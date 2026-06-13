"use client";

import React, { useEffect, useState, useTransition } from "react";
import {
  Download,
  FileText,
  ShieldCheck,
  Inbox,
  EyeOff,
  Info,
  CheckCircle2,
} from "lucide-react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import { SabsmsEmpty } from "@/components/sabsms/page-toolkit/sabsms-states";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  StatCard,
  Badge,
} from "@/components/sabcrm/20ui";
import { toast } from "sonner";

import {
  loadGdprStats,
  exportConsentLedgerCsv,
  type GdprStats,
} from "./actions";

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GDPRPage() {
  const [stats, setStats] = useState<GdprStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadGdprStats().then((res) => {
      if (res.success) setStats(res.stats);
      else setLoadError(res.error);
    });
  }, []);

  const handleExport = () => {
    startTransition(async () => {
      const res = await exportConsentLedgerCsv();
      if (res.success) {
        const stamp = new Date().toISOString().slice(0, 10);
        downloadText(
          res.csv,
          `sabsms-consent-ledger-${stamp}.csv`,
          "text/csv",
        );
        toast.success(`Exported ${res.rows.toLocaleString()} consent events.`);
      } else {
        toast.error(res.error);
      }
    });
  };

  return (
    <SabsmsPageShell
      title="GDPR & Privacy"
      eyebrow="Compliance"
      description="Export the consent ledger that evidences GDPR/CCPA compliance. Data-subject-request intake and auto-redaction are on the roadmap."
      breadcrumbs={[
        { label: "Compliance", href: "/sabsms/compliance" },
        { label: "GDPR" },
      ]}
      helpTitle="GDPR Center"
      helpBody="The consent ledger is the live evidence trail for opt-in/opt-out. It stores phone HASHES only (so the list survives an erasure). DSR intake + PII redaction need backend support before they can operate."
      primaryAction={{
        label: isPending ? "Exporting…" : "Export consent ledger (CSV)",
        onClick: handleExport,
      }}
    >
      {loadError && (
        <Card className="mb-6">
          <CardBody>
            <p className="text-sm text-[var(--st-text)]">{loadError}</p>
          </CardBody>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Consent events"
          value={stats ? stats.consentEvents.toLocaleString() : "…"}
          icon={<FileText />}
        />
        <StatCard
          label="Opt-ins"
          value={stats ? stats.optIns.toLocaleString() : "…"}
          icon={<CheckCircle2 />}
        />
        <StatCard
          label="Opt-outs"
          value={stats ? stats.optOuts.toLocaleString() : "…"}
          icon={<ShieldCheck />}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-4 w-4" /> Consent ledger export
              </CardTitle>
              <CardDescription>
                Append-only opt-in / opt-out evidence from{" "}
                <code>sabsms_consent_log</code>. Phone numbers are stored as
                SHA-256 hashes only.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-muted)]/40 p-4 text-sm">
                <Info className="h-5 w-5 shrink-0 text-[var(--st-text-secondary)]" />
                <p className="text-[var(--st-text-secondary)]">
                  This is a real export of your workspace's live consent events
                  — not a sample. Use it as the audit trail for a regulator or
                  DPA request.
                </p>
              </div>
              <Button onClick={handleExport} disabled={isPending}>
                <Download className="mr-2 h-4 w-4" />
                {isPending ? "Exporting…" : "Download CSV"}
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Inbox className="h-4 w-4" /> Data Subject Requests (DSR)
                </CardTitle>
                <CardDescription className="mt-1">
                  SAR, rectification, and erasure intake.
                </CardDescription>
              </div>
              <Badge variant="outline">Coming soon</Badge>
            </CardHeader>
            <CardBody>
              <SabsmsEmpty
                icon={<Inbox className="h-6 w-6" />}
                title="DSR intake not yet available"
                description="There is no DSR queue backend in this build, so we don't show a fabricated inbox. Erasure today is performed by suppressing the phone hash and exporting the consent ledger above as evidence. A dedicated SAR/erasure workflow is planned."
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" /> PII auto-redaction
                </CardTitle>
                <CardDescription className="mt-1">
                  Real-time redaction across SMS payloads.
                </CardDescription>
              </div>
              <Badge variant="outline">Coming soon</Badge>
            </CardHeader>
            <CardBody>
              <SabsmsEmpty
                icon={<EyeOff className="h-6 w-6" />}
                title="No redaction engine yet"
                description="There is no PII-detection backend in this build. Rather than show fake match counts, this is disabled until the redaction engine ships."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> What is real today
              </CardTitle>
            </CardHeader>
            <CardBody className="space-y-3 text-sm text-[var(--st-text-secondary)]">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                Consent ledger export (above) — live data.
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                Opt-out suppression — managed on the{" "}
                <a className="underline" href="/sabsms/suppressions">
                  Suppressions
                </a>{" "}
                page.
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                Per-event consent history — on the{" "}
                <a className="underline" href="/sabsms/consent">
                  Consent
                </a>{" "}
                page.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </SabsmsPageShell>
  );
}

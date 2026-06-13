import React from "react";
import Link from "next/link";
import {
  Shield,
  Map as MapIcon,
  KeyRound,
  ScrollText,
  FileLock2,
  ArrowRight,
  Clock,
} from "lucide-react";

import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Badge,
  StatCard,
  Button,
} from "@/components/sabcrm/20ui";

import { loadComplianceHub, type ComplianceHubData } from "./hub-actions";

export const dynamic = "force-dynamic";

function consentCoverage(d: ComplianceHubData): number | null {
  // Coverage = opt-ins as a share of all consent decisions on record.
  // Honest: this is opt-in / (opt-in + opt-out), not a fabricated %.
  const denom = d.consent.optIns + d.consent.optOuts;
  if (denom === 0) return null;
  return Math.round((d.consent.optIns / denom) * 100);
}

function SubpageCard({
  href,
  icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  meta?: React.ReactNode;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full transition-colors group-hover:border-[var(--st-border-strong)]">
        <CardBody className="flex items-start gap-4 p-5">
          <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center text-[var(--st-text)]">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-[var(--st-text)]">{title}</p>
              <ArrowRight className="h-4 w-4 text-[var(--st-text-secondary)] opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">
              {description}
            </p>
            {meta && <div className="mt-2">{meta}</div>}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

export default async function ComplianceHubPage() {
  const res = await loadComplianceHub();

  return (
    <SabsmsPageShell
      title="Compliance"
      eyebrow="Workspace Governance"
      description="Consent, suppression, and registry status — counted live from your workspace. Open a registry below to manage it."
    >
      {!res.success ? (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--st-text)]">{res.error}</p>
          </CardBody>
        </Card>
      ) : (
        <ComplianceHub data={res.data} />
      )}
    </SabsmsPageShell>
  );
}

function ComplianceHub({ data }: { data: ComplianceHubData }) {
  const coverage = consentCoverage(data);

  return (
    <>
      {/* Real metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Opt-in coverage"
          value={coverage === null ? "—" : `${coverage}%`}
        />
        <StatCard
          label="Consent events"
          value={data.consent.total.toLocaleString()}
        />
        <StatCard
          label="Suppressed numbers"
          value={data.suppressions.total.toLocaleString()}
        />
        <StatCard
          label="STOP opt-outs"
          value={data.consent.stopKeywordOptOuts.toLocaleString()}
        />
      </div>

      {/* Registry status — REAL counts, linked to the real subpages */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>India DLT registry</CardTitle>
            <CardDescription>
              Mirrored operator-portal registrations the engine scrubs against.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-3">
              <div>
                <p className="font-medium text-[var(--st-text)]">DLT registry</p>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  {data.dlt.entities} entities · {data.dlt.headers} headers ·{" "}
                  {data.dlt.templates} templates
                </p>
              </div>
              <Badge variant={data.dlt.configured ? "secondary" : "outline"}>
                {data.dlt.configured ? "Configured" : "Not set up"}
              </Badge>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sabsms/compliance/dlt">Manage DLT registry</Link>
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>US 10DLC</CardTitle>
            <CardDescription>
              A2P brand/campaign registration per provider account.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-[var(--st-border)] p-3">
              <div>
                <p className="font-medium text-[var(--st-text)]">
                  Provider accounts
                </p>
                <p className="text-sm text-[var(--st-text-secondary)]">
                  {data.tenDlc.registered} registered · {data.tenDlc.pending}{" "}
                  pending · {data.tenDlc.accounts} total
                </p>
              </div>
              <Badge
                variant={data.tenDlc.registered > 0 ? "secondary" : "outline"}
              >
                {data.tenDlc.registered > 0
                  ? "Some cleared"
                  : "None registered"}
              </Badge>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link href="/sabsms/compliance/10dlc">Manage 10DLC</Link>
            </Button>
          </CardBody>
        </Card>
      </div>

      {/* Subpage navigation */}
      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        Compliance tools
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SubpageCard
          href="/sabsms/compliance/dlt"
          icon={<MapIcon className="h-5 w-5" />}
          title="India DLT registry"
          description="Principal entities, headers, content templates, and the PE→TM chain."
        />
        <SubpageCard
          href="/sabsms/compliance/10dlc"
          icon={<Shield className="h-5 w-5" />}
          title="US 10DLC registration"
          description="Record brand/campaign IDs to clear US marketing per account."
        />
        <SubpageCard
          href="/sabsms/compliance/keywords"
          icon={<KeyRound className="h-5 w-5" />}
          title="STOP / HELP keywords"
          description="Custom opt-out/help synonyms and the engine auto-reply text."
        />
        <SubpageCard
          href="/sabsms/compliance/audit"
          icon={<ScrollText className="h-5 w-5" />}
          title="Audit ledger"
          description="Append-only consent events and engine-blocked sends."
        />
        <SubpageCard
          href="/sabsms/compliance/gdpr"
          icon={<FileLock2 className="h-5 w-5" />}
          title="GDPR & privacy"
          description="Export the consent ledger that evidences GDPR/CCPA compliance."
        />
        <SubpageCard
          href="/sabsms/suppressions"
          icon={<Shield className="h-5 w-5" />}
          title="Suppression list"
          description={`${data.suppressions.total.toLocaleString()} suppressed numbers (${data.suppressions.fromStop.toLocaleString()} from STOP).`}
        />
      </div>

      {/* Quiet hours — generated from the engine window table (correct copy) */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" /> Engine quiet-hours windows
          </CardTitle>
          <CardDescription>
            Promotional traffic is only allowed inside these windows (from the
            engine's quiet-hours table).
          </CardDescription>
        </CardHeader>
        <CardBody className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[var(--st-border)] p-3">
            <p className="text-sm font-medium text-[var(--st-text)]">
              India (TRAI)
            </p>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
              Promo allowed 10:00–21:00 IST. Outside that window is blocked.
            </p>
          </div>
          <div className="rounded-md border border-[var(--st-border)] p-3">
            <p className="text-sm font-medium text-[var(--st-text)]">
              United States
            </p>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
              Conservative ~11:00–21:00 ET window (legal in all continental
              zones).
            </p>
          </div>
          <div className="rounded-md border border-[var(--st-border)] p-3">
            <p className="text-sm font-medium text-[var(--st-text)]">Canada</p>
            <p className="text-xs text-[var(--st-text-secondary)] mt-1">
              Same conservative window as the US.
            </p>
          </div>
        </CardBody>
      </Card>
    </>
  );
}

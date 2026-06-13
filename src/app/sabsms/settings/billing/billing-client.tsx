"use client";

import React, { useEffect, useState } from "react";
import { SabsmsPageShell } from "@/components/sabsms/page-toolkit/sabsms-page-shell";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  Button,
  Badge,
  Progress,
  StatCard,
  DataTable,
  type DataTableColumn,
} from "@/components/sabcrm/20ui";
import {
  Download,
  TrendingUp,
  Activity,
  CreditCard as CreditCardIcon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ArrowUpRight,
  MessageSquare,
  Bot,
} from "lucide-react";
import { fmtDate, fmtQty } from "@/lib/utils";
import { rowsToCsv } from "@/components/sabsms/page-toolkit";
import {
  getBillingOverviewAction,
  type BillingLedgerRow,
  type BillingOverview,
} from "./actions";

/** Platform-native surfaces — SabSMS is prepaid-credit only and defers
 *  payment-method + plan management to the workspace billing pages. */
const PLATFORM_BILLING_URL = "/dashboard/user/billing";
const PLATFORM_PLANS_URL = "/dashboard/plans";

function kindBadge(kind: BillingLedgerRow["kind"]) {
  if (kind === "release") return <Badge variant="info">Refund</Badge>;
  if (kind === "adjust") return <Badge variant="warning">Adjustment</Badge>;
  return <Badge variant="secondary">Debit</Badge>;
}

const billingColumns: DataTableColumn<BillingLedgerRow>[] = [
  {
    key: "at",
    header: "Date",
    width: "180px",
    render: (row) => <span className="text-[var(--st-text)]">{fmtDate(row.at)}</span>,
  },
  {
    key: "description",
    header: "Description",
    render: (row) => <span className="text-[var(--st-text)]">{row.description}</span>,
  },
  {
    key: "kind",
    header: "Type",
    width: "120px",
    render: (row) => kindBadge(row.kind),
  },
  {
    key: "delta",
    header: "Credits",
    width: "120px",
    align: "right",
    render: (row) => (
      <span
        className="font-medium"
        style={{ color: row.delta < 0 ? "var(--st-danger)" : "var(--st-status-ok)" }}
      >
        {row.delta > 0 ? "+" : ""}
        {fmtQty(row.delta)}
      </span>
    ),
  },
  {
    key: "balanceAfter",
    header: "Balance",
    width: "120px",
    align: "right",
    render: (row) => (
      <span className="text-[var(--st-text-secondary)]">
        {row.balanceAfter == null ? "—" : fmtQty(row.balanceAfter)}
      </span>
    ),
  },
];

function BillingSettingsPageContent() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getBillingOverviewAction();
    if (res.success) {
      setOverview(res.overview);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function exportCsv() {
    if (!overview) return;
    const csv = rowsToCsv(
      overview.history as unknown as Array<Record<string, unknown>>,
      [
        { key: "at", header: "date" },
        { key: "description", header: "description" },
        { key: "kind", header: "type" },
        { key: "delta", header: "credits" },
        { key: "balanceAfter", header: "balanceAfter" },
      ],
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sabsms-credit-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <SabsmsPageShell
      title="Billing & Credits"
      description="Your real SabSMS credit balance and spend, drawn directly from the credit ledger."
      eyebrow="Settings"
      breadcrumbs={[{ label: "Settings" }, { label: "Billing" }]}
      primaryAction={{
        label: "Top up credits",
        href: PLATFORM_BILLING_URL,
      }}
      secondaryActions={[
        {
          label: "Export ledger CSV",
          icon: <Download className="h-4 w-4" />,
          onSelectAction: () => void exportCsv(),
        },
        {
          label: "Manage plan",
          icon: <ArrowUpRight className="h-4 w-4" />,
          onSelectHref: PLATFORM_PLANS_URL,
        },
      ]}
      helpTitle="How SabSMS billing works"
      helpBody="SabSMS runs on prepaid credits. Each send reserves credits and settles against the real send outcome; refunds and adjustments are logged below. Top-ups and plan changes are handled in your workspace billing settings."
    >
      {error && (
        <Card className="mt-6 border-[var(--st-danger)]/50 bg-[var(--st-danger)]/5">
          <CardBody className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[var(--st-danger)]">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Real balance + spend KPIs */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Credit balance"
          value={loading || !overview ? "—" : fmtQty(overview.balance)}
          icon={<Wallet />}
        />
        <StatCard
          label="Spent (30 days)"
          value={loading || !overview ? "—" : fmtQty(overview.spent30d)}
          icon={<TrendingUp />}
        />
        <StatCard
          label="Spent this month"
          value={loading || !overview ? "—" : fmtQty(overview.spentThisMonth)}
          icon={<Activity />}
        />
        <StatCard
          label="Runway"
          value={
            loading || !overview
              ? "—"
              : overview.runwayDays == null
                ? "No recent spend"
                : `${overview.runwayDays} days`
          }
          icon={<RefreshCw />}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Burn-rate (real) */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[var(--st-text-secondary)]" />
              Burn rate
            </CardTitle>
            <CardDescription>Trailing 30-day average</CardDescription>
          </CardHeader>
          <CardBody>
            <div className="text-3xl font-bold text-[var(--st-text)]">
              {loading || !overview ? "—" : `${fmtQty(Math.round(overview.avgPerDay))}`}
            </div>
            <p className="mt-1 text-sm text-[var(--st-text-secondary)]">credits / day</p>
            {overview && overview.avgPerDay > 0 && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-[var(--st-text-secondary)]">
                  <span>Balance runway</span>
                  <span>
                    {overview.runwayDays == null ? "—" : `${overview.runwayDays}d`}
                  </span>
                </div>
                <Progress
                  value={
                    overview.runwayDays == null
                      ? 100
                      : Math.max(2, Math.min(100, (overview.runwayDays / 30) * 100))
                  }
                  tone={
                    overview.runwayDays != null && overview.runwayDays < 7
                      ? "warning"
                      : "accent"
                  }
                />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Send mix (real counts) */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-[var(--st-text)]" />
              Charged activity (30 days)
            </CardTitle>
            <CardDescription>
              Real debit movements from the credit ledger
            </CardDescription>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--st-border)] p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded bg-[var(--st-bg-muted)]">
                <MessageSquare className="h-5 w-5 text-[var(--st-text-secondary)]" />
              </span>
              <div>
                <div className="text-2xl font-bold text-[var(--st-text)]">
                  {loading || !overview ? "—" : fmtQty(overview.messageSends30d)}
                </div>
                <p className="text-xs text-[var(--st-text-secondary)]">Message sends</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--st-border)] p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded bg-[var(--st-bg-muted)]">
                <Bot className="h-5 w-5 text-[var(--st-text-secondary)]" />
              </span>
              <div>
                <div className="text-2xl font-bold text-[var(--st-text)]">
                  {loading || !overview ? "—" : fmtQty(overview.agentTurns30d)}
                </div>
                <p className="text-xs text-[var(--st-text-secondary)]">AI agent turns</p>
              </div>
            </div>
          </CardBody>
          <CardFooter className="text-xs text-[var(--st-text-secondary)]">
            <CheckCircle2 className="mr-2 h-4 w-4 text-[var(--st-status-ok)]" />
            Figures reflect actual settled charges, not estimates.
          </CardFooter>
        </Card>
      </div>

      {/* Real ledger history */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Credit ledger</CardTitle>
          <CardDescription>
            Every debit, refund, and adjustment for this workspace (last 100 movements).
          </CardDescription>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="h-40 animate-pulse rounded-[var(--st-radius)] bg-[var(--st-bg-muted)]" />
          ) : (
            <DataTable
              columns={billingColumns}
              rows={overview?.history ?? []}
              getRowId={(row) => row.id}
              empty={
                <div className="py-8 text-center text-sm text-[var(--st-text-secondary)]">
                  No credit movements yet. Sends will appear here once you start
                  messaging.
                </div>
              }
            />
          )}
        </CardBody>
      </Card>

      {/* Payment method + plan — handled by the platform, linked honestly */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCardIcon className="h-5 w-5 text-[var(--st-text-secondary)]" />
              Payment method
            </CardTitle>
            <CardDescription>Managed in your SabNode workspace billing</CardDescription>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-[var(--st-text-secondary)]">
              Credit top-ups and saved payment methods live in your workspace
              billing settings, shared across all SabNode modules.
            </p>
          </CardBody>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <a href={PLATFORM_BILLING_URL}>Open workspace billing</a>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="h-5 w-5 text-[var(--st-text-secondary)]" />
              Plan &amp; subscription
            </CardTitle>
            <CardDescription>Change your SabNode plan</CardDescription>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-[var(--st-text-secondary)]">
              SabSMS feature gates follow your workspace plan. Review or upgrade
              your plan from the platform plans page.
            </p>
          </CardBody>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <a href={PLATFORM_PLANS_URL}>Manage plan</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </SabsmsPageShell>
  );
}

export default function BillingSettingsPage() {
  return <BillingSettingsPageContent />;
}

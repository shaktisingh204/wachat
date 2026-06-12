"use client";

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Server,
  ShieldAlert,
  XCircle,
  Zap,
} from "lucide-react";
import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  StatCard,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/sabcrm/20ui";
import { SabsmsPageShell, SabsmsRefreshButton } from "@/components/sabsms/page-toolkit";
import {
  SabsmsEmpty,
  SabsmsErrorState,
  SabsmsTableSkeleton,
} from "@/components/sabsms/page-toolkit/sabsms-states";
import type { SabsmsProviderHealthAccount } from "@/lib/sabsms/engine-client";
import { getProviderHealthAction } from "./actions";

const REFRESH_MS = 10_000;

function CircuitChip({ circuit }: { circuit: "closed" | "open" | "half_open" }) {
  if (circuit === "open") {
    return (
      <Badge tone="danger" kind="outline">
        <XCircle className="h-3 w-3 mr-1" aria-hidden="true" />
        open
      </Badge>
    );
  }
  if (circuit === "half_open") {
    return (
      <Badge tone="warning" kind="outline">
        <AlertTriangle className="h-3 w-3 mr-1" aria-hidden="true" />
        probing
      </Badge>
    );
  }
  return (
    <Badge tone="success" kind="outline">
      <CheckCircle2 className="h-3 w-3 mr-1" aria-hidden="true" />
      closed
    </Badge>
  );
}

function ScoreBadge({ score, volume }: { score: number; volume: number }) {
  if (volume === 0) {
    return (
      <Badge tone="neutral" kind="outline">
        —
      </Badge>
    );
  }
  const pct = Math.round(score * 100);
  const tone = score >= 0.95 ? "success" : score >= 0.85 ? "warning" : "danger";
  return (
    <Badge tone={tone} kind="outline">
      {pct}%
    </Badge>
  );
}

function AccountCard({ account }: { account: SabsmsProviderHealthAccount }) {
  const totals = account.byCountry.reduce(
    (acc, c) => ({
      sent: acc.sent + c.sent,
      delivered: acc.delivered + c.delivered,
      failed: acc.failed + c.failed,
    }),
    { sent: 0, delivered: 0, failed: 0 },
  );
  const openCircuits = account.byCountry.filter((c) => c.circuit === "open").length;
  const probing = account.byCountry.filter((c) => c.circuit === "half_open").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="h-4 w-4 shrink-0 text-[var(--st-text)]" aria-hidden="true" />
            <CardTitle className="text-base truncate">
              {account.provider} · {account.accountId.slice(-6)}
            </CardTitle>
            {account.isDefault ? (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                default
              </Badge>
            ) : null}
            {account.status !== "active" ? (
              <Badge tone="danger" kind="outline">
                {account.status}
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
            {openCircuits > 0 ? (
              <span className="flex items-center gap-1 text-[var(--st-danger)]">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                {openCircuits} circuit{openCircuits > 1 ? "s" : ""} open
              </span>
            ) : probing > 0 ? (
              <span className="flex items-center gap-1 text-[var(--st-warn)]">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                probing
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--st-status-ok)]" aria-hidden="true" />
                healthy
              </span>
            )}
          </div>
        </div>
        <CardDescription>
          Last ~10 minutes: {totals.sent.toLocaleString()} sent ·{" "}
          {totals.delivered.toLocaleString()} delivered · {totals.failed.toLocaleString()} failed
        </CardDescription>
      </CardHeader>
      <CardBody>
        {account.byCountry.length === 0 ? (
          <div className="text-sm text-[var(--st-text-secondary)] border border-dashed border-[var(--st-border)] rounded-[var(--st-radius)] p-4">
            No traffic in the current window — stats appear as soon as this account sends.
          </div>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Country</Th>
                <Th>Sent</Th>
                <Th>Delivered</Th>
                <Th>Failed</Th>
                <Th>Score</Th>
                <Th>DLR latency</Th>
                <Th>Circuit</Th>
              </Tr>
            </THead>
            <TBody>
              {account.byCountry.map((c) => (
                <Tr key={c.country}>
                  <Td className="font-medium">{c.country}</Td>
                  <Td>{c.sent.toLocaleString()}</Td>
                  <Td>{c.delivered.toLocaleString()}</Td>
                  <Td>{c.failed.toLocaleString()}</Td>
                  <Td>
                    <ScoreBadge score={c.score} volume={c.delivered + c.failed} />
                  </Td>
                  <Td>{c.lastDlrMs != null ? `${(c.lastDlrMs / 1000).toFixed(1)}s` : "—"}</Td>
                  <Td>
                    <CircuitChip circuit={c.circuit} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

export default function HealthMonitorPage() {
  const [accounts, setAccounts] = React.useState<SabsmsProviderHealthAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    const res = await getProviderHealthAction();
    if (res.success) {
      setAccounts(res.accounts);
      setError(null);
      setLastUpdated(new Date());
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Auto-refresh every 10s while the tab is visible.
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) void load();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const totals = accounts.reduce(
    (acc, a) => {
      for (const c of a.byCountry) {
        acc.sent += c.sent;
        acc.delivered += c.delivered;
        acc.failed += c.failed;
        if (c.circuit === "open") acc.openCircuits += 1;
      }
      return acc;
    },
    { sent: 0, delivered: 0, failed: 0, openCircuits: 0 },
  );
  const outcomes = totals.delivered + totals.failed;
  const overallRate = outcomes > 0 ? (totals.delivered / outcomes) * 100 : null;

  return (
    <SabsmsPageShell
      title="Provider Health"
      eyebrow="System Status"
      description="Rolling per-account delivery health and circuit-breaker state, by destination country. The router skips open circuits automatically."
      breadcrumbs={[{ label: "Health", href: "/sabsms/health" }]}
      toolbar={
        <div className="flex items-center gap-4">
          <div className="flex items-center text-xs text-[var(--st-text-secondary)]">
            <Zap className="h-3 w-3 mr-1 text-[var(--st-text)]" aria-hidden="true" />
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()} · auto-refresh ${REFRESH_MS / 1000}s`
              : "Loading…"}
          </div>
          <SabsmsRefreshButton onRefresh={load} />
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Accounts" value={String(accounts.length)} icon={Server} />
          <StatCard
            label="Sent (window)"
            value={totals.sent.toLocaleString()}
            icon={Activity}
          />
          <StatCard
            label="Delivery rate"
            value={overallRate != null ? `${overallRate.toFixed(1)}%` : "—"}
            icon={CheckCircle2}
          />
          <StatCard
            label="Open circuits"
            value={String(totals.openCircuits)}
            icon={ShieldAlert}
          />
        </div>

        {loading ? (
          <SabsmsTableSkeleton columns={7} rows={4} />
        ) : error ? (
          <SabsmsErrorState message={error} onRetry={load} />
        ) : accounts.length === 0 ? (
          <SabsmsEmpty
            icon={<Server />}
            title="No provider accounts"
            description="Connect a provider account to see its rolling delivery health here."
            action={{ label: "Configure providers", href: "/sabsms/providers" }}
          />
        ) : (
          <div className="space-y-6">
            {accounts.map((a) => (
              <AccountCard key={a.accountId} account={a} />
            ))}
          </div>
        )}
      </div>
    </SabsmsPageShell>
  );
}

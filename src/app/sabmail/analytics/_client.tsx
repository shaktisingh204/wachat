"use client";

import * as React from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Send,
  Users,
  XCircle,
} from "lucide-react";

import {
  Badge,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  TBody,
  THead,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/sabcrm/20ui";
import { CountUp } from "@/components/sabmail/motion";
import type {
  SabmailAnalyticsKpis,
  SabmailRecentCampaign,
} from "./actions";
import "@/components/sabmail/motion/sabmail-motion.css";

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

interface KpiTile {
  key: string;
  label: string;
  value: number;
  icon: IconType;
  tone: "default" | "ok" | "err";
}

const TONE_COLOR: Record<KpiTile["tone"], string> = {
  default: "var(--st-accent)",
  ok: "var(--st-status-ok,#16a34a)",
  err: "var(--st-status-err,#dc2626)",
};

/** Map a campaign status to a Badge variant. */
function statusVariant(
  status: string,
): "default" | "outline" | "secondary" | "destructive" {
  const s = status.toLowerCase();
  if (s === "sent" || s === "completed" || s === "delivered") return "default";
  if (s === "failed" || s === "cancelled" || s === "canceled") return "destructive";
  if (s === "sending" || s === "scheduled" || s === "queued") return "secondary";
  return "outline";
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SabmailAnalyticsClient({
  kpis,
  recentCampaigns,
  loadError,
}: {
  kpis: SabmailAnalyticsKpis;
  recentCampaigns: SabmailRecentCampaign[];
  loadError: string | null;
}) {
  const tiles: KpiTile[] = [
    { key: "sent", label: "Total sent", value: kpis.sent, icon: Send, tone: "ok" },
    { key: "failed", label: "Total failed", value: kpis.failed, icon: XCircle, tone: "err" },
    { key: "campaigns", label: "Campaigns", value: kpis.campaigns, icon: BarChart3, tone: "default" },
    { key: "contacts", label: "Contacts", value: kpis.contacts, icon: Users, tone: "default" },
    { key: "accounts", label: "Mailboxes", value: kpis.accounts, icon: CheckCircle2, tone: "default" },
  ];

  const hasAnyData =
    kpis.campaigns > 0 ||
    kpis.sent > 0 ||
    kpis.failed > 0 ||
    kpis.contacts > 0 ||
    kpis.accounts > 0;

  return (
    <div className="sabmail-motion mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Analytics</PageTitle>
          <PageDescription>
            A read-only snapshot of this workspace — campaign volume, delivery
            outcomes, contacts, and connected mailboxes.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {loadError ? (
        <div
          className="mt-6 flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm"
          style={{
            borderColor: "var(--st-status-err,#dc2626)",
            color: "var(--st-status-err,#dc2626)",
            background: "var(--st-bg-muted)",
          }}
          role="alert"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Could not load analytics: {loadError}</span>
        </div>
      ) : null}

      {/* KPI tiles */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t, idx) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.key}
              className="sabmail-stagger-item flex flex-col gap-3 p-4"
              style={{ ["--i" as string]: idx } as React.CSSProperties}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--st-text-secondary)]">
                  {t.label}
                </span>
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[var(--st-bg-muted)]"
                  style={{ color: TONE_COLOR[t.tone] }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div
                className="text-2xl font-semibold tabular-nums"
                style={{ color: t.tone === "default" ? "var(--st-text)" : TONE_COLOR[t.tone] }}
              >
                <CountUp value={t.value} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent campaigns */}
      <div className="mt-6">
        <Card
          className="sabmail-stagger-item"
          style={{ ["--i" as string]: tiles.length } as React.CSSProperties}
        >
          <CardHeader>
            <CardTitle>Recent campaigns</CardTitle>
            <CardDescription>
              Latest sends with their delivery split.
            </CardDescription>
          </CardHeader>
          <CardBody>
            {recentCampaigns.length === 0 ? (
              <EmptyState
                icon={<BarChart3 aria-hidden />}
                title={hasAnyData ? "No campaigns yet" : "Nothing to report yet"}
                description={
                  hasAnyData
                    ? "Once you send a campaign it will appear here with delivery stats."
                    : "Connect a mailbox, add contacts, and send a campaign to populate this dashboard."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <Tr>
                      <Th>Campaign</Th>
                      <Th>Status</Th>
                      <Th>Delivered / Failed</Th>
                      <Th>Created</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {recentCampaigns.map((c) => {
                      const total = c.sent + c.failed;
                      const sentPct = total > 0 ? (c.sent / total) * 100 : 0;
                      const failedPct = total > 0 ? (c.failed / total) * 100 : 0;
                      return (
                        <Tr key={c.id}>
                          <Td>
                            <span className="font-medium text-[var(--st-text)]">
                              {c.name}
                            </span>
                          </Td>
                          <Td>
                            <Badge variant={statusVariant(c.status)} className="capitalize">
                              {c.status}
                            </Badge>
                          </Td>
                          <Td>
                            <div className="flex min-w-[180px] flex-col gap-1.5">
                              <div className="flex items-center justify-between text-xs text-[var(--st-text-secondary)]">
                                <span style={{ color: "var(--st-status-ok,#16a34a)" }}>
                                  {c.sent.toLocaleString()} sent
                                </span>
                                <span style={{ color: "var(--st-status-err,#dc2626)" }}>
                                  {c.failed.toLocaleString()} failed
                                </span>
                              </div>
                              <div
                                className="flex h-2 w-full overflow-hidden rounded-full"
                                style={{ background: "var(--st-bg-muted)" }}
                                role="img"
                                aria-label={`${c.sent} delivered, ${c.failed} failed`}
                              >
                                <span
                                  className="h-full"
                                  style={{
                                    width: `${sentPct}%`,
                                    background: "var(--st-status-ok,#16a34a)",
                                  }}
                                />
                                <span
                                  className="h-full"
                                  style={{
                                    width: `${failedPct}%`,
                                    background: "var(--st-status-err,#dc2626)",
                                  }}
                                />
                              </div>
                            </div>
                          </Td>
                          <Td>
                            <span className="text-sm text-[var(--st-text-secondary)]">
                              {formatDate(c.createdAt)}
                            </span>
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";

import {
  Card,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
} from "@/components/sabcrm/20ui";
import { getSabchatReports } from "@/app/actions/sabchat-analytics.actions";
import {
  gamificationLeaderboard,
  adAttributionReport,
  aiQaLeaderboard,
} from "@/app/actions/sabchat-ops.actions";
import { VocPanel } from "./_components/voc-panel";

export const dynamic = "force-dynamic";

function fmtMin(m: number): string {
  if (!m || m < 1) return "—";
  if (m < 60) return `${Math.round(m)}m`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "err"
      ? "text-red-500"
      : tone === "warn"
        ? "text-amber-500"
        : "text-[var(--st-text)]";
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--st-text-secondary)]">{hint}</p> : null}
    </Card>
  );
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[];
  rows: (string | number)[][];
  empty: string;
}) {
  if (!rows.length) {
    return (
      <p className="px-4 py-6 text-center text-sm text-[var(--st-text-secondary)]">{empty}</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--st-border)] text-left text-xs uppercase tracking-wide text-[var(--st-text-secondary)]">
            {head.map((h) => (
              <th key={h} className="px-4 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--st-border)] last:border-0">
              {r.map((c, j) => (
                <td key={j} className="px-4 py-2 text-[var(--st-text)]">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function SabchatReportsPage() {
  const [reports, leaderboard, adReport, qa] = await Promise.all([
    getSabchatReports(),
    gamificationLeaderboard(),
    adAttributionReport("campaign"),
    aiQaLeaderboard(),
  ]);
  if (!reports) redirect("/sabchat/projects");

  const money = (minor: number, ccy?: string) =>
    `${ccy ?? "$"}${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  const { live, responseTimes, csat, byAgent, byInbox, byChannel } = reports;
  const csatPct =
    csat.mean !== undefined ? `${Math.round((csat.mean / 5) * 100)}%` : "—";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Reports</PageTitle>
          <PageDescription>
            Live queue health, response times, satisfaction, and per-agent /
            inbox / channel performance.
          </PageDescription>
        </PageHeaderHeading>
      </PageHeader>

      {/* Live queue */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Open" value={live.openCount} />
        <StatCard label="Pending" value={live.pendingCount} />
        <StatCard label="Snoozed" value={live.snoozedCount} />
        <StatCard
          label="SLA breached"
          value={live.slaBreachedCount}
          tone={live.slaBreachedCount > 0 ? "err" : "ok"}
        />
        <StatCard
          label="Longest wait"
          value={fmtMin(live.longestWaitMinutes)}
          tone={live.longestWaitMinutes > 60 ? "warn" : "ok"}
        />
        <StatCard
          label="CSAT"
          value={csatPct}
          hint={`${csat.count} ratings`}
        />
      </div>

      {/* Response times */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">
        First-response time
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Mean" value={fmtMin(responseTimes.mean)} />
        <StatCard label="Median (p50)" value={fmtMin(responseTimes.p50)} />
        <StatCard label="p95" value={fmtMin(responseTimes.p95)} />
        <StatCard label="p99" value={fmtMin(responseTimes.p99)} />
      </div>

      {/* Agent leaderboard */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">By agent</h2>
      <Card className="p-0">
        <Table
          head={["Agent", "Handled", "Resolved", "Open", "Avg 1st response"]}
          rows={byAgent.map((a) => [
            a.agentId,
            a.conversationsHandled,
            a.resolvedCount,
            a.openCount,
            fmtMin(a.avgFirstResponseMin),
          ])}
          empty="No agent activity in this window."
        />
      </Card>

      {/* Inbox rollup */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">By inbox</h2>
      <Card className="p-0">
        <Table
          head={["Inbox", "Channel", "Conversations", "Messages", "Resolved"]}
          rows={byInbox.map((i) => [
            i.name,
            i.channelType,
            i.conversationsCreated,
            i.messagesSent,
            i.resolvedCount,
          ])}
          empty="No inbox activity in this window."
        />
      </Card>

      {/* Channel rollup */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">By channel</h2>
      <Card className="p-0">
        <Table
          head={["Channel", "Conversations", "Messages", "Resolved"]}
          rows={byChannel.map((c) => [
            c.channelType,
            c.conversationsCreated,
            c.messagesSent,
            c.resolvedCount,
          ])}
          empty="No channel activity in this window."
        />
      </Card>

      {/* Gamification leaderboard */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">
        Leaderboard <span className="text-xs font-normal text-[var(--st-text-secondary)]">· this month</span>
      </h2>
      <Card className="p-0">
        <Table
          head={["#", "Agent", "Points", "Resolved", "Badges"]}
          rows={leaderboard.map((r, i) => [
            i + 1,
            r.agentId,
            r.points,
            r.resolvedCount,
            r.badges,
          ])}
          empty="No leaderboard activity yet."
        />
      </Card>

      {/* Ad attribution — chat → revenue */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">
        Revenue attribution <span className="text-xs font-normal text-[var(--st-text-secondary)]">· by campaign</span>
      </h2>
      <Card className="p-0">
        <Table
          head={["Campaign", "Source", "Touches", "Conversations", "Revenue"]}
          rows={adReport.map((r) => [
            r.campaign,
            r.source ?? "—",
            r.touches,
            r.conversations,
            money(r.revenueMinor, r.currency),
          ])}
          empty="No attributed revenue in this window."
        />
      </Card>

      {/* Voice of Customer — AI topic clustering */}
      <div className="mt-8">
        <VocPanel />
      </div>

      {/* AI Quality Assurance */}
      <h2 className="mt-8 mb-2 text-sm font-semibold text-[var(--st-text)]">
        AI quality score <span className="text-xs font-normal text-[var(--st-text-secondary)]">· by agent</span>
      </h2>
      <Card className="p-0">
        <Table
          head={["Agent", "Avg score", "Graded"]}
          rows={qa.map((r) => [
            r.agentId,
            `${Math.round((r.mean ?? 0) * 100) / 100}`,
            r.count,
          ])}
          empty="No AI-graded conversations yet (define a rubric first)."
        />
      </Card>
    </div>
  );
}

import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageActions,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  StatCard,
} from "@/components/zoruui";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";
import { sabsmsEngine, SabsmsEngineError } from "@/lib/sabsms/engine-client";

export const dynamic = "force-dynamic";

interface OverviewCounts {
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  inboundLast24h: number;
}

async function loadCounts(workspaceId: string): Promise<OverviewCounts> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const base = { workspaceId };
  const [total, queued, sent, delivered, failed, inboundLast24h] =
    await Promise.all([
      col.countDocuments(base),
      col.countDocuments({ ...base, status: "queued" }),
      col.countDocuments({ ...base, status: "sent" }),
      col.countDocuments({ ...base, status: "delivered" }),
      col.countDocuments({ ...base, status: "failed" }),
      col.countDocuments({ ...base, direction: "inbound", createdAt: { $gte: since } }),
    ]);
  return { total, queued, sent, delivered, failed, inboundLast24h };
}

interface EngineHealth {
  reachable: boolean;
  version?: string;
  error?: string;
}

async function probeEngine(): Promise<EngineHealth> {
  if ((process.env.SABSMS_ENABLED ?? "false").toLowerCase() !== "true") {
    return { reachable: false, error: "SABSMS_ENABLED=false" };
  }
  try {
    const h = await sabsmsEngine.health();
    return { reachable: !!h.ok, version: h.version };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { reachable: false, error: `${e.status} ${e.message}` };
    }
    return { reachable: false, error: (e as Error)?.message ?? "unreachable" };
  }
}

export default async function SabsmsOverviewPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");

  const emptyCounts: OverviewCounts = {
    total: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    inboundLast24h: 0,
  };
  const [health, counts] = await Promise.all([
    probeEngine(),
    workspaceId ? loadCounts(workspaceId) : Promise.resolve(emptyCounts),
  ]);

  const deliveryRate =
    counts.sent + counts.delivered > 0
      ? Math.round(
          (counts.delivered / (counts.sent + counts.delivered)) * 100,
        )
      : 0;

  return (
    <div className="space-y-6 p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>SabSMS</ZoruPageTitle>
          <ZoruPageDescription>
            Multi-provider SMS / MMS / RCS. The Rust engine
            (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              services/sabsms-engine
            </code>
            ) handles every send, every DLR, and every inbound message.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton asChild>
            <Link href="/sabsms/send">Send a message</Link>
          </ZoruButton>
          <ZoruButton asChild variant="outline">
            <Link href="/sabsms/logs">Open logs</Link>
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Engine status</ZoruCardTitle>
          <ZoruCardDescription>
            Live reachability check against{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              {process.env.SABSMS_ENGINE_URL ?? "http://localhost:4002"}
            </code>
            .
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-wrap items-center gap-3 text-sm">
          {health.reachable ? (
            <ZoruBadge variant="default">healthy</ZoruBadge>
          ) : (
            <ZoruBadge variant="destructive">unreachable</ZoruBadge>
          )}
          {health.version && (
            <span className="text-slate-600">version {health.version}</span>
          )}
          {health.error && (
            <span className="text-rose-600">{health.error}</span>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <ZoruStatCard label="Total" value={counts.total.toLocaleString()} />
        <ZoruStatCard label="Queued" value={counts.queued.toLocaleString()} />
        <ZoruStatCard label="Sent" value={counts.sent.toLocaleString()} />
        <ZoruStatCard
          label="Delivered"
          value={counts.delivered.toLocaleString()}
          period={`${deliveryRate}% rate`}
        />
        <ZoruStatCard label="Failed" value={counts.failed.toLocaleString()} />
        <ZoruStatCard
          label="Inbound 24h"
          value={counts.inboundLast24h.toLocaleString()}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Workflow shortcuts</ZoruCardTitle>
            <ZoruCardDescription>
              The Phase-1 happy path: provider → send → DLR → logs.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-2 text-sm">
            <Link
              href="/sabsms/providers"
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <span>1. Verify Twilio credentials</span>
              <span className="text-xs text-slate-500">→ providers</span>
            </Link>
            <Link
              href="/sabsms/numbers"
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <span>2. Confirm default sender number</span>
              <span className="text-xs text-slate-500">→ numbers</span>
            </Link>
            <Link
              href="/sabsms/send"
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <span>3. Send a test message</span>
              <span className="text-xs text-slate-500">→ send</span>
            </Link>
            <Link
              href="/sabsms/logs"
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <span>4. Watch DLR land in logs</span>
              <span className="text-xs text-slate-500">→ logs</span>
            </Link>
            <Link
              href="/sabsms/inbox"
              className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
            >
              <span>5. Reply to inbound</span>
              <span className="text-xs text-slate-500">→ inbox</span>
            </Link>
          </ZoruCardContent>
        </ZoruCard>

        <ZoruCard>
          <ZoruCardHeader>
            <ZoruCardTitle>Rollout</ZoruCardTitle>
            <ZoruCardDescription>
              14-phase plan in{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
                plans/sabsms-world-class-plan.md
              </code>
              .
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent>
            <ul className="space-y-1 text-sm">
              {[
                { label: "Phase 0 · Foundations", live: true },
                { label: "Phase 1 · Twilio send + DLR + inbound", live: true },
                { label: "Phase 2 · 2-way inbox + SLA", live: false },
                { label: "Phase 3 · Templates", live: false },
                { label: "Phase 4 · Campaigns + drips", live: false },
                { label: "Phase 7 · Multi-provider routing", live: false },
                { label: "Phase 8 · Compliance + consent", live: false },
                { label: "Phase 10 · RCS Business Messaging", live: false },
              ].map((p) => (
                <li
                  key={p.label}
                  className="flex items-center justify-between border-b border-slate-100 py-1 last:border-0"
                >
                  <span className="text-slate-700">{p.label}</span>
                  <ZoruBadge variant={p.live ? "default" : "secondary"}>
                    {p.live ? "Live" : "Planned"}
                  </ZoruBadge>
                </li>
              ))}
            </ul>
          </ZoruCardContent>
        </ZoruCard>
      </div>
    </div>
  );
}

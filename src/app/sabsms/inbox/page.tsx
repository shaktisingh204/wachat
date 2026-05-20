import Link from "next/link";
import { MessageSquare } from "lucide-react";

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruEmptyState,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
} from "@/components/zoruui";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

export const dynamic = "force-dynamic";

interface InboundRow {
  id: string;
  from: string;
  to: string;
  body: string;
  receivedAt?: string;
}

async function loadInbound(workspaceId: string): Promise<InboundRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  const docs = await col
    .find({ workspaceId, direction: "inbound" })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();
  return docs.map((d: any) => ({
    id: String(d._id),
    from: d.from,
    to: d.to,
    body: d.body,
    receivedAt: d.createdAt
      ? new Date(d.createdAt).toISOString()
      : undefined,
  }));
}

function ago(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const delta = Date.now() - d.getTime();
  const mins = Math.round(delta / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString();
}

export default async function SabsmsInboxPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadInbound(workspaceId) : [];

  return (
    <div className="space-y-6 p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Inbox</ZoruPageTitle>
          <ZoruPageDescription>
            Inbound replies routed to{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              /api/sabsms/webhook/twilio/inbound
            </code>
            . Full 2-way threading + agent assignment + SLA lands in
            Phase 2.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton asChild>
            <Link href="/sabsms/send">Compose</Link>
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>
            Recent inbound{" "}
            <ZoruBadge variant="secondary">{rows.length}</ZoruBadge>
          </ZoruCardTitle>
          <ZoruCardDescription>
            Newest first. Replying inline ships with the Phase 2 thread
            view.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {rows.length === 0 ? (
            <ZoruEmptyState
              icon={<MessageSquare />}
              title="No inbound messages yet"
              description="When carriers POST to /api/sabsms/webhook/twilio/inbound, the engine writes the message here and an SSE event fires for live updates (Phase 2)."
            />
          ) : (
            <ul className="divide-y divide-slate-200">
              {rows.map((r) => (
                <li key={r.id} className="flex gap-4 py-3">
                  <div className="w-44 shrink-0 space-y-1">
                    <div className="font-mono text-xs text-slate-700">
                      {r.from}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      to {r.to}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {ago(r.receivedAt)}
                    </div>
                  </div>
                  <div className="flex-1 text-sm text-slate-800">{r.body}</div>
                </li>
              ))}
            </ul>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}

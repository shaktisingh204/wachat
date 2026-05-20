import Link from "next/link";
import { Phone } from "lucide-react";

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
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from "@/components/zoruui";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

export const dynamic = "force-dynamic";

interface NumberRow {
  id: string;
  e164: string;
  country: string;
  type: string;
  provider: string;
  status: string;
  capabilities: { sms: boolean; mms: boolean; rcs: boolean; voice: boolean };
}

async function loadNumbers(workspaceId: string): Promise<NumberRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.numbers);
  const docs = await col
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return docs.map((d: any) => ({
    id: String(d._id),
    e164: d.e164,
    country: d.country ?? "—",
    type: d.type ?? "longcode",
    provider: d.provider ?? "—",
    status: d.status ?? "active",
    capabilities: d.capabilities ?? { sms: true, mms: false, rcs: false, voice: false },
  }));
}

function capPill(label: string, on: boolean) {
  return (
    <ZoruBadge variant={on ? "default" : "secondary"} className="text-[10px]">
      {label}
    </ZoruBadge>
  );
}

export default async function SabsmsNumbersPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadNumbers(workspaceId) : [];

  const fallbackFrom = process.env.SABSMS_TWILIO_DEFAULT_FROM ?? "";

  return (
    <div className="space-y-6 p-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Numbers</ZoruPageTitle>
          <ZoruPageDescription>
            Provisioned senders for this workspace. Phase 1 reads numbers
            from{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              sabsms_numbers
            </code>{" "}
            but falls back to the engine&rsquo;s{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              SABSMS_TWILIO_DEFAULT_FROM
            </code>{" "}
            env when no rows exist.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton asChild variant="outline">
            <Link href="/sabsms/providers">Configure provider</Link>
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Sender pool</ZoruCardTitle>
          <ZoruCardDescription>
            The router (Phase 7) will rotate sends across active numbers
            and degrade if a number&rsquo;s DLR success rate dips.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-10">
              <ZoruEmptyState
                icon={<Phone />}
                title="No numbers provisioned yet"
                description={
                  fallbackFrom
                    ? `Sends will go out from ${fallbackFrom} (engine env fallback) until a workspace number is added.`
                    : "Configure a provider, then provision a number. The provisioning UI ships in Phase 1.5."
                }
                action={
                  <ZoruButton asChild>
                    <Link href="/sabsms/providers">Open providers</Link>
                  </ZoruButton>
                }
              />
            </div>
          ) : (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Number</ZoruTableHead>
                  <ZoruTableHead className="w-[80px]">Country</ZoruTableHead>
                  <ZoruTableHead className="w-[110px]">Type</ZoruTableHead>
                  <ZoruTableHead className="w-[100px]">Provider</ZoruTableHead>
                  <ZoruTableHead className="w-[220px]">Capabilities</ZoruTableHead>
                  <ZoruTableHead className="w-[90px]">Status</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {rows.map((r) => (
                  <ZoruTableRow key={r.id}>
                    <ZoruTableCell className="font-mono text-sm">
                      {r.e164}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-xs">{r.country}</ZoruTableCell>
                    <ZoruTableCell className="text-xs">{r.type}</ZoruTableCell>
                    <ZoruTableCell className="text-xs">{r.provider}</ZoruTableCell>
                    <ZoruTableCell>
                      <div className="flex flex-wrap gap-1">
                        {capPill("SMS", r.capabilities.sms)}
                        {capPill("MMS", r.capabilities.mms)}
                        {capPill("RCS", r.capabilities.rcs)}
                        {capPill("Voice", r.capabilities.voice)}
                      </div>
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge
                        variant={r.status === "active" ? "default" : "secondary"}
                      >
                        {r.status}
                      </ZoruBadge>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </div>
  );
}

import Link from "next/link";
import { ServerCog } from "lucide-react";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  Separator,
} from "@/components/zoruui";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

export const dynamic = "force-dynamic";

interface ProviderRow {
  id: string;
  provider: string;
  region?: string;
  isDefault: boolean;
  status: string;
  lastError?: string;
}

async function loadProviders(workspaceId: string): Promise<ProviderRow[]> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.providerAccounts);
  const docs = await col.find({ workspaceId }).limit(50).toArray();
  return docs.map((d: any) => ({
    id: String(d._id),
    provider: d.provider,
    region: d.region,
    isDefault: !!d.isDefault,
    status: d.status ?? "active",
    lastError: d.lastError,
  }));
}

const PROVIDER_CATALOG = [
  { id: "twilio", name: "Twilio", available: true, region: "US/EU/APAC" },
  { id: "vonage", name: "Vonage (Nexmo)", available: false, region: "Global" },
  { id: "messagebird", name: "MessageBird / Bird", available: false, region: "Global" },
  { id: "plivo", name: "Plivo", available: false, region: "Global" },
  { id: "sinch", name: "Sinch", available: false, region: "Global" },
  { id: "infobip", name: "Infobip", available: false, region: "Global" },
  { id: "aws_sns", name: "AWS SNS", available: false, region: "Global" },
  { id: "telnyx", name: "Telnyx", available: false, region: "US/EU" },
  { id: "msg91", name: "MSG91", available: false, region: "IN" },
  { id: "gupshup", name: "Gupshup", available: false, region: "IN/APAC" },
];

export default async function SabsmsProvidersPage() {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as any)?._id ?? "");
  const rows = workspaceId ? await loadProviders(workspaceId) : [];

  const envCredsPresent =
    !!process.env.SABSMS_TWILIO_ACCOUNT_SID &&
    !!process.env.SABSMS_TWILIO_AUTH_TOKEN;

  return (
    <div className="space-y-6 p-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>Providers</ZoruPageTitle>
          <ZoruPageDescription>
            Connected SMS gateways. Phase 1 supports Twilio via the engine
            env (single account). Per-workspace encrypted credentials and
            multi-provider routing ship in Phase 7.
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      {envCredsPresent ? (
        <Alert>
          <ZoruAlertTitle>Twilio is wired</ZoruAlertTitle>
          <ZoruAlertDescription>
            The engine has{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              SABSMS_TWILIO_ACCOUNT_SID
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              SABSMS_TWILIO_AUTH_TOKEN
            </code>
            . You can send now via{" "}
            <Link
              href="/sabsms/send"
              className="font-medium text-amber-600 underline underline-offset-2"
            >
              the composer
            </Link>
            .
          </ZoruAlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <ZoruAlertTitle>Twilio creds missing on the engine</ZoruAlertTitle>
          <ZoruAlertDescription>
            Set <code>SABSMS_TWILIO_ACCOUNT_SID</code>,{" "}
            <code>SABSMS_TWILIO_AUTH_TOKEN</code> and{" "}
            <code>SABSMS_TWILIO_DEFAULT_FROM</code> in the engine env,
            then restart the <code>sabsms-engine</code> PM2 app.
          </ZoruAlertDescription>
        </Alert>
      )}

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Workspace credentials</ZoruCardTitle>
          <ZoruCardDescription>
            Encrypted per workspace. Read from{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              sabsms_provider_accounts
            </code>
            .
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          {rows.length === 0 ? (
            <EmptyState
              icon={<ServerCog />}
              title="No workspace credentials saved"
              description="Phase 1.5 adds a dialog to paste Twilio credentials per workspace. For now the engine uses its env-level fallback."
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded border border-slate-200 p-3"
                >
                  <div>
                    <div className="font-medium">{r.provider}</div>
                    <div className="text-xs text-slate-500">
                      {r.region ?? "—"}
                      {r.lastError && (
                        <span className="ml-2 text-rose-600">
                          last error: {r.lastError}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.isDefault && (
                      <Badge variant="default">default</Badge>
                    )}
                    <Badge
                      variant={r.status === "active" ? "default" : "destructive"}
                    >
                      {r.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ZoruCardContent>
      </Card>

      <Card>
        <ZoruCardHeader>
          <ZoruCardTitle>Provider catalog</ZoruCardTitle>
          <ZoruCardDescription>
            All gateways the engine plans to support. Phase 7 lights the
            rest up.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent>
          <ul className="grid gap-2 md:grid-cols-2">
            {PROVIDER_CATALOG.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.region}</div>
                </div>
                <Badge variant={p.available ? "default" : "secondary"}>
                  {p.available ? "Available" : "Phase 7"}
                </Badge>
              </li>
            ))}
          </ul>
          <Separator className="my-4" />
          <p className="text-xs text-slate-500">
            Roadmap: <code>plans/sabsms-world-class-plan.md</code> — Phase
            7 (multi-provider routing + sender pool + cost engine).
          </p>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
